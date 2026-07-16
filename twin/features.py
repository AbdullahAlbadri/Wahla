"""Feature engineering layer.

Turns cleaned transactions into per-account behavioral features.
Every feature here feeds a FinancialTwin attribute — nothing downstream
touches raw transactions.

Feature documentation
---------------------
monthly_income          median of monthly credit inflow (salary + pension + transfers in)
monthly_expenses        median of monthly debit outflow
net_cashflow            income - expenses (median month)
savings_rate            net_cashflow / income — core solvency signal
spending_volatility     std/mean of monthly expenses — lifestyle predictability
cashflow_stability      1 - CV of monthly net cashflow (clipped 0..1)
income_stability        1 - CV of monthly income — salaried vs irregular earner
debt_ratio              monthly loan payments / monthly income (DTI)
emergency_fund_months   current balance / monthly expenses — months of runway
recurring_payments      standing orders + detected recurring debits
weekend_spending_ratio  share of debit volume on Fri/Sat/Sun — impulse proxy
cash_usage_ratio        share of spending done in cash withdrawals
overdraft_events        count of negative-balance months — distress signal
financial_health_score  weighted composite (0-100), weights in config
"""
import numpy as np
import pandas as pd

from . import config


def _cv(series: pd.Series) -> float:
    """Coefficient of variation, safe against zero mean or too few observations.

    pandas std() uses ddof=1 by default, which is undefined (NaN) for a
    single-element series — a brand-new live-connected account with under a
    month of history hits this every time. Treat "not enough data yet" as
    zero volatility rather than propagating NaN into the health score.
    """
    if len(series) < 2:
        return 0.0
    m = series.mean()
    std = series.std()
    return float(std / m) if m and pd.notna(std) else 0.0


def detect_salary(acct_tx: pd.DataFrame) -> float:
    """Detect recurring monthly income: large credits arriving ~monthly."""
    credits = acct_tx[(acct_tx["trans_type"] == "credit")
                      & (acct_tx["amount"] >= config.SALARY_MIN_AMOUNT)]
    if credits.empty:
        return 0.0
    # group similar amounts (within 5%) and check monthly recurrence
    by_month = credits.groupby("month")["amount"].max()
    if len(by_month) < config.RECURRING_MIN_OCCURRENCES:
        return 0.0
    return float(by_month.median())


def detect_recurring_debits(acct_tx: pd.DataFrame) -> list[dict]:
    """Find debits with same rounded amount recurring >= N months (subscriptions, bills)."""
    debits = acct_tx[acct_tx["trans_type"].isin(["debit", "cash_withdrawal"])].copy()
    if debits.empty:
        return []
    debits["amount_bucket"] = debits["amount"].round(0)
    out = []
    for (bucket, cat), grp in debits.groupby(["amount_bucket", "category"]):
        months = grp["month"].nunique()
        if months >= config.RECURRING_MIN_OCCURRENCES and bucket > 0:
            out.append({
                "amount": float(bucket),
                "category": cat,
                "months_observed": int(months),
                "monthly": bool(months >= grp["month"].nunique() * 0.8),
            })
    # keep the strongest recurring signals
    out.sort(key=lambda d: d["months_observed"], reverse=True)
    return out[:10]


def monthly_aggregates(acct_tx: pd.DataFrame) -> pd.DataFrame:
    """Per-month income / expenses / net / end balance for one account."""
    g = acct_tx.groupby("month")
    agg = pd.DataFrame({
        "income": g.apply(lambda x: x.loc[x["signed_amount"] > 0, "signed_amount"].sum(),
                          include_groups=False),
        "expenses": g.apply(lambda x: -x.loc[x["signed_amount"] < 0, "signed_amount"].sum(),
                            include_groups=False),
        "end_balance": g.apply(lambda x: x.sort_values("trans_date")["balance"].iloc[-1],
                               include_groups=False),
    })
    agg["net"] = agg["income"] - agg["expenses"]
    return agg


def category_ratios(acct_tx: pd.DataFrame) -> dict:
    """Share of spending volume per normalized category."""
    debits = acct_tx[acct_tx["signed_amount"] < 0]
    total = -debits["signed_amount"].sum()
    if not total:
        return {}
    shares = (-debits.groupby("category")["signed_amount"].sum() / total)
    return {f"{cat}_ratio": round(float(v), 4) for cat, v in shares.items()}


def health_score(features: dict) -> float:
    """Composite 0-100 financial health score (documented weights in config)."""
    w = config.HEALTH_SCORE_WEIGHTS
    savings_component = np.clip(features["savings_rate"] / 0.30, 0, 1)          # 30% savings = perfect
    stability_component = np.clip(features["cashflow_stability"], 0, 1)
    debt_component = 1 - np.clip(features["debt_ratio"] / 0.40, 0, 1)           # 40% DTI = zero score
    ef_component = np.clip(
        features["emergency_fund_months"] / config.EMERGENCY_FUND_MONTHS_TARGET, 0, 1)
    score = 100 * (w["savings_rate"] * savings_component
                   + w["cashflow_stability"] * stability_component
                   + w["debt_ratio"] * debt_component
                   + w["emergency_fund"] * ef_component)
    return round(float(score), 1)


def build_account_features(acct_tx: pd.DataFrame, loans: pd.DataFrame) -> dict:
    """All behavioral features for a single account."""
    monthly = monthly_aggregates(acct_tx)
    if monthly.empty:
        return {}

    income_m = float(monthly["income"].median())
    expenses_m = float(monthly["expenses"].median())
    current_balance = float(
        acct_tx.sort_values("trans_date")["balance"].iloc[-1])

    active_loans = loans[loans["status"].isin(["running_ok", "running_in_debt"])]
    monthly_loan_payment = float(active_loans["payments"].sum())
    avg_monthly_balance = float(monthly["end_balance"].mean())

    features = {
        "monthly_income": round(income_m, 2),
        "monthly_expenses": round(expenses_m, 2),
        "avg_monthly_balance": round(avg_monthly_balance, 2),
        "net_cashflow": round(income_m - expenses_m, 2),
        "savings_rate": round((income_m - expenses_m) / income_m, 4) if income_m else 0.0,
        "spending_volatility": round(_cv(monthly["expenses"]), 4),
        "income_stability": round(float(np.clip(1 - _cv(monthly["income"]), 0, 1)), 4),
        "cashflow_stability": round(float(np.clip(1 - _cv(monthly["net"].abs() + 1), 0, 1)), 4),
        "debt_ratio": round(monthly_loan_payment / income_m, 4) if income_m else 0.0,
        "monthly_loan_payment": round(monthly_loan_payment, 2),
        "current_balance": round(current_balance, 2),
        "emergency_fund_months": round(current_balance / expenses_m, 2) if expenses_m else 0.0,
        "detected_salary": round(detect_salary(acct_tx), 2),
        "weekend_spending_ratio": _weekend_ratio(acct_tx),
        "cash_usage_ratio": _cash_ratio(acct_tx),
        "overdraft_months": int((monthly["end_balance"] < 0).sum()),
        "months_of_history": int(len(monthly)),
    }
    features.update(category_ratios(acct_tx))
    features["financial_health_score"] = health_score(features)
    features["recurring_payments"] = detect_recurring_debits(acct_tx)
    return features


def _weekend_ratio(acct_tx: pd.DataFrame) -> float:
    debits = acct_tx[acct_tx["signed_amount"] < 0]
    total = -debits["signed_amount"].sum()
    if not total:
        return 0.0
    weekend = -debits[debits["trans_date"].dt.dayofweek >= 4]["signed_amount"].sum()
    return round(float(weekend / total), 4)


def _cash_ratio(acct_tx: pd.DataFrame) -> float:
    debits = acct_tx[acct_tx["signed_amount"] < 0]
    total = -debits["signed_amount"].sum()
    if not total:
        return 0.0
    cash = -debits[debits["operation"] == "cash_withdrawal"]["signed_amount"].sum()
    return round(float(cash / total), 4)
