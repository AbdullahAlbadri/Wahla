"""Passive product suggestion layer (Wahla - Logic.pdf).

Sits on top of the 50/30/20 engine (budget_rule.py). Never blocks or
executes a transaction — only surfaces a matching product when the Twin
detects a condition a product could measurably fix. The user always makes
the final call.

Same isolation contract as the rest of twin/: reads Twin state (and the
explicit `signals` stubs below) only, never raw transactions.

Data honesty note: sections 4-8 need signals Berka's schema doesn't carry
(revolving credit card balance, annual fees paid, a business-owner flag,
monthly wants% history). Those are accepted as optional keys in `signals`
and simply produce no suggestion when absent — that's "no signal available",
not a bug. Wiring real values for them is future work (a live Open Banking
feed, or new fields on /api/connect).
"""
from datetime import datetime, timedelta

from . import config
from .budget_rule import budget_ratios
from .confidence import suggestion_confidence


def _cooled_down(kind: str, history: list[dict]) -> bool:
    """True if `kind` hasn't been shown in the last SUGGESTION_COOLDOWN_DAYS."""
    cutoff = datetime.now() - timedelta(days=config.SUGGESTION_COOLDOWN_DAYS)
    for h in history or []:
        if h.get("type") == kind:
            shown_at = h.get("shown_at")
            if shown_at and datetime.fromisoformat(shown_at) > cutoff:
                return False
    return True


def _savings_tier_for(balance: float) -> dict:
    for tier in config.SAVINGS_TIERS:
        if tier["max_balance"] is None or balance <= tier["max_balance"]:
            return tier
    return config.SAVINGS_TIERS[-1]


# ---------- section 4: idle cash -> savings tier ----------

def _idle_cash_suggestion(twin_state: dict, signals: dict) -> dict | None:
    income = twin_state.get("monthly_income", 0)
    balance = twin_state.get("avg_monthly_balance", 0)
    ratios = budget_ratios(twin_state)
    needs_spending = ratios["needs"] * income
    buffer = needs_spending  # 1 month of needs spending

    in_savings_product = signals.get("in_savings_product", False)
    current_tier_index = signals.get("current_savings_tier_index")

    if not in_savings_product:
        if balance > buffer > 0:
            sweep_amount = round(balance - buffer, 2)
            return {
                "type": "idle_cash_savings",
                "title": "افتحي حساب توفير لرصيدك الخامل",
                "detail": f"عندك {sweep_amount:,.0f} ريال فوق احتياجك الشهري "
                          "يجلس بدون عائد — نقترح تحويله لحساب توفير",
                "product": "savings_account",
                "sweep_amount": sweep_amount,
            }
        return None

    best_tier = _savings_tier_for(balance)
    best_index = config.SAVINGS_TIERS.index(best_tier)
    if current_tier_index is not None and current_tier_index < best_index:
        return {
            "type": "idle_cash_savings",
            "title": "ترقّي فئة حساب التوفير",
            "detail": f"رصيدك يؤهلك لفئة أعلى بعائد {best_tier['aer_min']*100:.2f}"
                      f"-{best_tier['aer_max']*100:.2f}% سنويًا",
            "product": "savings_account_tier_upgrade",
            "target_tier": best_tier,
        }
    return None


# ---------- section 5: right-size a pending need purchase ----------

def _needs_headroom(twin_state: dict) -> float:
    income = twin_state.get("monthly_income", 0)
    ratios = budget_ratios(twin_state)
    return config.BUDGET_RULE_TARGETS["needs"] * income - ratios["needs"] * income


def _amortized_monthly(principal: float, annual_rate: float, months: int) -> float:
    r = annual_rate / 12
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def income_pct(amount: float, twin_state: dict) -> float:
    income = twin_state.get("monthly_income", 0)
    return (amount / income) if income else 0.0


def _car_financing_suggestion(twin_state: dict, signals: dict) -> dict | None:
    purchase = signals.get("pending_need_purchase")
    if not purchase or purchase.get("type") != "car":
        return None
    price = purchase["price"]
    headroom = _needs_headroom(twin_state)

    candidates = []
    for tier in config.CAR_FINANCING_TENORS:
        months = tier["years"] * 12
        installment = _amortized_monthly(price, tier["annual_rate"], months)
        if installment <= headroom:
            candidates.append({**tier, "months": months, "installment": round(installment, 2)})

    if not candidates:
        return {
            "type": "purchase_financing",
            "title": "هذا الشراء ما يناسب وضعك الحالي",
            "detail": "حتى بأطول مدة تمويل متاحة، الاحتياجات بتتجاوز 50% من دخلك",
            "allow": False,
        }

    shortest = min(candidates, key=lambda c: c["months"])
    result = {
        "type": "purchase_financing",
        "title": f"تمويل سيارة على {shortest['years']} سنوات",
        "detail": f"قسط شهري {shortest['installment']:,.0f} ريال — أقصر مدة تناسب دخلك "
                  "(أقل إجمالي فوائد)",
        "allow": True,
        "recommended": shortest,
    }
    headroom_after = headroom - shortest["installment"]
    if income_pct(headroom_after, twin_state) < 0.02:
        longer = max(candidates, key=lambda c: c["months"])
        if longer is not shortest:
            result["fallback_tight"] = {
                **longer,
                "note": "هامش ضيق (<2%) بأقصر مدة — بديل أطول وأعلى تكلفة إجمالية للأمان",
            }
    return result


def _real_estate_financing_suggestion(twin_state: dict, signals: dict) -> dict | None:
    purchase = signals.get("pending_need_purchase")
    if not purchase or purchase.get("type") != "real_estate":
        return None
    price = purchase["price"]
    term_rate = purchase.get("annual_rate", 0.04)
    headroom = _needs_headroom(twin_state)

    candidates = []
    for years in config.REAL_ESTATE_TENORS:
        financed = price * config.REAL_ESTATE_MAX_FINANCING_RATIO
        installment = _amortized_monthly(financed, term_rate, years * 12)
        if installment <= headroom:
            candidates.append({"years": years, "financing_ratio": config.REAL_ESTATE_MAX_FINANCING_RATIO,
                               "installment": round(installment, 2)})

    if not candidates:
        return {
            "type": "purchase_financing",
            "title": "التمويل العقاري بهذا السعر يحتاج دفعة أولى أكبر",
            "detail": "حتى بأقصى نسبة تمويل (90%) وأطول مدة، الاحتياجات تتجاوز 50%",
            "allow": False,
        }
    shortest = min(candidates, key=lambda c: c["years"])
    return {
        "type": "purchase_financing",
        "title": f"تمويل عقاري على {shortest['years']} سنة",
        "detail": f"قسط شهري {shortest['installment']:,.0f} ريال بنسبة تمويل "
                  f"{shortest['financing_ratio']*100:.0f}%",
        "allow": True,
        "recommended": shortest,
    }


# ---------- section 6: wants funded by revolving credit card debt ----------

def _revolving_balance_source(wants_pct_history: list, needs_pct_history: list) -> str:
    if wants_pct_history and sum(1 for w in wants_pct_history if w > 0.30) > len(wants_pct_history) / 2:
        return "wants"
    if needs_pct_history and sum(1 for n in needs_pct_history if n > 0.50) > len(needs_pct_history) / 2:
        return "needs"
    return "unclear"


def _revolving_debt_suggestion(twin_state: dict, signals: dict) -> dict | None:
    revolving_balance = signals.get("credit_card_revolving_balance")
    if not revolving_balance:
        return None
    ratios = budget_ratios(twin_state)
    if ratios["wants"] <= config.BUDGET_RULE_TARGETS["wants"]:
        return None

    source = _revolving_balance_source(
        signals.get("wants_pct_history_during_buildup"),
        signals.get("needs_pct_history_during_buildup"))

    if source == "unclear":
        return {
            "type": "revolving_debt",
            "title": "قلّلي ديون بطاقتك مرتفعة الفائدة",
            "detail": "رصيد دوّار على بطاقتك — يستحق التقليل بغض النظر عن السبب",
            "root_cause": "unclear",
        }
    if source != "wants":
        return None  # routed to base logic's needs>50% monthly rule instead

    lower_apr_available = signals.get("lower_apr_tier_available", False)
    can_convert_to_installment = signals.get("revolving_want_is_large_one_off", False)

    suggestion = {
        "type": "revolving_debt",
        "title": "حوّلي رصيد بطاقتك الدوّار لهيكل أرخص",
        "root_cause": "wants",
        "options": [],
    }
    if lower_apr_available:
        suggestion["options"].append({
            "action": "migrate_to_lower_apr_tier",
            "detail": "انقلي الرصيد لفئة بطاقة بفائدة أقل (بدون رفع الحد الائتماني)",
        })
    if can_convert_to_installment:
        suggestion["options"].append({
            "action": "convert_to_installment_product",
            "detail": f"حوّليه لتمويل بالتقسيط بهامش ثابت ~{config.INSTALLMENT_MARGIN*100:.1f}% "
                      f"بدل فائدة {config.REVOLVING_APR_ASSUMED*100:.0f}%+",
        })
    if not suggestion["options"]:
        return None
    return suggestion


# ---------- section 7: card fee mismatch ----------

def _card_fee_suggestion(twin_state: dict, signals: dict) -> dict | None:
    annual_fee_paid = signals.get("annual_fee_paid", 0)
    usage_matches_cheaper_tier = signals.get("usage_matches_cheaper_tier", False)
    frequent_international = signals.get("frequent_international_transactions", False)
    current_card = signals.get("current_card_tier")

    if annual_fee_paid > 0 and usage_matches_cheaper_tier:
        return {
            "type": "card_fee_mismatch",
            "title": "نزّلي فئة بطاقتك",
            "detail": "تدفعين رسوم سنوية على فئة أعلى من استخدامك الفعلي — "
                      "أغلب فئات مدى برسوم صفر",
            "action": "downgrade_card_tier",
        }
    if frequent_international and current_card in ("mada_classic", "mada_gold"):
        current_rate = config.CARD_TIERS[current_card]["intl_rate"]
        visa_rate = config.CARD_TIERS["visa"]["intl_rate"]
        return {
            "type": "card_fee_mismatch",
            "title": "بطاقة فيزا أوفر لمعاملاتك الدولية",
            "detail": f"سعر التحويل الدولي {visa_rate*100:.2f}% بدل "
                      f"{current_rate*100:.2f}% — قارني نقطة التعادل مع الرسوم السنوية",
            "action": "upgrade_to_visa_tier",
        }
    return None


# ---------- section 8: business income smoothing ----------

def _business_financing_suggestion(twin_state: dict, signals: dict) -> dict | None:
    if not signals.get("is_business_owner"):
        return None
    if not signals.get("cash_flow_gap_detected"):
        return None
    size = signals.get("business_size", "micro")
    tier = next((t for t in config.BUSINESS_FINANCING_TIERS if t["size"] == size), None)
    if not tier:
        return None
    return {
        "type": "business_financing",
        "title": f"تمويل منشآت {size}",
        "detail": f"حتى {tier['max_amount']:,} ريال" + (
            f"، هامش {tier['margin_min']*100:.0f}-{tier['margin_max']*100:.0f}% "
            f"حتى {tier['max_months']} شهرًا" if tier["margin_min"] else ""),
        "tier": tier,
    }


# ---------- orchestration ----------

_PRIORITY = ["idle_cash_savings", "revolving_debt", "purchase_financing",
             "card_fee_mismatch", "business_financing"]



# Suggestion types that add a new voluntary monthly commitment — these are
# the ones that should back off when liquidity is already fragile. Debt-
# relief/idle-cash suggestions (idle_cash_savings, revolving_debt,
# card_fee_mismatch) are protective, not additive, so they're exempt.
_ADDITIVE_TYPES = {"purchase_financing", "business_financing"}


def _liquidity_guard_blocks(twin_state: dict) -> bool:
    """True when the account is too fragile for a new voluntary commitment.

    Both thresholds reuse real Twin fields already computed elsewhere
    (risk_level's own thresholds in personality.py use similar cutoffs) —
    not a new arbitrary rule invented for this guard alone. Missing fields
    default to "unknown, don't block" rather than 0 — a live Twin always
    populates both, but synthetic/partial state (tests, future callers)
    shouldn't get suppressed by a field it never set.
    """
    ef_months = twin_state.get("emergency_fund_months")
    debt_ratio = twin_state.get("debt_ratio")
    return (ef_months is not None and ef_months < 1) or (debt_ratio is not None and debt_ratio > 0.35)


def _basis_for(c: dict, twin_state: dict, signals: dict) -> list[str]:
    """Which real signals/thresholds fired this suggestion — surfaced instead
    of discarded, so the UI can show *why* each recommendation exists
    (extends the same explainability twin_diff already provides elsewhere).
    """
    t = c["type"]
    if t == "idle_cash_savings":
        basis = [f"الرصيد يتجاوز احتياجك الشهري بمقدار {c.get('sweep_amount', 0):,.0f} ريال"]
        if not signals.get("in_savings_product", False):
            basis.append("لا يوجد حساب توفير مفعّل حاليًا")
        return basis
    if t == "purchase_financing":
        return [f"القسط المقترح ضمن هامش احتياجاتك ({twin_state.get('debt_ratio', 0)*100:.0f}% نسبة ديون حالية)"]
    if t == "revolving_debt":
        return [f"مصدر الرصيد المتجدد: {c.get('root_cause', 'غير محدد')}"]
    if t == "card_fee_mismatch":
        return ["نمط استخدام البطاقة الحالي لا يبرر رسومها السنوية"]
    if t == "business_financing":
        return ["إشارة نشاط تجاري + فجوة تدفق نقدي مكتشفة"]
    return []


def generate_suggestions(twin_state: dict, signals: dict | None = None,
                          history: list[dict] | None = None) -> list[dict]:
    """Run every section, drop cooled-down/non-firing ones, return priority-ordered.

    `signals` carries the stub inputs sections 4-8 need (see module
    docstring) — omit a key and that section simply won't fire.
    `history` = previously-shown suggestions, each {"type", "shown_at" (ISO)}.
    """
    signals = signals or {}
    history = history or []

    candidates = [
        _idle_cash_suggestion(twin_state, signals),
        _car_financing_suggestion(twin_state, signals),
        _real_estate_financing_suggestion(twin_state, signals),
        _revolving_debt_suggestion(twin_state, signals),
        _card_fee_suggestion(twin_state, signals),
        _business_financing_suggestion(twin_state, signals),
    ]
    fired = [c for c in candidates if c is not None]
    fired = [c for c in fired if _cooled_down(c["type"], history)]

    # Context awareness: don't suggest taking on a new voluntary commitment
    # while liquidity is already critical — a refinement of ranking using
    # signals that already exist, not new detection.
    if _liquidity_guard_blocks(twin_state):
        fired = [c for c in fired if c["type"] not in _ADDITIVE_TYPES]

    for c in fired:
        c["basis"] = _basis_for(c, twin_state, signals)
        c["confidence"] = suggestion_confidence(len(c["basis"]))

    fired.sort(key=lambda c: _PRIORITY.index(c["type"])
               if c["type"] in _PRIORITY else len(_PRIORITY))
    return fired
