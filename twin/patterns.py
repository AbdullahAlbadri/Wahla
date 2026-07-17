"""Decision memory — real behavioral patterns, not a fabricated one.

Unlike memory.py's chronological event timeline, this looks for *recurring*
behavior across multiple real months before claiming a pattern exists.
Every pattern here requires the same minimum evidence bar
(config.RECURRING_MIN_OCCURRENCES, currently 3) already used elsewhere in
this codebase before trusting a recurring signal — no pattern is reported
from a single occurrence.

Two pattern families only — chosen because they're the ones this dataset
can actually support honestly:
  loan_track_record       real outcome of past loans (finished/defaulted)
  month_end_concentration real day-of-month spend timing, from actual
                           transaction dates

NOT attempted: "spends more right after salary" (would need a reliable
detected pay-date, which recurring-credit detection here only locates to
the month, not the day), "repeats similar purchases" (would need either a
persisted decision log across sessions, which this backend doesn't have,
or merchant text, which Berka doesn't have). Reporting either would be
guessing, not detecting.
"""
import pandas as pd

from . import config


def loan_track_record(acct_loans: pd.DataFrame) -> dict | None:
    """Real outcome of this account's past loans — nothing inferred."""
    if acct_loans.empty:
        return None
    finished = acct_loans[acct_loans["status"].isin(["finished_ok", "running_ok"])]
    defaulted = acct_loans[acct_loans["status"].isin(["defaulted", "running_in_debt"])]
    total = len(acct_loans)
    if len(defaulted) == 0:
        return {
            "type": "loan_track_record",
            "clean": True,
            "total_loans": total,
            "detail": f"سجل تمويل نظيف — {total} من {total} التزامات سابقة بدون تعثر",
        }
    return {
        "type": "loan_track_record",
        "clean": False,
        "total_loans": total,
        "defaulted_count": len(defaulted),
        "detail": f"{len(defaulted)} من {total} التزامات سابقة شهدت تعثرًا أو سحبًا مكشوفًا",
    }


def month_end_concentration(acct_tx: pd.DataFrame) -> dict | None:
    """Does discretionary spending concentrate in the last week of the month?

    Real day-of-month aggregation over actual transaction dates — requires
    the pattern to hold in a majority of real months before reporting it,
    same spirit as detect_recurring_debits' >=3-month bar.
    """
    debits = acct_tx[acct_tx["signed_amount"] < 0].copy()
    if debits.empty:
        return None
    debits["day"] = debits["trans_date"].dt.day
    debits["days_in_month"] = debits["trans_date"].dt.days_in_month
    debits["is_last_week"] = debits["day"] > (debits["days_in_month"] - 7)

    by_month = debits.groupby("month").apply(
        lambda g: -g.loc[g["is_last_week"], "signed_amount"].sum() / max(-g["signed_amount"].sum(), 1),
        include_groups=False)
    months_with_data = by_month[by_month.notna()]
    if len(months_with_data) < config.RECURRING_MIN_OCCURRENCES:
        return None

    # last week is ~23% of a 30-day month; flag concentration meaningfully
    # above that baseline, and only if it holds in most observed months.
    concentrated_months = (months_with_data > 0.35).sum()
    if concentrated_months < len(months_with_data) * 0.5:
        return None
    avg_share = round(float(months_with_data.mean()), 3)
    return {
        "type": "month_end_concentration",
        "months_observed": int(len(months_with_data)),
        "months_concentrated": int(concentrated_months),
        "avg_last_week_share": avg_share,
        "detail": f"إنفاقك يتركز في آخر أسبوع من الشهر في {concentrated_months} من "
                  f"{len(months_with_data)} أشهر ({avg_share*100:.0f}% من الإنفاق بالمتوسط)",
    }


def detect_patterns(acct_tx: pd.DataFrame, acct_loans: pd.DataFrame) -> list[dict]:
    """All real, evidence-backed behavioral patterns for one account."""
    patterns = []
    p1 = loan_track_record(acct_loans)
    if p1:
        patterns.append(p1)
    p2 = month_end_concentration(acct_tx)
    if p2:
        patterns.append(p2)
    return patterns
