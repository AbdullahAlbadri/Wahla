"""Backtest the 24-month linear balance forecast against real future balances.

For each account with enough history: cut at a point in time, build the
Twin from data strictly BEFORE the cutoff, forecast HORIZON_MONTHS forward,
and compare to the REAL balance that many months later in the account's
actual history. No hackathon claim currently backs this number — this is
the "prove it" backtest.

Run: python3 analysis/forecast_backtest.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from twin.data_loader import load_all
from twin.features import build_account_features
from twin.engine import FinancialTwin

HORIZON_MONTHS = 6
MIN_MONTHS_BEFORE = 6
MIN_MONTHS_AFTER = HORIZON_MONTHS


def main():
    print("loading + cleaning data...", file=sys.stderr)
    data = load_all()
    tx = data["transactions"]
    loans = data["loans"]

    rows = []
    skipped_short = 0
    for acct_id, acct_tx in tx.groupby("account_id"):
        acct_tx = acct_tx.sort_values("trans_date")
        months = sorted(acct_tx["month"].unique())
        if len(months) < MIN_MONTHS_BEFORE + MIN_MONTHS_AFTER:
            skipped_short += 1
            continue

        # cutoff: leave exactly MIN_MONTHS_AFTER months of real future to check against
        cutoff_idx = len(months) - MIN_MONTHS_AFTER - 1
        cutoff_month = months[cutoff_idx]
        cutoff_date = acct_tx.loc[acct_tx["month"] == cutoff_month, "trans_date"].max()

        before = acct_tx[acct_tx["trans_date"] <= cutoff_date]
        after = acct_tx[acct_tx["trans_date"] > cutoff_date]
        if before["month"].nunique() < MIN_MONTHS_BEFORE:
            skipped_short += 1
            continue

        target_date = cutoff_date + pd.DateOffset(months=HORIZON_MONTHS)
        actual_window = after[after["trans_date"] <= target_date]
        if actual_window.empty:
            continue
        actual_balance = float(actual_window.sort_values("trans_date").iloc[-1]["balance"])

        acct_loans = loans[(loans["account_id"] == acct_id)
                            & (loans["granted_date"] <= cutoff_date)]
        feats = build_account_features(before, acct_loans)
        if not feats:
            continue

        twin = FinancialTwin.from_features(acct_id, feats)
        predicted_balance = twin.forecast["projected_balances"][HORIZON_MONTHS - 1]

        rows.append({
            "account_id": acct_id,
            "predicted": predicted_balance,
            "actual": actual_balance,
            "error": predicted_balance - actual_balance,
            "abs_error": abs(predicted_balance - actual_balance),
        })

    df = pd.DataFrame(rows)
    print(f"\n{len(df)} accounts usable for a {HORIZON_MONTHS}-month backtest "
          f"(skipped {skipped_short} with insufficient history)\n")

    mae = df["abs_error"].mean()
    median_ae = df["abs_error"].median()
    bias = df["error"].mean()
    median_actual = df["actual"].abs().median()

    print(f"Mean absolute error (MAE):    {mae:,.0f}")
    print(f"Median absolute error:        {median_ae:,.0f}")
    print(f"Median |actual balance|:      {median_actual:,.0f}")
    print(f"MAE as % of median balance:   {mae / max(median_actual, 1) * 100:.1f}%")
    print(f"Mean signed error (bias):     {bias:,.0f}  "
          f"({'forecast overshoots (too optimistic)' if bias > 0 else 'forecast undershoots (too pessimistic)'})")

    within_20pct = (df["abs_error"] <= 0.20 * df["actual"].abs().clip(lower=1)).mean()
    print(f"Share of forecasts within 20% of actual: {within_20pct * 100:.1f}%")


if __name__ == "__main__":
    main()
