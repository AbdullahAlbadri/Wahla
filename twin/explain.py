"""Explainability layer.

Turns a simulation's attribute-level diff into a human explanation that
references WHICH Twin attributes changed and WHY. No LLM required — the
explanation is derived mechanically from the Twin state diff, so it is
always faithful to the numbers. (An LLM layer can rephrase this text,
but never invents the reasoning.)
"""

LABELS = {
    "monthly_income": "monthly income",
    "monthly_expenses": "monthly expenses",
    "net_cashflow": "net cash flow",
    "savings_rate": "savings rate",
    "debt_ratio": "debt-to-income ratio",
    "current_balance": "account balance",
    "emergency_fund_months": "emergency fund",
    "financial_health_score": "Health Score",
    "monthly_loan_payment": "monthly loan obligations",
    "financial_personality": "financial personality",
    "risk_level": "risk level",
}

PCT_ATTRS = {"savings_rate", "debt_ratio"}
MONEY_ATTRS = {"monthly_income", "monthly_expenses", "net_cashflow",
               "current_balance", "monthly_loan_payment"}


def _fmt(attr: str, v) -> str:
    if attr in PCT_ATTRS:
        return f"{v * 100:.1f}%"
    if attr in MONEY_ATTRS:
        return f"{v:,.0f}"
    if attr == "emergency_fund_months":
        return f"{v:.1f} months"
    return str(v)


def _cause_sentence(event: dict) -> str:
    t = event.get("type")
    if t == "new_loan":
        return (f"the loan adds {event.get('monthly_payment', 0):,.0f}/month "
                f"in obligations for {event.get('duration_months')} months")
    if t == "one_off_expense":
        return f"a one-time payment of {event.get('amount', 0):,.0f} left the account"
    if t == "new_subscription":
        return (f"a new recurring commitment of "
                f"{event.get('monthly_amount', 0):,.0f}/month was added")
    if t == "salary_change":
        return "monthly income changed"
    if t == "rent_change":
        d = event.get("delta", 0)
        return f"housing costs {'rose' if d > 0 else 'fell'} by {abs(d):,.0f}/month"
    if t == "investment":
        return (f"{event.get('monthly_amount', 0):,.0f}/month now flows "
                f"into investments instead of the account")
    if t == "loan_payoff":
        return f"monthly obligations dropped by {event.get('monthly_payment', 0):,.0f}"
    return "the simulated decision was applied"


def explain(result: dict) -> str:
    """Build the WHY narrative for one simulation result.

    Single source of truth: consumes the TwinDiff already computed for the
    result (final state vs original state) — never recomputes differences.
    """
    changes = {c["attribute"]: c for c in result.get("twin_diff", [])}
    causes = "; ".join(_cause_sentence(e) for e in result.get("events_applied", []))

    effects = []
    for attr in ("debt_ratio", "savings_rate", "emergency_fund_months",
                 "current_balance", "net_cashflow"):
        if attr in changes:
            c = changes[attr]
            direction = "rose" if (c["delta"] or 0) > 0 else "fell"
            effects.append(f"your {LABELS[attr]} {direction} from "
                           f"{_fmt(attr, c['before'])} to {_fmt(attr, c['after'])}")

    health = changes.get("financial_health_score")
    lead = ""
    if health:
        verb = "decreased" if health["delta"] < 0 else "improved"
        lead = (f"The Health Score {verb} from {health['before']} to "
                f"{health['after']} because {causes}")
    else:
        lead = f"The decision was applied: {causes}"

    sentence = lead
    if effects:
        sentence += " — as a result, " + ", ".join(effects)
    risk = changes.get("risk_level")
    if risk:
        sentence += f". Risk level moved from {risk['before']} to {risk['after']}"
    return sentence + "."


def before_after_card(result: dict) -> dict:
    """Frontend-ready before/after comparison of the headline attributes."""
    b, a = result["before"], result["after"]
    card = {}
    for attr in ("financial_health_score", "savings_rate",
                 "emergency_fund_months", "debt_ratio", "risk_level",
                 "financial_personality"):
        if attr in b:
            card[attr] = {"before": _fmt(attr, b[attr]),
                          "after": _fmt(attr, a[attr]),
                          "changed": b[attr] != a[attr]}
    return card
