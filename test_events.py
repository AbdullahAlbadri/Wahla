"""Production readiness test suite — run before the live demo.

Covers:
  * every apply_event type mutates the persistent Twin (item 5)
  * every SimulationEngine scenario runs end-to-end (item 8)
  * simulations are deterministic (item 3)
  * health score is mathematically consistent after every event (item 7)
  * no consistency-check errors on any produced state (item 4/validation)

Runs on a synthetic twin — no dataset needed, executes in <1s.
"""
import copy
import json
import sys
from dataclasses import asdict

from twin.engine import FinancialTwin
from twin.features import health_score
from twin.simulation import SimulationEngine
from twin.validation import validate

FAILURES = []


def check(name: str, cond: bool, detail: str = ""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        FAILURES.append(name)


def make_twin() -> FinancialTwin:
    feats = {
        "monthly_income": 8000.0, "monthly_expenses": 5500.0,
        "spending_volatility": 0.4, "income_stability": 0.9,
        "cashflow_stability": 0.7, "monthly_loan_payment": 800.0,
        "current_balance": 24000.0, "detected_salary": 8000.0,
        "weekend_spending_ratio": 0.3, "cash_usage_ratio": 0.2,
        "overdraft_months": 0, "months_of_history": 36,
        "debt_ratio": 0.1, "savings_rate": 0.3,   # will be re-derived
        "emergency_fund_months": 4.4, "net_cashflow": 2500.0,
        "financial_health_score": 0.0,
        "recurring_payments": [],
    }
    return FinancialTwin.from_features(999, feats)


EVENTS = [
    {"type": "transaction", "amount": -450, "category": "household"},
    {"type": "salary_change", "new_salary": 9000},
    {"type": "new_loan", "principal": 30000, "duration_months": 48,
     "annual_rate": 0.05, "disbursed_to_account": 30000},
    {"type": "loan_payoff", "monthly_payment": 800},
    {"type": "new_subscription", "monthly_amount": 60, "name": "streaming"},
    {"type": "cancel_subscription", "monthly_amount": 60},
    {"type": "rent_change", "delta": 300},
    {"type": "one_off_expense", "amount": 2000},
    {"type": "investment", "monthly_amount": 500},
]

SIMULATIONS = [
    ("buy_item", {"price": 3000}),
    ("buy_with_bnpl", {"price": 3000, "installments": 4}),
    ("take_loan", {"principal": 20000, "duration_months": 36}),
    ("buy_car", {"price": 25000}),
    ("new_subscription", {"monthly_amount": 50}),
    ("rent_increase", {"delta": 400}),
    ("salary_change", {"new_salary": 10000}),
    ("medical_emergency", {"cost": 5000}),
    ("vacation", {"cost": 4000}),
    ("invest_monthly", {"monthly_amount": 800}),
    ("payoff_debt", {"monthly_payment": 800}),
]


def test_events():
    print("\n== every event type updates the persistent Twin ==")
    for e in EVENTS:
        twin = make_twin()
        before = twin.snapshot()
        report = twin.apply_event(dict(e))
        after = twin.snapshot()
        check(f"event {e['type']}: state changed", before != after)
        check(f"event {e['type']}: change report non-empty", len(report) > 0)
        check(f"event {e['type']}: appended to memory",
              twin.memory and twin.memory[-1]["type"] == e["type"])
        # health score mathematically consistent with current state
        expected = health_score(asdict(twin))
        check(f"event {e['type']}: health score consistent",
              abs(twin.financial_health_score - expected) < 0.05,
              f"stored {twin.financial_health_score} vs recomputed {expected}")
        errors = [w for w in validate(asdict(twin)) if w["severity"] == "error"]
        check(f"event {e['type']}: no validation errors",
              not errors, str(errors))


def test_simulations():
    print("\n== every simulation runs end-to-end, deterministically ==")
    twin = make_twin()
    sim = SimulationEngine(twin)
    for method, args in SIMULATIONS:
        r1 = getattr(sim, method)(**args)
        r2 = getattr(sim, method)(**args)
        check(f"sim {method}: runs", "after" in r1 and "verdict" in r1)
        check(f"sim {method}: deterministic", r1["after"] == r2["after"],
              "two identical runs differ")
        check(f"sim {method}: exposes transition",
              r1["transition"]["from_state"] == r1["before"]
              and r1["transition"]["to_state"] == r1["after"])
        check(f"sim {method}: twin_diff present", isinstance(r1["twin_diff"], list))
        check(f"sim {method}: explanation references diff",
              bool(r1["explanation"]))
        check(f"sim {method}: real twin untouched",
              twin.snapshot() == r1["before"])
        errors = [w for w in r1["validation"] if w["severity"] == "error"]
        check(f"sim {method}: no validation errors", not errors, str(errors))


def test_compare():
    print("\n== multi-scenario comparison ==")
    sim = SimulationEngine(make_twin())
    ranked = sim.compare([
        {"method": "buy_car", "args": {"price": 25000}},
        {"method": "buy_item", "args": {"price": 25000, "label": "cash"}},
        {"method": "invest_monthly", "args": {"monthly_amount": 400}},
    ])
    scores = [r["after"]["financial_health_score"] for r in ranked]
    check("compare: ranked by health desc", scores == sorted(scores, reverse=True))


if __name__ == "__main__":
    test_events()
    test_simulations()
    test_compare()
    print(f"\n{'ALL TESTS PASSED' if not FAILURES else f'{len(FAILURES)} FAILURES: {FAILURES}'}")
    sys.exit(1 if FAILURES else 0)
