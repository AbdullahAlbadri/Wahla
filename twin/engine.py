"""FinancialTwin engine.

The Twin is a living state object: built once from history (via features.py),
then updated incrementally by `apply_event()` — every new transaction, loan,
salary change, or simulated decision mutates the state and recomputes the
derived attributes. The AI layer reasons from `to_dict()`, never from raw
transactions.
"""
import math
from dataclasses import dataclass, field, asdict
from datetime import datetime

from .features import health_score
from .personality import classify, risk_level


def _sanitize(value):
    """Replace NaN/Infinity with None so to_dict() output is always valid JSON.

    Feature engineering on sparse or edge-case data (e.g. a single month of
    history) can still produce a non-finite float somewhere despite the
    guards in features.py — this is the last line of defense so the API
    serializes the Twin instead of 500ing.
    """
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value


@dataclass
class FinancialTwin:
    """Continuously-updated virtual representation of one person's finances."""
    account_id: int
    monthly_income: float = 0.0
    monthly_expenses: float = 0.0
    net_cashflow: float = 0.0
    savings_rate: float = 0.0
    spending_volatility: float = 0.0
    income_stability: float = 0.0
    cashflow_stability: float = 0.0
    debt_ratio: float = 0.0
    monthly_loan_payment: float = 0.0
    current_balance: float = 0.0
    emergency_fund_months: float = 0.0
    detected_salary: float = 0.0
    weekend_spending_ratio: float = 0.0
    cash_usage_ratio: float = 0.0
    overdraft_months: int = 0
    months_of_history: int = 0
    financial_health_score: float = 0.0
    financial_personality: str = "balanced_saver"
    personality_confidence: float = 0.5
    personality_scores: dict = field(default_factory=dict)
    risk_level: str = "medium"
    memory: list = field(default_factory=list)
    recurring_payments: list = field(default_factory=list)
    category_ratios: dict = field(default_factory=dict)
    demographics: dict = field(default_factory=dict)
    goals: list = field(default_factory=list)
    forecast: dict = field(default_factory=dict)
    last_updated: str = ""
    event_log: list = field(default_factory=list)

    # ---------- construction ----------

    @classmethod
    def from_features(cls, account_id: int, features: dict,
                      demographics: dict | None = None,
                      memory: list | None = None) -> "FinancialTwin":
        ratios = {k: v for k, v in features.items() if k.endswith("_ratio")
                  and k not in ("debt_ratio", "weekend_spending_ratio", "cash_usage_ratio")}
        core = {k: v for k, v in features.items()
                if k in cls.__dataclass_fields__ and not k.endswith("_ratio")
                or k in ("debt_ratio", "weekend_spending_ratio", "cash_usage_ratio")}
        twin = cls(account_id=account_id, **core)
        twin.category_ratios = ratios
        twin.demographics = demographics or {}
        twin.memory = memory or []
        twin._refresh()
        return twin

    # ---------- derived state ----------

    def _refresh(self):
        """Recompute every derived attribute after any state change."""
        self.net_cashflow = round(self.monthly_income - self.monthly_expenses, 2)
        self.savings_rate = round(self.net_cashflow / self.monthly_income, 4) \
            if self.monthly_income else 0.0
        self.debt_ratio = round(self.monthly_loan_payment / self.monthly_income, 4) \
            if self.monthly_income else 0.0
        self.emergency_fund_months = round(self.current_balance / self.monthly_expenses, 2) \
            if self.monthly_expenses else 0.0
        state = asdict(self)
        self.financial_health_score = health_score(state)
        state["financial_health_score"] = self.financial_health_score
        p = classify(state)
        self.financial_personality = p["personality"]
        self.personality_confidence = p["confidence"]
        self.personality_scores = p["scores"]
        self.forecast = self._forecast()
        state["forecast"] = self.forecast
        self.risk_level = risk_level(state)
        self.last_updated = datetime.now().isoformat(timespec="seconds")

    def _forecast(self, horizon_months: int = 24) -> dict:
        """Simple deterministic projection of balance under current behavior."""
        balances = []
        b = self.current_balance
        for _ in range(horizon_months):
            b += self.net_cashflow
            balances.append(round(b, 2))
        return {
            "horizon_months": horizon_months,
            "projected_balances": balances,
            "balance_in_12m": balances[11],
            "balance_in_24m": balances[23],
            "months_to_zero": next(
                (i + 1 for i, v in enumerate(balances) if v < 0), None),
        }

    # ---------- live updates ----------

    def apply_event(self, event: dict) -> dict:
        """Update the Twin from a financial event. Returns a change report.

        event = {"type": ..., **params} — types:
          transaction        {amount (+/-), category}
          salary_change      {new_salary} or {delta}
          new_loan           {principal, duration_months, annual_rate}
          loan_payoff        {monthly_payment}
          new_subscription   {monthly_amount, name}
          cancel_subscription{monthly_amount}
          rent_change        {delta}
          one_off_expense    {amount}
          investment         {monthly_amount}
        """
        before = self.snapshot()
        etype = event["type"]

        if etype == "transaction":
            self.current_balance += event["amount"]
            # running-average update of monthly expense profile
            if event["amount"] < 0 and self.months_of_history:
                self.monthly_expenses += abs(event["amount"]) / max(self.months_of_history, 1)

        elif etype == "salary_change":
            new = event.get("new_salary", self.monthly_income + event.get("delta", 0))
            self.monthly_income = round(new, 2)
            self.detected_salary = self.monthly_income

        elif etype == "new_loan":
            payment = amortized_payment(
                event["principal"], event.get("annual_rate", 0.06),
                event["duration_months"])
            self.monthly_loan_payment += payment
            # historical loan payments arrive as transactions and are already
            # inside monthly_expenses; a simulated loan must add its payment
            # here too, or cashflow and the 24m forecast would ignore it
            self.monthly_expenses += payment
            self.current_balance += event.get("disbursed_to_account", 0)
            event["monthly_payment"] = round(payment, 2)

        elif etype == "loan_payoff":
            self.monthly_loan_payment = max(
                0.0, self.monthly_loan_payment - event["monthly_payment"])
            self.monthly_expenses = max(
                0.0, self.monthly_expenses - event["monthly_payment"])

        elif etype == "new_subscription":
            self.monthly_expenses += event["monthly_amount"]
            self.recurring_payments.append({
                "amount": event["monthly_amount"],
                "category": event.get("name", "subscription"),
                "months_observed": 0, "monthly": True})

        elif etype == "cancel_subscription":
            self.monthly_expenses = max(
                0.0, self.monthly_expenses - event["monthly_amount"])

        elif etype == "rent_change":
            self.monthly_expenses += event["delta"]

        elif etype == "one_off_expense":
            self.current_balance -= event["amount"]

        elif etype == "investment":
            self.monthly_expenses += event["monthly_amount"]  # cash out of account

        else:
            raise ValueError(f"unknown event type: {etype}")

        self._refresh()
        after = self.snapshot()
        report = diff_snapshots(before, after)
        self.event_log.append({"event": event, "changes": report,
                               "at": self.last_updated})
        # the Twin remembers: live events join the historical timeline
        self.memory.append({
            "date": self.last_updated[:10], "type": etype,
            "title": etype.replace("_", " "),
            "amount": event.get("amount") or event.get("monthly_amount")
                      or event.get("principal") or event.get("delta"),
            "source": "live"})
        return report

    # ---------- output ----------

    def snapshot(self) -> dict:
        keys = ["monthly_income", "monthly_expenses", "net_cashflow", "savings_rate",
                "debt_ratio", "current_balance", "emergency_fund_months",
                "financial_health_score", "financial_personality",
                "personality_confidence", "risk_level", "monthly_loan_payment"]
        return {k: getattr(self, k) for k in keys}

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("event_log", None)
        return _sanitize(d)


def amortized_payment(principal: float, annual_rate: float, months: int) -> float:
    """Standard amortized monthly payment."""
    if months <= 0:
        return 0.0
    r = annual_rate / 12
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def diff_snapshots(before: dict, after: dict) -> list[dict]:
    """Which Twin attributes changed and by how much — feeds AI explanations."""
    changes = []
    for k, b in before.items():
        a = after[k]
        if a != b:
            changes.append({"attribute": k, "before": b, "after": a,
                            "delta": round(a - b, 4) if isinstance(a, (int, float)) else None})
    return changes
