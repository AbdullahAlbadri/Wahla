"""Leakage-free validation of financial_health_score against real loan outcomes.

HACKATHON.md claims a 22.8 vs 42.8 mean-score gap between defaulted and
repaid loans, computed from full account history — which includes
transactions AFTER the loan was granted, so a defaulted loan's own
overdrafts/erratic spending can leak into the score that's supposed to
predict it. This recomputes the same comparison using ONLY transactions
strictly before granted_date, and adds a real discrimination metric (AUC)
instead of just two means.

Run: python3 analysis/health_score_auc.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from twin.data_loader import load_all
from twin.features import build_account_features

MIN_MONTHS_HISTORY = 6


def compute_auc(scores: list, labels: list) -> float:
    """Mann-Whitney U based AUC (no sklearn dependency). labels: 1 = positive class."""
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
    n_pos = sum(labels)
    n_neg = n - n_pos
    rank_sum_pos = sum(ranks[i] for i in range(n) if labels[i] == 1)
    return (rank_sum_pos - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def main():
    print("loading + cleaning data...", file=sys.stderr)
    data = load_all()
    tx = data["transactions"]
    loans = data["loans"]

    outcomes = loans[loans["status"].isin(["finished_ok", "defaulted"])]
    print(f"{len(outcomes)} loans with a known real outcome "
          f"(excludes running_ok/running_in_debt — no outcome yet)", file=sys.stderr)

    rows = []
    skipped_short_history = 0
    for _, loan in outcomes.iterrows():
        acct_id = loan["account_id"]
        granted = loan["granted_date"]

        acct_tx = tx[(tx["account_id"] == acct_id) & (tx["trans_date"] < granted)]
        if acct_tx.empty or acct_tx["month"].nunique() < MIN_MONTHS_HISTORY:
            skipped_short_history += 1
            continue

        # only loans this account already had BEFORE this one count toward
        # its pre-loan debt_ratio — this loan itself hasn't been granted yet
        prior_loans = loans[(loans["account_id"] == acct_id)
                             & (loans["granted_date"] < granted)
                             & (loans["loan_id"] != loan["loan_id"])]

        feats = build_account_features(acct_tx, prior_loans)
        if not feats:
            continue

        rows.append({
            "account_id": acct_id,
            "loan_id": loan["loan_id"],
            "health_score": feats["financial_health_score"],
            "months_pre_loan_history": acct_tx["month"].nunique(),
            "defaulted": 1 if loan["status"] == "defaulted" else 0,
        })

    df = pd.DataFrame(rows)
    print(f"\n{len(df)} loans usable (skipped {skipped_short_history} with "
          f"< {MIN_MONTHS_HISTORY} months of pre-loan history)\n")

    defaulted = df[df["defaulted"] == 1]["health_score"]
    repaid = df[df["defaulted"] == 0]["health_score"]
    print(f"mean health_score, DEFAULTED loans (n={len(defaulted)}): {defaulted.mean():.1f}")
    print(f"mean health_score, REPAID loans    (n={len(repaid)}): {repaid.mean():.1f}")

    auc_default = compute_auc(list(df["health_score"]), list(df["defaulted"]))
    print(f"\nAUC (health_score ranking DEFAULTS higher — bad, should be low): {auc_default:.3f}")
    print(f"AUC (health_score ranking REPAYMENT higher — the useful framing): "
          f"{1 - auc_default:.3f}")
    print("  0.5 = no better than chance, 1.0 = perfect discrimination")


if __name__ == "__main__":
    main()
