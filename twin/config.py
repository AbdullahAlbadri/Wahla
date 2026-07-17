"""Central configuration — no hardcoded values scattered in modules.

Swap DATA_DIR / loader to point at a real Open Banking API later:
only `data_loader.py` needs to change, everything downstream is schema-driven.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "raw"
OUTPUT_DIR = BASE_DIR / "data" / "processed"

# ---- Berka source files (tab-delimited, no headers) ----
FILES = {
    "account": "fin_account.tsv",
    "client": "fin_client.tsv",
    "disp": "fin_disp.tsv",
    "order": "fin_order.tsv",
    "trans": "fin_trans.tsv",
    "loan": "fin_loan.tsv",
    "card": "fin_card.tsv",
    "district": "fin_district.tsv",
}

COLUMNS = {
    "account": ["account_id", "district_id", "create_date", "frequency"],
    "client": ["client_id", "birth_date", "gender", "district_id"],
    "disp": ["disp_id", "client_id", "account_id", "disp_type"],
    "order": ["order_id", "account_id", "bank_to", "account_to", "amount", "category"],
    "trans": ["trans_id", "account_id", "trans_date", "amount", "balance",
              "trans_type", "operation", "category", "other_bank_id", "other_account_id"],
    "loan": ["loan_id", "account_id", "granted_date", "amount", "duration", "payments", "status"],
    "card": ["card_id", "disp_id", "card_type", "issued_date"],
    "district": ["district_id", "district_name", "region", "population",
                 "n_muni_lt_500", "n_muni_500_2k", "n_muni_2k_10k", "n_muni_gt_10k",
                 "n_cities", "urban_ratio", "avg_salary", "unemp_95", "unemp_96",
                 "entrepreneurs_per_1k", "crimes_95", "crimes_96"],
}

# ---- Open-Banking-style semantic mappings (normalize bank codes → categories) ----
TRANS_TYPE = {"C": "credit", "D": "debit", "P": "cash_withdrawal"}
OPERATION = {
    "CCW": "card_withdrawal",
    "CIC": "cash_deposit",
    "COB": "incoming_transfer",
    "WIC": "cash_withdrawal",
    "ROB": "outgoing_transfer",
}
CATEGORY = {
    "IC": "interest_income",
    "IO": "overdraft_fee",
    "PE": "pension_income",
    "LO": "loan_payment",
    "HH": "household",
    "ST": "bank_fee",
    "IN": "insurance",
    "SA": "salary",           # derived: large recurring incoming credit
    "UN": "uncategorized",
}
ORDER_CATEGORY = {"HH": "household", "IN": "insurance", "LO": "loan_payment", "LE": "leasing"}
LOAN_STATUS = {"A": "finished_ok", "B": "defaulted", "C": "running_ok", "D": "running_in_debt"}
CARD_TYPE = {"J": "junior", "C": "classic", "G": "gold"}

# ---- Feature engineering parameters ----
SALARY_MIN_AMOUNT = 300          # incoming credit above this, recurring monthly → salary
SALARY_MONTHLY_TOLERANCE_DAYS = 6
RECURRING_MIN_OCCURRENCES = 3
EMERGENCY_FUND_MONTHS_TARGET = 6  # standard financial planning benchmark
HEALTH_SCORE_WEIGHTS = {
    "savings_rate": 0.25,
    "cashflow_stability": 0.15,
    "debt_ratio": 0.20,
    "emergency_fund": 0.20,
    "income_stability": 0.20,
}

# ---- 50/30/20 budget rule (Wahla - Logic.pdf) ----
BUDGET_RULE_TARGETS = {"needs": 0.50, "wants": 0.30, "savings": 0.20}

# Best-effort need/want split of debit categories. Berka's category set is
# coarse — "household" is its catch-all for most day-to-day spending, not a
# clean needs-only bucket — so this mapping is a placeholder until a real
# Open Banking feed with merchant-category codes replaces it. Swap this dict,
# nothing downstream of budget_rule.py needs to change.
NEED_CATEGORIES = {"household", "loan_payment", "insurance", "bank_fee", "overdraft_fee"}
WANT_CATEGORIES = {"uncategorized"}

MONTHLY_ADJUSTMENT_STEP = 0.025   # midpoint of the spec's "2-3% per month"
SUGGESTION_COOLDOWN_DAYS = 30

# ---- Passive product suggestion catalog (illustrative figures from spec) ----
SAVINGS_TIERS = [
    {"max_balance": 1_000_000, "aer_min": 0.0150, "aer_max": 0.0200},
    {"max_balance": 3_000_000, "aer_min": 0.0175, "aer_max": 0.0222},
    {"max_balance": None, "aer_min": 0.0220, "aer_max": 0.0300},
]

CAR_FINANCING_TENORS = [
    {"years": 3, "annual_rate": 0.0300},
    {"years": 4, "annual_rate": 0.0300},
    {"years": 5, "annual_rate": 0.0300},
    {"years": 5, "annual_rate": 0.0361},
]

REAL_ESTATE_TENORS = [10, 15, 20]          # years
REAL_ESTATE_MAX_FINANCING_RATIO = 0.90

CARD_TIERS = {
    "mada_classic": {"annual_fee": 0, "intl_rate": 0.0265},
    "mada_gold": {"annual_fee": 0, "intl_rate": 0.0220},
    "visa": {"annual_fee": 150, "intl_rate": 0.0115},
}

BUSINESS_FINANCING_TIERS = [
    {"size": "micro", "max_amount": 500_000, "margin_min": 0.06, "margin_max": 0.08,
     "max_months": 84},
    {"size": "small", "max_amount": 6_250_000, "margin_min": None, "margin_max": None,
     "max_months": None},
    {"size": "medium", "max_amount": 18_750_000, "margin_min": None, "margin_max": None,
     "max_months": None},
]
INSTALLMENT_MARGIN = 0.035        # fixed-installment product, vs 38%+ revolving APR
REVOLVING_APR_ASSUMED = 0.38
