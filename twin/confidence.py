"""Confidence scoring — shared by simulate/forecast/suggestions responses.

Two confidence signals already existed before this module: personality_
confidence (a margin-of-victory score, unrelated to data volume) and
report.py's data_confidence = min(1.0, months_of_history/24). Nothing
gave a per-prediction confidence. This module is the single place that
logic lives, so every caller uses the same semantics (ties into the
consistency requirement — two endpoints must never call the same
underlying situation "high confidence" here and "low confidence" there).
"""


def data_confidence(months_of_history: int) -> float:
    """Same formula report.py already uses — re-exposed here as the one
    shared building block every other confidence score is built from."""
    return round(min(1.0, months_of_history / 24), 3)


def label(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.4:
        return "medium"
    return "low"


def verdict_confidence(twin_state: dict, after_state: dict) -> dict:
    """How confident is a simulation verdict?

    Two real, independent factors: how much history backs the account
    (data_confidence), and how far the resulting net_cashflow lands from
    the actual decision boundary the verdict logic uses (0, per
    simulation.py's `savings_rate < 0` check) — a decision that lands deep
    in negative territory is unambiguous; one that barely crosses is not.
    """
    months = twin_state.get("months_of_history", 0)
    dc = data_confidence(months)
    net = after_state.get("net_cashflow", 0)
    income = after_state.get("monthly_income", 0) or 1
    # distance from the zero-cashflow boundary, normalized by income so it's
    # comparable across accounts — clipped to [0, 1] via a soft cap at 50%
    # of income either side of zero.
    distance = min(1.0, abs(net) / (income * 0.5)) if income else 0.0
    score = round(0.5 * dc + 0.5 * distance, 3)
    return {"score": score, "label": label(score)}


def forecast_confidence(twin_state: dict) -> dict:
    """Low volatility + long history -> trust the linear forecast more."""
    months = twin_state.get("months_of_history", 0)
    dc = data_confidence(months)
    stability = twin_state.get("cashflow_stability", 0.0)
    score = round(0.5 * dc + 0.5 * max(0.0, min(1.0, stability)), 3)
    return {"score": score, "label": label(score)}


def suggestion_confidence(signal_count: int, max_signals: int = 3) -> dict:
    """More independent real signals firing -> higher confidence.

    signal_count is the length of that suggestion's own `basis` list
    (twin/suggestions.py) — reuses data already computed for explainability
    instead of a second, disconnected confidence computation.
    """
    score = round(min(1.0, signal_count / max_signals), 3) if max_signals else 0.0
    return {"score": score, "label": label(score)}
