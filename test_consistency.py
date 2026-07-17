"""Consistency audit — do independently-coded endpoints agree with each
other when they're describing the same underlying decision?

The architecture is already strongly consistent by construction (every
endpoint reads the same in-memory Twin snapshot, simulations never mutate
the real Twin, validation.py runs on every simulation) — confirmed by
reading the actual data flow, not assumed. The one real gap: /api/simulate
and /api/alternatives are two separately-coded call sites that both run a
"new_subscription" scenario through SimulationEngine — nothing enforces
they'd stay in agreement if one were edited without the other. This
mutation-tests that assumption instead of taking it on faith.

Run: python3 test_consistency.py
"""
import sys

import api
from api import Decision, SuggestionsRequest

FAILURES = []


def check(name: str, cond: bool, detail: str = ""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        FAILURES.append(name)


def test_simulate_and_alternatives_agree():
    print("\n== /api/simulate and /api/alternatives agree on the same scenario ==")
    for account_id in (21, 19, 2):
        monthly, months = 500.0, 6

        # Both should be running an equivalent "subscription" event against
        # the same Twin — /api/simulate via _decision_events(), /api/alternatives
        # via its own separately-coded sim.new_subscription() call.
        sim_result = api.simulate(account_id, Decision(
            type="subscription", monthly=monthly, months=months, hasDownPayment=False))
        alt_result = api.alternatives(account_id, monthly=monthly, months=months)

        check(f"account {account_id}: same verdict for the same subscription amount",
              sim_result["verdict"] == alt_result["current_verdict"],
              f"simulate={sim_result['verdict']} alternatives={alt_result['current_verdict']}")


def test_suggestions_and_twin_share_source():
    print("\n== suggestions and the live Twin snapshot agree on current_balance ==")
    for account_id in (21, 19, 2):
        twin_state = api._twin(account_id).to_dict()
        fired = api.generate_suggestions(twin_state, signals={"in_savings_product": False})
        idle = next((s for s in fired if s["type"] == "idle_cash_savings"), None)
        if idle is None:
            check(f"account {account_id}: no idle_cash_savings fired (nothing to cross-check)", True)
            continue
        # the suggested sweep amount must never exceed the real avg_monthly_balance
        # it was computed from — a basic sanity bound that would catch a stale
        # or double-counted figure if the two code paths ever drifted.
        check(f"account {account_id}: sweep_amount does not exceed avg_monthly_balance",
              idle["sweep_amount"] <= twin_state["avg_monthly_balance"],
              f"sweep={idle['sweep_amount']} balance={twin_state['avg_monthly_balance']}")


def test_mutation_catches_a_real_drift():
    """Prove this suite would actually fail on a real drift, not just always
    pass — temporarily breaks alternatives' verdict source and confirms the
    check above catches it, then restores the original function.
    """
    print("\n== mutation test: the agreement check actually catches drift ==")
    original = api.alternatives

    def broken_alternatives(account_id: int, monthly: float, months: int):
        result = original(account_id, monthly, months)
        result["current_verdict"] = "safe" if result["current_verdict"] != "safe" else "dangerous"
        return result

    api.alternatives = broken_alternatives
    try:
        sim_result = api.simulate(21, Decision(type="subscription", monthly=500.0, months=6, hasDownPayment=False))
        alt_result = api.alternatives(21, monthly=500.0, months=6)
        caught = sim_result["verdict"] != alt_result["current_verdict"]
        check("deliberately-broken verdict is detected as a mismatch", caught)
    finally:
        api.alternatives = original


if __name__ == "__main__":
    test_simulate_and_alternatives_agree()
    test_suggestions_and_twin_share_source()
    test_mutation_catches_a_real_drift()
    print(f"\n{'ALL TESTS PASSED' if not FAILURES else f'{len(FAILURES)} FAILURES: {FAILURES}'}")
    sys.exit(1 if FAILURES else 0)
