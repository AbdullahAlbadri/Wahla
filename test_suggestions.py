"""Test suite for the 50/30/20 budget rule + passive suggestion layer
(Wahla - Logic.pdf). Same style as test_events.py: synthetic state, no
dataset needed, runs in under a second.
"""
import sys
from datetime import datetime, timedelta

from twin.budget_rule import budget_ratios, decision_check, monthly_adjustment
from twin.suggestions import generate_suggestions

FAILURES = []


def check(name: str, cond: bool, detail: str = ""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        FAILURES.append(name)


def _state(**overrides) -> dict:
    base = {
        "monthly_income": 10000.0,
        "monthly_expenses": 6000.0,
        "savings_rate": 0.30,
        "current_balance": 20000.0,
        "avg_monthly_balance": 20000.0,
        "category_ratios": {"household_ratio": 0.60, "uncategorized_ratio": 0.40},
    }
    base.update(overrides)
    return base


def test_budget_ratios():
    print("\n== budget_ratios: rescales category shares to % of income ==")
    s = _state()
    r = budget_ratios(s)
    # expenses/income = 0.6; needs share of debit volume = 0.60 -> needs = 0.36
    check("needs matches hand calc", abs(r["needs"] - 0.36) < 0.001, str(r))
    check("wants matches hand calc", abs(r["wants"] - 0.24) < 0.001, str(r))
    check("savings passes through savings_rate", r["savings"] == 0.30, str(r))

    check("zero income -> all zero, no crash",
          budget_ratios(_state(monthly_income=0)) == {"needs": 0.0, "wants": 0.0, "savings": 0.0})


def test_decision_check():
    print("\n== decision_check: 4-step Base Logic tree ==")

    r = decision_check(_state(), is_need=True, amount=500)
    check("step 1: need always allowed", r["allow"] and r["step"] == 1, str(r))

    # wants at 24% (under 30%) from _state() defaults
    r = decision_check(_state(), is_need=False, amount=100)
    check("step 2: want allowed while wants <= 30%", r["allow"] and r["step"] == 2, str(r))

    # push wants over 30% via category_ratios
    over_wants = _state(category_ratios={"household_ratio": 0.30, "uncategorized_ratio": 0.70})
    r = decision_check(over_wants, is_need=False, amount=500, can_pay_installments=False)
    check("step 3: want denied over 30% with no installment option",
          not r["allow"] and r["step"] == 3, str(r))

    # wants over 30%, installments available, small amount keeps needs under 50%
    r = decision_check(over_wants, is_need=False, amount=100, can_pay_installments=True)
    check("step 4: installment allowed if needs stays <= 50%",
          r["allow"] and r["step"] == 4, str(r))

    # wants over 30%, installments available, but amount is huge -> needs would blow past 50%
    r = decision_check(over_wants, is_need=False, amount=8000, can_pay_installments=True)
    check("step 4: installment denied if it would push needs over 50%",
          not r["allow"] and r["step"] == 4, str(r))


def test_monthly_adjustment():
    print("\n== monthly_adjustment: which rebalancing rule applies ==")

    balanced = _state(category_ratios={"household_ratio": 0.50, "uncategorized_ratio": 0.50},
                       monthly_expenses=5000, savings_rate=0.20)
    check("no rule fires when already on target", monthly_adjustment(balanced) is None,
          str(budget_ratios(balanced)))

    wants_high_savings_low = _state(
        category_ratios={"household_ratio": 0.30, "uncategorized_ratio": 0.70},
        savings_rate=0.05)
    r = monthly_adjustment(wants_high_savings_low)
    check("rule 1 fires: wants>30% and savings<20%",
          r is not None and r["rule"] == "wants_over_30_savings_under_20", str(r))

    needs_over_50 = _state(category_ratios={"household_ratio": 0.90, "uncategorized_ratio": 0.10},
                            monthly_expenses=8000)
    r = monthly_adjustment(needs_over_50)
    check("rule 3 fires: needs > 50% takes precedence",
          r is not None and r["rule"] == "needs_over_50", str(r))


def test_idle_cash_suggestion():
    print("\n== suggestions: idle cash -> savings ==")
    s = _state(avg_monthly_balance=50000)  # needs ~= 0.36 * 10000 = 3600 buffer
    out = generate_suggestions(s, signals={"in_savings_product": False})
    check("fires when idle balance exceeds 1-month-needs buffer",
          any(o["type"] == "idle_cash_savings" for o in out), str(out))

    out = generate_suggestions(_state(avg_monthly_balance=1000),
                                signals={"in_savings_product": False})
    check("doesn't fire when balance is under the buffer",
          not any(o["type"] == "idle_cash_savings" for o in out), str(out))

    bigger_balance = _state(avg_monthly_balance=1_500_000)  # crosses into tier index 1
    out = generate_suggestions(bigger_balance, signals={"in_savings_product": True,
                                                          "current_savings_tier_index": 0})
    check("tier upgrade fires when a better tier exists for the balance",
          any(o["type"] == "idle_cash_savings" and "target_tier" in o for o in out), str(out))


def test_car_financing_suggestion():
    print("\n== suggestions: right-size a car purchase ==")
    s = _state(monthly_income=15000,
                category_ratios={"household_ratio": 0.40, "uncategorized_ratio": 0.60},
                monthly_expenses=6000)
    affordable = generate_suggestions(s, signals={
        "pending_need_purchase": {"type": "car", "price": 20000}})
    hit = next((o for o in affordable if o["type"] == "purchase_financing"), None)
    check("recommends the shortest fitting tenor", hit is not None and hit["allow"], str(hit))

    too_expensive = generate_suggestions(s, signals={
        "pending_need_purchase": {"type": "car", "price": 500000}})
    hit = next((o for o in too_expensive if o["type"] == "purchase_financing"), None)
    check("flags 'don't do it' when no tenor fits",
          hit is not None and hit["allow"] is False, str(hit))


def test_revolving_debt_suggestion():
    print("\n== suggestions: revolving credit card debt root-cause routing ==")
    over_wants = _state(category_ratios={"household_ratio": 0.30, "uncategorized_ratio": 0.70})

    unclear = generate_suggestions(over_wants, signals={"credit_card_revolving_balance": 5000})
    hit = next((o for o in unclear if o["type"] == "revolving_debt"), None)
    check("unclear source -> generic note, no root-cause framing",
          hit is not None and hit["root_cause"] == "unclear", str(hit))

    wants_source = generate_suggestions(over_wants, signals={
        "credit_card_revolving_balance": 5000,
        "wants_pct_history_during_buildup": [0.35, 0.40, 0.38],
        "lower_apr_tier_available": True,
    })
    hit = next((o for o in wants_source if o["type"] == "revolving_debt"), None)
    check("wants-sourced balance -> offers lower-APR migration",
          hit is not None and hit["root_cause"] == "wants" and hit["options"], str(hit))

    needs_source = generate_suggestions(over_wants, signals={
        "credit_card_revolving_balance": 5000,
        "needs_pct_history_during_buildup": [0.55, 0.60, 0.58],
    })
    hit = next((o for o in needs_source if o["type"] == "revolving_debt"), None)
    check("needs-sourced balance -> routed away, this section doesn't fire", hit is None, str(hit))


def test_priority_and_cooldown():
    print("\n== suggestions: priority order + 30-day cooldown ==")
    s = _state(avg_monthly_balance=50000)
    signals = {
        "in_savings_product": False,
        "annual_fee_paid": 100, "usage_matches_cheaper_tier": True,
    }
    out = generate_suggestions(s, signals=signals)
    types = [o["type"] for o in out]
    check("idle_cash_savings (free win) ranks before card_fee_mismatch",
          types.index("idle_cash_savings") < types.index("card_fee_mismatch"), str(types))

    recent_history = [{"type": "idle_cash_savings",
                        "shown_at": (datetime.now() - timedelta(days=5)).isoformat()}]
    out = generate_suggestions(s, signals=signals, history=recent_history)
    check("suppressed inside the 30-day cooldown window",
          "idle_cash_savings" not in [o["type"] for o in out], str(out))

    old_history = [{"type": "idle_cash_savings",
                     "shown_at": (datetime.now() - timedelta(days=45)).isoformat()}]
    out = generate_suggestions(s, signals=signals, history=old_history)
    check("reappears once outside the cooldown window",
          "idle_cash_savings" in [o["type"] for o in out], str(out))


def test_never_does():
    print("\n== guardrails: what this layer never does ==")
    check("business financing never fires for a non-flagged user",
          not any(o["type"] == "business_financing"
                  for o in generate_suggestions(_state(), signals={
                      "cash_flow_gap_detected": True, "business_size": "small"})))
    check("no signals at all -> empty list, no crash",
          generate_suggestions(_state()) == [] or all(
              o["type"] != "business_financing" for o in generate_suggestions(_state())))


def test_liquidity_guard():
    print("\n== liquidity guard: no new voluntary commitment when fragile ==")
    car_signal = {"pending_need_purchase": {"type": "car", "price": 20000}}

    # Field genuinely absent (e.g. a partial/synthetic state) must NOT be
    # treated as "critically low" — regression guard for a real bug caught
    # during development, where .get(key, 0) silently blocked every
    # suggestion for any state that simply never set these fields.
    unset = _state(monthly_income=15000, monthly_expenses=6000,
                    category_ratios={"household_ratio": 0.40, "uncategorized_ratio": 0.60})
    fired = generate_suggestions(unset, signals=car_signal)
    check("missing emergency_fund_months/debt_ratio does not suppress",
          any(o["type"] == "purchase_financing" for o in fired), str(fired))

    # Genuinely critical liquidity (field explicitly set low) DOES suppress.
    fragile = _state(monthly_income=15000, monthly_expenses=6000,
                      category_ratios={"household_ratio": 0.40, "uncategorized_ratio": 0.60},
                      emergency_fund_months=0.5)
    fired = generate_suggestions(fragile, signals=car_signal)
    check("emergency_fund_months < 1 suppresses purchase_financing",
          not any(o["type"] == "purchase_financing" for o in fired), str(fired))

    # Protective suggestions (idle cash) are exempt from the guard even when
    # liquidity looks fragile — they reduce risk, they don't add to it.
    fragile_with_idle_cash = _state(
        monthly_income=10000, monthly_expenses=6000, avg_monthly_balance=20000,
        emergency_fund_months=0.5)
    fired = generate_suggestions(fragile_with_idle_cash, signals={"in_savings_product": False})
    check("idle_cash_savings still fires despite the guard",
          any(o["type"] == "idle_cash_savings" for o in fired), str(fired))


def test_basis_field():
    print("\n== every fired suggestion carries a real basis ==")
    fired = generate_suggestions(
        _state(avg_monthly_balance=20000), signals={"in_savings_product": False})
    hit = next((o for o in fired if o["type"] == "idle_cash_savings"), None)
    check("idle_cash_savings has a non-empty basis",
          hit is not None and isinstance(hit.get("basis"), list) and len(hit["basis"]) > 0, str(hit))


if __name__ == "__main__":
    test_budget_ratios()
    test_decision_check()
    test_monthly_adjustment()
    test_idle_cash_suggestion()
    test_car_financing_suggestion()
    test_revolving_debt_suggestion()
    test_priority_and_cooldown()
    test_never_does()
    test_liquidity_guard()
    test_basis_field()
    print(f"\n{'ALL TESTS PASSED' if not FAILURES else f'{len(FAILURES)} FAILURES: {FAILURES}'}")
    sys.exit(1 if FAILURES else 0)
