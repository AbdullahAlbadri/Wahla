"""Build the live-demo payload: two real contrasting personas + simulations.

Account 2  — goal-oriented planner who repaid a real loan successfully.
Account 19 — impulse spender whose real loan defaulted.

Same engine, same question ("can I afford a 20k car?"), opposite answers —
that is the demo. Output: data/processed/demo_story.json (frontend-ready).

Run: python3 make_demo.py   (rebuilds the two twins from raw data, so the
full lineage raw → twin → simulation is reproducible live)
"""
import json
import sys

from twin import config
from twin.data_loader import load_all
from twin.features import build_account_features
from twin.memory import build_timeline
from twin.engine import FinancialTwin
from twin.simulation import SimulationEngine

# Two real clients with nearly IDENTICAL incomes (~1,400-1,600/month) and
# opposite financial lives — same car, same question, opposite verdicts.
DEMO_ACCOUNTS = {
    21: "The Disciplined Saver — saves 56% of income, 8.5 months of runway",
    19: "The Impulse Spender — real loan ended in default, overdraft history",
}
CAR_PRICE = 6000


def build_twin(data: dict, acct_id: int) -> FinancialTwin:
    tx = data["transactions"]
    acct_tx = tx[tx["account_id"] == acct_id]
    acct_loans = data["loans"][data["loans"]["account_id"] == acct_id]
    feats = build_account_features(acct_tx, acct_loans)
    timeline = build_timeline(acct_tx, acct_loans)
    return FinancialTwin.from_features(acct_id, feats, memory=timeline)


def main():
    print("loading data...", file=sys.stderr)
    data = load_all()

    story = {}
    for acct_id, headline in DEMO_ACCOUNTS.items():
        twin = build_twin(data, acct_id)
        sim = SimulationEngine(twin)
        story[str(acct_id)] = {
            "headline": headline,
            "twin": twin.to_dict(),
            "what_if_car": sim.buy_car(CAR_PRICE),
            "what_if_compare": sim.compare([
                {"method": "buy_car", "args": {"price": CAR_PRICE}},
                {"method": "buy_with_bnpl", "args": {"price": CAR_PRICE,
                                                     "installments": 12}},
                {"method": "invest_monthly", "args": {"monthly_amount": 350}},
            ]),
        }
        r = story[str(acct_id)]["what_if_car"]
        print(f"\naccount {acct_id} ({twin.financial_personality}, "
              f"health {twin.financial_health_score}):")
        print(f"  car verdict: {r['verdict']}")
        print(f"  {r['explanation']}")

    out = config.OUTPUT_DIR / "demo_story.json"
    with open(out, "w") as f:
        json.dump(story, f, indent=1)
    print(f"\ndemo payload → {out}")


if __name__ == "__main__":
    main()
