"""What-if Simulation Engine.

Every simulation:
  1. deep-copies the Twin (the real Twin is never mutated by a what-if)
  2. applies the decision as events
  3. returns before/after states + attribute-level diff + verdict

This is the layer the AI recommendation engine calls.
"""
import copy

from dataclasses import asdict

from .confidence import verdict_confidence
from .diff import twin_diff
from .engine import FinancialTwin
from .explain import explain, before_after_card
from .report import health_report
from .validation import validate


# verdict thresholds on the *post-decision* twin
def _verdict(twin: FinancialTwin) -> str:
    if twin.forecast.get("months_to_zero") and twin.forecast["months_to_zero"] <= 12:
        return "dangerous"
    if twin.debt_ratio > 0.40 or twin.savings_rate < 0:
        return "risky"
    if twin.savings_rate < 0.10 or twin.emergency_fund_months < 3:
        return "caution"
    return "safe"


class SimulationEngine:
    def __init__(self, twin: FinancialTwin):
        self.twin = twin

    def _run(self, events: list[dict], label: str) -> dict:
        sim = copy.deepcopy(self.twin)
        sim.event_log = []
        all_changes = []
        for e in events:
            all_changes.extend(sim.apply_event(e))

        before, after = self.twin.snapshot(), sim.snapshot()
        result = {
            "simulation": label,
            "verdict": _verdict(sim),
            # explicit state transition: State A → event(s) → State B
            "transition": {
                "from_state": before,
                "events": events,
                "to_state": after,
            },
            "before": before,
            "after": after,
            "twin_diff": twin_diff(before, after),
            "changed_attributes": all_changes,
            "forecast_after": sim.forecast,
            "events_applied": events,
            # consistency check on the post-event Twin, never skipped
            "validation": validate(asdict(sim)),
            "health_report": health_report(asdict(sim)),
        }
        result["explanation"] = explain(result)
        result["before_after_card"] = before_after_card(result)
        result["confidence"] = verdict_confidence(asdict(sim), after)
        return result

    # ---- supported what-if scenarios ----

    def buy_item(self, price: float, label: str = "purchase") -> dict:
        """One-off purchase paid from balance (electronics, furniture...)."""
        return self._run([{"type": "one_off_expense", "amount": price}],
                         f"buy_{label}_{price:.0f}")

    def buy_with_bnpl(self, price: float, installments: int = 4) -> dict:
        """BNPL: split into equal fixed-term installments, no interest.

        Unlike an ongoing subscription, this stops weighing on cash flow
        once `installments` months have passed — see fixed_term_commitment
        in engine.py.
        """
        monthly = price / installments
        return self._run(
            [{"type": "fixed_term_commitment", "monthly_amount": monthly,
              "term_months": installments, "name": f"bnpl_{installments}x"}],
            f"bnpl_{price:.0f}_over_{installments}m")

    def take_loan(self, principal: float, duration_months: int,
                  annual_rate: float = 0.06, disbursed: bool = True) -> dict:
        """Bank loan: monthly amortized payment + optional cash-in."""
        return self._run(
            [{"type": "new_loan", "principal": principal,
              "duration_months": duration_months, "annual_rate": annual_rate,
              "disbursed_to_account": principal if disbursed else 0}],
            f"loan_{principal:.0f}_{duration_months}m")

    def buy_car(self, price: float, down_payment_pct: float = 0.20,
                duration_months: int = 60, annual_rate: float = 0.05) -> dict:
        down = price * down_payment_pct
        financed = price - down
        return self._run(
            [{"type": "one_off_expense", "amount": down},
             {"type": "new_loan", "principal": financed,
              "duration_months": duration_months, "annual_rate": annual_rate,
              "disbursed_to_account": 0}],
            f"car_{price:.0f}")

    def new_subscription(self, monthly_amount: float, name: str = "subscription") -> dict:
        return self._run(
            [{"type": "new_subscription", "monthly_amount": monthly_amount, "name": name}],
            f"subscription_{name}")

    def rent_increase(self, delta: float) -> dict:
        return self._run([{"type": "rent_change", "delta": delta}],
                         f"rent_change_{delta:+.0f}")

    def salary_change(self, new_salary: float) -> dict:
        return self._run([{"type": "salary_change", "new_salary": new_salary}],
                         f"salary_to_{new_salary:.0f}")

    def medical_emergency(self, cost: float) -> dict:
        return self._run([{"type": "one_off_expense", "amount": cost}],
                         f"medical_{cost:.0f}")

    def vacation(self, cost: float) -> dict:
        return self._run([{"type": "one_off_expense", "amount": cost}],
                         f"vacation_{cost:.0f}")

    def invest_monthly(self, monthly_amount: float,
                       annual_return: float = 0.07, horizon_months: int = 120) -> dict:
        """Monthly investment: cash leaves the account, wealth compounds outside it."""
        result = self._run(
            [{"type": "investment", "monthly_amount": monthly_amount}],
            f"invest_{monthly_amount:.0f}_monthly")
        r = annual_return / 12
        fv = monthly_amount * (((1 + r) ** horizon_months - 1) / r)
        result["investment_projection"] = {
            "horizon_months": horizon_months,
            "total_contributed": round(monthly_amount * horizon_months, 2),
            "projected_value": round(fv, 2),
            "projected_gain": round(fv - monthly_amount * horizon_months, 2),
        }
        return result

    def payoff_debt(self, monthly_payment: float) -> dict:
        return self._run([{"type": "loan_payoff", "monthly_payment": monthly_payment}],
                         "debt_payoff")

    def compare(self, scenarios: list[dict]) -> list[dict]:
        """Run several scenarios and rank by resulting health score.

        scenarios = [{"method": "take_loan", "args": {...}}, ...]
        """
        results = []
        for s in scenarios:
            results.append(getattr(self, s["method"])(**s.get("args", {})))
        results.sort(key=lambda r: r["after"]["financial_health_score"], reverse=True)
        return results
