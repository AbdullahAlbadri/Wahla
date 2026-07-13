"""Data ingestion + cleaning layer.

This is the ONLY module that knows about the raw dataset format.
Replacing Berka with a real Open Banking API = reimplement `load_all()`
to return the same normalized frames.
"""
import pandas as pd

from . import config


def _read(table: str) -> pd.DataFrame:
    path = config.DATA_DIR / config.FILES[table]
    df = pd.read_csv(path, sep="\t", header=None, names=config.COLUMNS[table],
                     dtype=str, keep_default_na=False, na_values=[""])
    return df


def load_transactions() -> pd.DataFrame:
    """Load, clean and normalize the transactions table."""
    df = _read("trans")

    # types
    df["trans_date"] = pd.to_datetime(df["trans_date"], format="%Y-%m-%d", errors="coerce")
    for col in ("amount", "balance"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["account_id"] = df["account_id"].astype(int)

    # cleaning
    df = df.dropna(subset=["trans_date", "amount"])
    df = df.drop_duplicates(subset=["trans_id"])
    df["trans_type"] = df["trans_type"].str.strip()
    df["operation"] = df["operation"].str.strip()
    df["category"] = df["category"].str.strip()

    # normalize codes → open-banking style labels
    df["trans_type"] = df["trans_type"].map(config.TRANS_TYPE).fillna("unknown")
    df["operation"] = df["operation"].map(config.OPERATION).fillna("other")
    df["category"] = df["category"].map(config.CATEGORY).fillna("uncategorized")

    # this Berka variant stores amounts already signed (debits negative);
    # keep signed_amount as-is and expose magnitude separately
    df["signed_amount"] = df["amount"]
    df["amount"] = df["amount"].abs()
    df["month"] = df["trans_date"].dt.to_period("M")
    return df


def load_accounts() -> pd.DataFrame:
    df = _read("account")
    df["account_id"] = df["account_id"].astype(int)
    df["district_id"] = df["district_id"].astype(int)
    df["create_date"] = pd.to_datetime(df["create_date"], errors="coerce")
    return df


def load_clients() -> pd.DataFrame:
    df = _read("client")
    df["client_id"] = df["client_id"].astype(int)
    df["birth_date"] = pd.to_datetime(df["birth_date"], errors="coerce")
    df["district_id"] = pd.to_numeric(df["district_id"], errors="coerce")
    return df


def load_dispositions() -> pd.DataFrame:
    df = _read("disp")
    for col in ("disp_id", "client_id", "account_id"):
        df[col] = df[col].astype(int)
    return df


def load_loans() -> pd.DataFrame:
    df = _read("loan")
    df["loan_id"] = df["loan_id"].astype(int)
    df["account_id"] = df["account_id"].astype(int)
    df["granted_date"] = pd.to_datetime(df["granted_date"], errors="coerce")
    for col in ("amount", "duration", "payments"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["status"] = df["status"].str.strip().map(config.LOAN_STATUS).fillna("unknown")
    return df


def load_orders() -> pd.DataFrame:
    df = _read("order")
    df["order_id"] = df["order_id"].astype(int)
    df["account_id"] = df["account_id"].astype(int)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df["category"] = df["category"].str.strip().map(config.ORDER_CATEGORY).fillna("other")
    return df


def load_cards() -> pd.DataFrame:
    df = _read("card")
    df["card_id"] = df["card_id"].astype(int)
    df["disp_id"] = df["disp_id"].astype(int)
    df["card_type"] = df["card_type"].str.strip().map(config.CARD_TYPE).fillna("unknown")
    df["issued_date"] = pd.to_datetime(df["issued_date"], errors="coerce")
    return df


def load_districts() -> pd.DataFrame:
    df = _read("district")
    df["district_id"] = df["district_id"].astype(int)
    for col in ("population", "avg_salary", "urban_ratio", "unemp_96"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df[["district_id", "district_name", "region", "population",
               "urban_ratio", "avg_salary", "unemp_96"]]


def load_all() -> dict:
    """Load every table, cleaned and normalized."""
    return {
        "transactions": load_transactions(),
        "accounts": load_accounts(),
        "clients": load_clients(),
        "dispositions": load_dispositions(),
        "loans": load_loans(),
        "orders": load_orders(),
        "cards": load_cards(),
        "districts": load_districts(),
    }
