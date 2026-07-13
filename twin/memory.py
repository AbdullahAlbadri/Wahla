"""Twin Memory — milestone timeline extracted from account history.

A Digital Twin remembers what happened to it. This module scans the
cleaned history once at build time and produces a chronological list of
significant financial events; afterwards `engine.apply_event()` appends
live events to the same timeline.

Milestone types detected from history:
  salary_detected     first month a recurring salary appears
  salary_change       sustained shift (>15%) in recurring income
  loan_granted        from the loans table (real outcome attached)
  loan_finished       loan contract ended (repaid or defaulted)
  large_purchase      debit > LARGE_PURCHASE_FACTOR x median debit
  first_overdraft     first month balance went negative
"""
import pandas as pd

LARGE_PURCHASE_FACTOR = 8
SALARY_SHIFT_THRESHOLD = 0.15
MAX_LARGE_PURCHASES = 5


def _month_str(period) -> str:
    return str(period)


def build_timeline(acct_tx: pd.DataFrame, acct_loans: pd.DataFrame) -> list[dict]:
    events: list[dict] = []

    # --- salary detection & changes ---
    credits = acct_tx[acct_tx["signed_amount"] > 0]
    if not credits.empty:
        monthly_max = credits.groupby("month")["signed_amount"].max()
        if len(monthly_max) >= 3:
            first = monthly_max.index[0]
            events.append({
                "date": _month_str(first), "type": "salary_detected",
                "title": "Recurring income detected",
                "amount": round(float(monthly_max.iloc[:3].median()), 2)})
            # sustained shifts: compare 3-month rolling medians
            rolled = monthly_max.rolling(3).median().dropna()
            prev = rolled.iloc[0]
            for period, val in rolled.items():
                if prev and abs(val - prev) / prev > SALARY_SHIFT_THRESHOLD:
                    events.append({
                        "date": _month_str(period),
                        "type": "salary_change",
                        "title": f"Income {'increased' if val > prev else 'decreased'}",
                        "amount": round(float(val), 2),
                        "previous": round(float(prev), 2)})
                    prev = val

    # --- loans (with real outcomes) ---
    for _, l in acct_loans.iterrows():
        events.append({
            "date": str(l["granted_date"].date()) if pd.notna(l["granted_date"]) else None,
            "type": "loan_granted",
            "title": f"Loan granted ({l['duration']:.0f} months)",
            "amount": round(float(l["amount"]), 2),
            "monthly_payment": round(float(l["payments"]), 2),
            "outcome": l["status"]})
        if l["status"] in ("finished_ok", "defaulted"):
            events.append({
                "date": None, "type": "loan_finished",
                "title": "Loan repaid in full" if l["status"] == "finished_ok"
                         else "Loan defaulted",
                "amount": round(float(l["amount"]), 2),
                "outcome": l["status"]})

    # --- large purchases ---
    debits = acct_tx[acct_tx["signed_amount"] < 0]
    if not debits.empty:
        median_debit = debits["amount"].median()
        big = debits[debits["amount"] > LARGE_PURCHASE_FACTOR * median_debit]
        big = big.nlargest(MAX_LARGE_PURCHASES, "amount")
        for _, r in big.iterrows():
            events.append({
                "date": str(r["trans_date"].date()),
                "type": "large_purchase",
                "title": f"Large {r['category']} payment",
                "amount": round(float(r["amount"]), 2)})

    # --- first overdraft ---
    negative = acct_tx[acct_tx["balance"] < 0].sort_values("trans_date")
    if not negative.empty:
        events.append({
            "date": str(negative.iloc[0]["trans_date"].date()),
            "type": "first_overdraft",
            "title": "Account went into overdraft",
            "amount": round(float(negative.iloc[0]["balance"]), 2)})

    events.sort(key=lambda e: e["date"] or "9999")
    return events
