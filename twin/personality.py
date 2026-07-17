"""Financial Personality inference.

Each personality gets a 0..1 score computed from engineered Twin features
(never hardcoded labels). The winner is the highest score; confidence is
the winner's margin over the runner-up, normalized:

    confidence = top / (top + second)      # 0.5 = tie, 1.0 = unambiguous

Scores are transparent formulas over documented features, so every
classification is explainable attribute-by-attribute.
"""
import numpy as np


def _clip(x: float) -> float:
    return float(np.clip(x, 0.0, 1.0))


def _scores(f: dict) -> dict[str, float]:
    """f = Twin state as dict (from features.py / engine asdict)."""
    savings = f.get("savings_rate", 0.0)
    volatility = f.get("spending_volatility", 0.0)
    income_stab = f.get("income_stability", 0.0)
    debt = f.get("debt_ratio", 0.0)
    ef_months = f.get("emergency_fund_months", 0.0)
    weekend = f.get("weekend_spending_ratio", 0.0)
    cash = f.get("cash_usage_ratio", 0.0)
    overdrafts = f.get("overdraft_months", 0)
    n_recurring = len(f.get("recurring_payments", []))

    return {
        "financially_disciplined": np.mean([
            _clip(savings / 0.25),               # saves 25%+ of income
            _clip(1 - volatility),               # predictable spending
            1.0 if overdrafts == 0 else 0.0,     # never overdrawn
            _clip(ef_months / 6),                # solid emergency fund
        ]),
        "balanced_saver": np.mean([
            _clip(savings / 0.10),               # saves, modestly
            _clip(1 - abs(savings - 0.10) / 0.10),
            _clip(income_stab),
            _clip(1 - debt / 0.30),
        ]),
        "goal_oriented_planner": np.mean([
            _clip(n_recurring / 5),              # structured commitments
            _clip(income_stab),
            _clip(1 - volatility),
            _clip(savings / 0.15),
        ]),
        "conservative_spender": np.mean([
            _clip(1 - volatility * 2),           # very steady spending
            _clip(1 - weekend * 2),              # weekday-routine spender
            _clip(1 - debt / 0.15),              # avoids credit
            _clip(cash / 0.5),                   # prefers cash
        ]),
        "impulse_shopper": np.mean([
            _clip(weekend / 0.45),               # weekend-heavy spending
            _clip(volatility / 1.0),             # erratic amounts
            _clip(1 - savings / 0.05),           # saves little
        ]),
        "risk_tolerant": np.mean([
            _clip(debt / 0.35),                  # comfortable with leverage
            _clip(savings / 0.05 if savings > 0 else 0),  # but still solvent
            _clip(1 - ef_months / 3),            # thin buffer by choice
        ]),
        "at_risk": np.mean([
            _clip(overdrafts / 3),
            _clip(-savings / 0.10),              # spending exceeds income
            _clip(debt / 0.45),
            _clip(1 - ef_months / 2),
        ]),
    }


def classify(features: dict) -> dict:
    """Return {personality, confidence, scores} — fully explainable."""
    scores = {k: round(float(v), 4) for k, v in _scores(features).items()}
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_name, top = ranked[0]
    second = ranked[1][1]
    confidence = round(top / (top + second), 3) if (top + second) else 0.5
    return {
        "personality": top_name,
        "confidence": confidence,
        "scores": scores,
    }


def risk_level(f: dict) -> str:
    """Low / medium / high risk from Twin state (used in snapshots)."""
    months_to_zero = (f.get("forecast") or {}).get("months_to_zero")
    if (f.get("financial_health_score", 100) < 35
            or f.get("debt_ratio", 0) > 0.40
            or (months_to_zero is not None and months_to_zero <= 12)
            or f.get("savings_rate", 0) < -0.05):
        return "high"
    if (f.get("financial_health_score", 0) >= 60
            and f.get("emergency_fund_months", 0) >= 6
            and f.get("debt_ratio", 1) <= 0.20):
        return "low"
    return "medium"
