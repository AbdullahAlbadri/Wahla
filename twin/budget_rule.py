"""50/30/20 budget rule — needs / wants / savings classification and the
decision-time and monthly-adjustment logic from Wahla - Logic.pdf.

This module only reads Twin state (category_ratios, savings_rate, income),
same isolation contract as simulation.py/personality.py — no raw
transactions, no data_loader import (check_architecture.py enforces this).

Berka's category set is coarse (see config.NEED_CATEGORIES/WANT_CATEGORIES);
the needs/wants split below is only as accurate as that mapping.
"""
from . import config


def budget_ratios(twin_state: dict) -> dict:
    """Needs / wants / savings as a share of monthly income (the 50/30/20 axes).

    category_ratios (features.py) are shares of *total debit volume*, not of
    income — this rescales them by (expenses / income) so the three numbers
    are comparable to the 50/30/20 targets and sum to ~1 with savings_rate.
    """
    income = twin_state.get("monthly_income", 0)
    expenses = twin_state.get("monthly_expenses", 0)
    savings_rate = twin_state.get("savings_rate", 0.0)
    category_ratios = twin_state.get("category_ratios", {}) or {}

    if not income:
        return {"needs": 0.0, "wants": 0.0, "savings": 0.0}

    spend_share_of_income = expenses / income

    def _share(categories: set) -> float:
        return sum(v for k, v in category_ratios.items()
                   if k.replace("_ratio", "") in categories)

    needs = spend_share_of_income * _share(config.NEED_CATEGORIES)
    wants = spend_share_of_income * _share(config.WANT_CATEGORIES)
    return {
        "needs": round(needs, 4),
        "wants": round(wants, 4),
        "savings": round(savings_rate, 4),
    }


def decision_check(twin_state: dict, *, is_need: bool, amount: float,
                    can_pay_installments: bool = False) -> dict:
    """Base Logic decision tree: should this spending decision be added?

    Mirrors the spec exactly:
      1. need -> add.
      2. want, but wants haven't exceeded 30% yet -> add.
      3. wants already over 30% and can't be paid in installments -> don't.
      4. wants over 30% but CAN be paid in installments: converting it to a
         recurring installment makes it a needs-like commitment, so it's
         allowed only if needs stays under 50% including this installment.
    """
    income = twin_state.get("monthly_income", 0)
    ratios = budget_ratios(twin_state)
    share = (amount / income) if income else 0.0

    if is_need:
        return {"allow": True, "step": 1,
                "reason": "احتياج أساسي — يُضاف مباشرة"}

    if ratios["wants"] <= config.BUDGET_RULE_TARGETS["wants"]:
        return {"allow": True, "step": 2,
                "reason": "الرغبات لسه ما تجاوزت 30% من الدخل"}

    if not can_pay_installments:
        return {"allow": False, "step": 3,
                "reason": "الرغبات تجاوزت 30% ولا يوجد خيار تقسيط لهذا الشراء"}

    needs_after = ratios["needs"] + share
    if needs_after <= config.BUDGET_RULE_TARGETS["needs"]:
        return {"allow": True, "step": 4,
                "reason": "يمكن تحويله لقسط شهري بدون تجاوز 50% احتياجات"}
    return {"allow": False, "step": 4,
            "reason": "حتى كقسط شهري، سيدفع الاحتياجات فوق 50% من الدخل"}


def monthly_adjustment(twin_state: dict) -> dict | None:
    """Which of the three monthly rebalancing rules currently applies, if any.

    Note on rule 3: the spec's page 2 says "keep needs at 20%" for the
    needs > 50% case, which cannot be right (needs is already over 50% by
    definition here) — page 4 restates the same rule as "temporarily cut
    savings to 10-15%, keep wants at 20-30%", which is internally consistent
    and used twice, so that's what's implemented. Flagging the discrepancy
    rather than silently picking one.
    """
    r = budget_ratios(twin_state)
    targets = config.BUDGET_RULE_TARGETS
    step = config.MONTHLY_ADJUSTMENT_STEP

    if r["needs"] > targets["needs"]:
        return {
            "rule": "needs_over_50",
            "action": "reduce_wants_temporarily",
            "detail": "قلّصي الرغبات مؤقتًا وخفّضي الادخار إلى 10-15% حتى تنضبط الاحتياجات",
            "current": r,
        }
    if r["wants"] > targets["wants"] and r["savings"] < targets["savings"]:
        return {
            "rule": "wants_over_30_savings_under_20",
            "action": "shift_wants_to_savings",
            "shift_pct": step,
            "detail": f"خفّضي الرغبات {step*100:.1f}% شهريًا وحوّليها للادخار حتى تصلي 30%/20%",
            "current": r,
        }
    needs_low = 0.20 <= r["needs"] <= 0.30
    if needs_low and r["wants"] > 0.50:
        return {
            "rule": "wants_over_50_needs_low",
            "action": "increase_savings_from_wants",
            "shift_pct": step,
            "detail": f"ارفعي الادخار {step*100:.1f}% شهريًا من الرغبات حتى يصل 25-30%",
            "current": r,
        }
    return None
