"""Is there a stronger single predictor of real default hiding among the
~20 features build_account_features() computes, beyond the 4 that feed
health_score? Cheap to check, doesn't need more labeled data — if nothing
beats 0.561, that's more evidence the ceiling here is data-scale, not
feature choice. If something does, it's a real, actionable finding.

Same leakage-free extraction (pre-loan history only) as health_score_auc.py.

Run: python3 analysis/feature_scan.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd

from twin.data_loader import load_all
from twin.features import build_account_features

MIN_MONTHS_HISTORY = 6

CANDIDATE_FEATURES = [
    "monthly_income", "monthly_expenses", "net_cashflow", "savings_rate",
    "spending_volatility", "income_stability", "cashflow_stability",
    "debt_ratio", "monthly_loan_payment", "current_balance",
    "avg_monthly_balance", "emergency_fund_months", "detected_salary",
    "weekend_spending_ratio", "cash_usage_ratio", "overdraft_months",
    "months_of_history", "financial_health_score",
]


def auc(scores, labels):
    n = len(scores)
    order = sorted(range(n), key=lambda i: scores[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and scores[order[j + 1]] == scores[order[i]]:
            j += 1
        avg_rank = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg_rank
        i = j + 1
    n_pos, n_neg = sum(labels), n - sum(labels)
    if n_pos == 0 or n_neg == 0:
        return None
    rank_sum_pos = sum(ranks[i] for i in range(n) if labels[i] == 1)
    return (rank_sum_pos - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def main():
    print("loading + cleaning data...", file=sys.stderr)
    data = load_all()
    tx, loans = data["transactions"], data["loans"]
    outcomes = loans[loans["status"].isin(["finished_ok", "defaulted"])]

    rows = []
    for _, loan in outcomes.iterrows():
        acct_id, granted = loan["account_id"], loan["granted_date"]
        acct_tx = tx[(tx["account_id"] == acct_id) & (tx["trans_date"] < granted)]
        if acct_tx.empty or acct_tx["month"].nunique() < MIN_MONTHS_HISTORY:
            continue
        prior_loans = loans[(loans["account_id"] == acct_id)
                             & (loans["granted_date"] < granted)
                             & (loans["loan_id"] != loan["loan_id"])]
        feats = build_account_features(acct_tx, prior_loans)
        if not feats:
            continue
        row = {k: feats.get(k) for k in CANDIDATE_FEATURES}
        row["defaulted"] = 1 if loan["status"] == "defaulted" else 0
        rows.append(row)

    df = pd.DataFrame(rows)
    y = df["defaulted"].values
    print(f"\n{len(df)} examples ({y.sum()} defaulted, {len(y)-y.sum()} repaid)\n")
    print(f"{'feature':24s} {'AUC (raw)':>10s} {'AUC (best direction)':>22s}")
    print("-" * 58)

    results = []
    for feat in CANDIDATE_FEATURES:
        vals = df[feat].astype(float).values
        a = auc(list(vals), list(y))
        if a is None:
            continue
        best = max(a, 1 - a)
        direction = "higher->default" if a > 0.5 else "lower->default"
        results.append((feat, a, best, direction))

    results.sort(key=lambda r: -r[2])
    for feat, a, best, direction in results:
        flag = "  <-- beats health_score's 0.561" if best > 0.561 else ""
        print(f"{feat:24s} {a:>10.3f} {best:>18.3f} ({direction}){flag}")

    print(f"\nFor reference, financial_health_score's own discrimination: "
          f"{max(r[2] for r in results if r[0]=='financial_health_score'):.3f}")


if __name__ == "__main__":
    main()
