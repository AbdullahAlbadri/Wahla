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
    "savings_rate": 0.30,
    "cashflow_stability": 0.20,
    "debt_ratio": 0.25,
    "emergency_fund": 0.25,
}
