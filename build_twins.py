"""End-to-end pipeline: raw Berka data → cleaned → features → FinancialTwin per account.

Usage:
    python3 build_twins.py                 # build all twins, export JSON
    python3 build_twins.py --account 19    # build + demo simulations for one account
    python3 build_twins.py --inspect 19    # judge mode: full data lineage for one account
"""
import argparse
import json
import sys
import time

from twin import config
from twin.data_loader import load_all
from twin.features import build_account_features
from twin.engine import FinancialTwin
from twin.memory import build_timeline
from twin.simulation import SimulationEngine


def build_all_twins(data: dict, limit: int | None = None) -> dict[int, FinancialTwin]:
    tx = data["transactions"]
    loans = data["loans"]
    accounts = data["accounts"].merge(
        data["districts"], on="district_id", how="left")
    disp = data["dispositions"]
    clients = data["clients"]

    # owner age/gender per account
    owners = (disp[disp["disp_type"] == "O"]
              .merge(clients, on="client_id"))

    twins: dict[int, FinancialTwin] = {}
    account_ids = tx["account_id"].unique()
    if limit:
        account_ids = account_ids[:limit]

    grouped = tx.groupby("account_id")
    t0 = time.time()
    for i, acct_id in enumerate(account_ids):
        acct_tx = grouped.get_group(acct_id)
        acct_loans = loans[loans["account_id"] == acct_id]
        feats = build_account_features(acct_tx, acct_loans)
        if not feats:
            continue
        timeline = build_timeline(acct_tx, acct_loans)
        row = accounts[accounts["account_id"] == acct_id]
        owner = owners[owners["account_id"] == acct_id]
        demo = {}
        if not row.empty:
            demo = {"district": row.iloc[0]["district_name"],
                    "region": row.iloc[0]["region"],
                    "district_avg_salary": float(row.iloc[0]["avg_salary"]),
                    "district_unemployment": float(row.iloc[0]["unemp_96"])}
        if not owner.empty:
            demo["gender"] = owner.iloc[0]["gender"]
            demo["birth_year"] = int(owner.iloc[0]["birth_date"].year)
        twins[int(acct_id)] = FinancialTwin.from_features(
            int(acct_id), feats, demo, memory=timeline)
        if (i + 1) % 500 == 0:
            print(f"  {i+1}/{len(account_ids)} twins built "
                  f"({time.time()-t0:.0f}s)", file=sys.stderr)
    return twins


def export(twins: dict[int, FinancialTwin]):
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = config.OUTPUT_DIR / "twins.json"
    with open(out, "w") as f:
        json.dump({str(k): v.to_dict() for k, v in twins.items()}, f, indent=1)
    print(f"exported {len(twins)} twins → {out}")


def demo_simulations(twin: FinancialTwin):
    sim = SimulationEngine(twin)
    print("\n=== TWIN STATE ===")
    print(json.dumps(twin.snapshot(), indent=2))
    print(f"personality: {twin.financial_personality} "
          f"(confidence {twin.personality_confidence})")
    print("\n=== TWIN MEMORY (timeline) ===")
    for e in twin.memory[:8]:
        print(f"  {e.get('date')}: {e['title']}"
              + (f" — {e['amount']:,.0f}" if e.get("amount") else ""))

    print("\n=== WHAT-IF: buy a car (20k, 20% down, 60m @5%) ===")
    r = sim.buy_car(20000)
    print(f"verdict: {r['verdict']}")
    print(f"explanation: {r['explanation']}")
    print(json.dumps(r["before_after_card"], indent=2))

    print("\n=== WHAT-IF: compare car loan vs cash purchase vs waiting ===")
    ranked = sim.compare([
        {"method": "buy_car", "args": {"price": 20000}},
        {"method": "buy_item", "args": {"price": 20000, "label": "car_cash"}},
        {"method": "invest_monthly", "args": {"monthly_amount": 350}},
    ])
    for r in ranked:
        print(f"  {r['simulation']:30s} verdict={r['verdict']:10s} "
              f"health {r['before']['financial_health_score']} → "
              f"{r['after']['financial_health_score']}")


def inspect_account(data: dict, twin: FinancialTwin, acct_id: int):
    """Judge inspection mode: raw → features → state → event → state' → why."""
    from twin.features import build_account_features
    tx = data["transactions"]
    acct_tx = tx[tx["account_id"] == acct_id]

    print("=" * 72)
    print(f"INSPECTION — account {acct_id} (full data lineage)")
    print("=" * 72)

    print("\n[1] RAW DATA (cleaned transactions feeding this Twin)")
    print(f"    {len(acct_tx):,} transactions, "
          f"{acct_tx['trans_date'].min().date()} → {acct_tx['trans_date'].max().date()}")
    print(acct_tx[["trans_date", "signed_amount", "balance", "trans_type",
                   "operation", "category"]].head(5).to_string(index=False))

    print("\n[2] ENGINEERED FEATURES (features.py — documented formulas)")
    feats = build_account_features(
        acct_tx, data["loans"][data["loans"]["account_id"] == acct_id])
    for k, v in feats.items():
        if not isinstance(v, (list, dict)):
            print(f"    {k:28s} {v}")

    print("\n[3] TWIN STATE (engine.py — derived, persistent)")
    print(json.dumps(twin.snapshot(), indent=4))
    print(f"    memory events: {len(twin.memory)}")

    print("\n[4] SIMULATION EVENT → STATE TRANSITION (simulation.py)")
    sim = SimulationEngine(twin)
    r = sim.take_loan(principal=15000, duration_months=48)
    print(f"    event: loan 15,000 over 48 months")
    print(f"    verdict: {r['verdict']}")

    print("\n[5] TWIN STATE AFTER (with semantic diff — diff.py)")
    for c in r["twin_diff"]:
        reasons = " — because " + " and ".join(c["reasons"]) if c["reasons"] else ""
        print(f"    {c['attribute']:28s} {c['before']} → {c['after']}{reasons}")

    print("\n[6] EXPLANATION (explain.py — derived from the diff, not generated)")
    print(f"    {r['explanation']}")

    print("\n[7] CONSISTENCY CHECK (validation.py)")
    if r["validation"]:
        for w in r["validation"]:
            print(f"    [{w['severity']}] {w['check']}: {w['message']}")
    else:
        print("    all invariants hold")

    print("\n[8] HEALTH REPORT SUMMARY (report.py)")
    print(f"    {r['health_report']['summary']}")

    print("\n[9] ARCHITECTURE ISOLATION PROOF (check_architecture.py)")
    from check_architecture import run_check
    run_check(verbose=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--account", type=int, help="run demo simulations for one account")
    ap.add_argument("--inspect", type=int, help="judge mode: full lineage for one account")
    ap.add_argument("--limit", type=int, help="build only first N accounts (dev mode)")
    args = ap.parse_args()

    print("loading + cleaning data...", file=sys.stderr)
    data = load_all()
    print(f"  transactions: {len(data['transactions']):,} rows after cleaning",
          file=sys.stderr)

    print("building twins...", file=sys.stderr)
    twins = build_all_twins(data, limit=args.limit)
    export(twins)

    if args.account and args.account in twins:
        demo_simulations(twins[args.account])
    elif args.account:
        print(f"account {args.account} not found")

    if args.inspect and args.inspect in twins:
        inspect_account(data, twins[args.inspect], args.inspect)
    elif args.inspect:
        print(f"account {args.inspect} not found")
