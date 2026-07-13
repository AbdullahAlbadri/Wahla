"""TwinDiff — semantic state-difference engine.

A diff is not just numbers: each changed attribute carries a REASON derived
from the Twin's dependency graph (which upstream attributes moved). This
single object powers explainability, the UI before/after view, and the
judge inspection output.
"""

# attribute → the upstream attributes it is derived from
DEPENDENCY_GRAPH = {
    "financial_health_score": ["savings_rate", "cashflow_stability",
                               "debt_ratio", "emergency_fund_months"],
    "savings_rate": ["monthly_income", "monthly_expenses"],
    "net_cashflow": ["monthly_income", "monthly_expenses"],
    "debt_ratio": ["monthly_loan_payment", "monthly_income"],
    "emergency_fund_months": ["current_balance", "monthly_expenses"],
    "risk_level": ["financial_health_score", "debt_ratio", "savings_rate"],
    "financial_personality": ["savings_rate", "debt_ratio",
                              "emergency_fund_months"],
    "personality_confidence": ["financial_personality"],
}

# upstream attribute + direction → human reason
REASON_PHRASES = {
    ("monthly_loan_payment", +1): "monthly obligations increased",
    ("monthly_loan_payment", -1): "monthly obligations decreased",
    ("monthly_expenses", +1): "recurring spending increased",
    ("monthly_expenses", -1): "recurring spending decreased",
    ("monthly_income", +1): "income increased",
    ("monthly_income", -1): "income decreased",
    ("current_balance", +1): "cash reserve grew",
    ("current_balance", -1): "cash reserve consumed",
    ("savings_rate", +1): "savings rate improved",
    ("savings_rate", -1): "savings rate fell",
    ("debt_ratio", +1): "debt ratio increased",
    ("debt_ratio", -1): "debt ratio decreased",
    ("emergency_fund_months", +1): "liquidity buffer grew",
    ("emergency_fund_months", -1): "liquidity buffer shrank",
    ("financial_health_score", +1): "overall health improved",
    ("financial_health_score", -1): "overall health deteriorated",
    ("cashflow_stability", +1): "cash flow became steadier",
    ("cashflow_stability", -1): "cash flow became less stable",
}


def _direction(before, after) -> int:
    if isinstance(before, (int, float)) and isinstance(after, (int, float)):
        return +1 if after > before else -1
    return 0


def _reasons_for(attr: str, before_state: dict, after_state: dict) -> list[str]:
    """Which upstream dependencies of `attr` changed, phrased as causes."""
    reasons = []
    for dep in DEPENDENCY_GRAPH.get(attr, []):
        b, a = before_state.get(dep), after_state.get(dep)
        if b is None or a is None or b == a:
            continue
        phrase = REASON_PHRASES.get((dep, _direction(b, a)))
        if phrase:
            reasons.append(phrase)
        else:
            reasons.append(f"{dep.replace('_', ' ')} changed")
    return reasons


def twin_diff(before_state: dict, after_state: dict) -> list[dict]:
    """Compute the semantic difference between two Twin states.

    Returns a list of change records, root causes first (attributes that
    are pure inputs come before derived ones, so the causal story reads
    top-down).
    """
    changes = []
    for attr, before in before_state.items():
        after = after_state.get(attr)
        if after == before:
            continue
        record = {
            "attribute": attr,
            "before": before,
            "after": after,
            "delta": round(after - before, 4)
            if isinstance(before, (int, float)) and isinstance(after, (int, float))
            else None,
            "reasons": _reasons_for(attr, before_state, after_state),
        }
        changes.append(record)

    # root causes (no dependencies among snapshot keys) first, derived last
    def depth(attr: str, seen=None) -> int:
        seen = seen or set()
        if attr in seen or attr not in DEPENDENCY_GRAPH:
            return 0
        return 1 + max((depth(d, seen | {attr})
                        for d in DEPENDENCY_GRAPH[attr]), default=0)

    changes.sort(key=lambda c: depth(c["attribute"]))
    return changes


def render(diff: list[dict], fmt) -> list[str]:
    """Human lines: 'Health Score 82 → 74 — because debt ratio increased'."""
    lines = []
    for c in diff:
        line = (f"{c['attribute'].replace('_', ' ')}: "
                f"{fmt(c['attribute'], c['before'])} → "
                f"{fmt(c['attribute'], c['after'])}")
        if c["reasons"]:
            line += "  — because " + " and ".join(c["reasons"])
        lines.append(line)
    return lines
