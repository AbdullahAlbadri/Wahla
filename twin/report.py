"""Twin Health Report — the full structured readout of one Twin state.

Generated after every simulation (and on demand for the live Twin).
Sections follow the hackathon spec: health, cash flow, risk, liquidity,
debt, savings, personality, stability, goals, confidence, summary.
"""
from .validation import validate


def _grade(score: float) -> str:
    if score >= 75: return "excellent"
    if score >= 55: return "good"
    if score >= 35: return "fair"
    return "poor"


def health_report(state: dict) -> dict:
    """state = twin.to_dict() or a simulation's after-state merged dict."""
    score = state.get("financial_health_score", 0)
    income = state.get("monthly_income", 0)
    forecast = state.get("forecast") or {}
    months_hist = state.get("months_of_history", 0)
    goals = state.get("goals") or []

    report = {
        "financial_health": {
            "score": score,
            "grade": _grade(score),
        },
        "cash_flow": {
            "monthly_income": income,
            "monthly_expenses": state.get("monthly_expenses", 0),
            "net": state.get("net_cashflow", 0),
            "direction": "positive" if state.get("net_cashflow", 0) >= 0
                         else "negative",
        },
        "risk": {
            "level": state.get("risk_level", "medium"),
            "months_to_zero_balance": forecast.get("months_to_zero"),
            "overdraft_months_in_history": state.get("overdraft_months", 0),
        },
        "liquidity": {
            "current_balance": state.get("current_balance", 0),
            "emergency_fund_months": state.get("emergency_fund_months", 0),
            "target_months": 6,
            "status": "funded" if state.get("emergency_fund_months", 0) >= 6
                      else "underfunded",
        },
        "debt": {
            "monthly_obligations": state.get("monthly_loan_payment", 0),
            "debt_to_income": state.get("debt_ratio", 0),
            "status": "healthy" if state.get("debt_ratio", 0) <= 0.30
                      else "stretched",
        },
        "savings": {
            "rate": state.get("savings_rate", 0),
            "benchmark": 0.20,
            "status": "on_track" if state.get("savings_rate", 0) >= 0.10
                      else "behind",
        },
        "financial_personality": {
            "type": state.get("financial_personality"),
            "confidence": state.get("personality_confidence"),
        },
        "financial_stability": {
            "income_stability": state.get("income_stability", 0),
            "cashflow_stability": state.get("cashflow_stability", 0),
            "spending_volatility": state.get("spending_volatility", 0),
        },
        "goal_progress": {
            "goals": goals,
            "status": "no_goals_set" if not goals else "tracking",
        },
        "confidence": {
            # how much history backs this Twin — more months, more trust
            "months_of_history": months_hist,
            "data_confidence": round(min(1.0, months_hist / 24), 2),
            "personality_confidence": state.get("personality_confidence"),
        },
        "validation": validate(state),
    }
    report["summary"] = _summary(report)
    return report


def _summary(r: dict) -> str:
    fh, cf, li, de, sa = (r["financial_health"], r["cash_flow"],
                          r["liquidity"], r["debt"], r["savings"])
    parts = [
        f"Financial health is {fh['grade']} ({fh['score']}/100)",
        f"cash flow is {cf['direction']} at {cf['net']:,.0f}/month",
        f"emergency fund covers {li['emergency_fund_months']:.1f} of the "
        f"recommended {li['target_months']} months",
        f"debt takes {de['debt_to_income'] * 100:.0f}% of income",
        f"savings rate is {sa['rate'] * 100:.0f}%",
    ]
    issues = [w for w in r["validation"] if w["severity"] == "error"]
    if issues:
        parts.append(f"{len(issues)} consistency issue(s) flagged")
    return "; ".join(parts) + "."
