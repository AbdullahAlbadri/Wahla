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


def _finalize_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """Shared cleaning choke point for every ingestion path (batch TSV or live API).

    Strict typing, drops invalid rows, dedupes, derives signed/absolute amount
    and month. Callers must normalize trans_type/operation/category into
    open-banking labels *before* reaching here — see load_transactions() for
    the Berka-code mapping and load_live_transactions() for a live feed.
    check_architecture.py enforces that nothing downstream (features.py,
    engine.py, ...) ever imports data_loader or touches a raw file directly,
    so this is the only place cleaning can happen.
    """
    # format="mixed": a live feed mixes date-only and full-timestamp rows —
    # pandas otherwise infers one format from the first row and silently
    # NaTs (then drops) every row that doesn't match it
    df["trans_date"] = pd.to_datetime(df["trans_date"], format="mixed", errors="coerce")
    for col in ("amount", "balance"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["account_id"] = df["account_id"].astype(int)

    df = df.dropna(subset=["trans_date", "amount"]).copy()
    df = df.drop_duplicates(subset=["trans_id"])

    # this Berka variant stores amounts already signed (debits negative);
    # keep signed_amount as-is and expose magnitude separately
    df["signed_amount"] = df["amount"]
    df["amount"] = df["amount"].abs()
    df["month"] = df["trans_date"].dt.to_period("M")
    return df


def load_transactions() -> pd.DataFrame:
    """Load, clean and normalize the transactions table from the Berka TSV export."""
    df = _read("trans")
    df["trans_type"] = df["trans_type"].str.strip().map(config.TRANS_TYPE).fillna("unknown")
    df["operation"] = df["operation"].str.strip().map(config.OPERATION).fillna("other")
    df["category"] = df["category"].str.strip().map(config.CATEGORY).fillna("uncategorized")
    return _finalize_transactions(df)


LIVE_REQUIRED_FIELDS = {"trans_id", "account_id", "trans_date", "amount", "trans_type"}


def load_live_transactions(raw: list[dict]) -> pd.DataFrame:
    """Clean + normalize a batch of transactions pulled live from an Open Banking API.

    This is the connect-time equivalent of load_transactions(): a real bank
    feed lands here first and is forced through the exact same typing/dedup/
    derivation contract as the Berka batch pipeline — only the cleaned frame
    is allowed to reach features.py. Expected shape per transaction:
        {trans_id, account_id, trans_date (ISO 8601), amount,
         trans_type ("credit"|"debit"|"cash_withdrawal"),
         balance?, operation?, category?}
    """
    columns = ["trans_id", "account_id", "trans_date", "amount", "balance",
               "trans_type", "operation", "category", "signed_amount", "month"]
    if not raw:
        return pd.DataFrame(columns=columns)

    df = pd.DataFrame(raw)
    missing = LIVE_REQUIRED_FIELDS - set(df.columns)
    if missing:
        raise ValueError(f"live transaction feed missing required fields: {sorted(missing)}")

    for col in ("balance", "operation", "category"):
        if col not in df.columns:
            df[col] = None
    df["operation"] = df["operation"].fillna("other").astype(str).str.strip()
    df["category"] = df["category"].fillna("uncategorized").astype(str).str.strip()
    df["trans_type"] = df["trans_type"].astype(str).str.strip().str.lower()

    return _finalize_transactions(df)


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


def _finalize_loans(df: pd.DataFrame) -> pd.DataFrame:
    """Shared cleaning choke point for loan records (batch TSV or live API).

    memory.py and features.py use loan_id/account_id/amount/duration/payments
    unconditionally (float()/round()/f-string formatting, no null-guards), so
    unlike granted_date this function drops any row missing them instead of
    letting NaN slip through to a crash later. Callers must normalize `status`
    into an open-banking label before reaching here — see load_loans() for
    the Berka-code mapping and load_live_loans() for a live feed.
    """
    df["granted_date"] = pd.to_datetime(df["granted_date"], format="mixed", errors="coerce")
    for col in ("amount", "duration", "payments"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["loan_id"] = pd.to_numeric(df["loan_id"], errors="coerce")
    df["account_id"] = pd.to_numeric(df["account_id"], errors="coerce")

    df = df.dropna(subset=["loan_id", "account_id", "amount", "duration", "payments"]).copy()
    df["loan_id"] = df["loan_id"].astype(int)
    df["account_id"] = df["account_id"].astype(int)
    df = df.drop_duplicates(subset=["loan_id"])
    return df


def load_loans() -> pd.DataFrame:
    """Load, clean and normalize the loans table from the Berka TSV export."""
    df = _read("loan")
    df["status"] = df["status"].str.strip().map(config.LOAN_STATUS).fillna("unknown")
    return _finalize_loans(df)


LIVE_LOAN_REQUIRED_FIELDS = {"loan_id", "account_id", "amount", "status"}


def load_live_loans(raw: list[dict]) -> pd.DataFrame:
    """Clean + normalize loan records pulled live from an Open Banking API.

    Connect-time equivalent of load_loans(): mirrors load_live_transactions()
    — forces a real feed through the same typing/dedup/dropna contract as the
    Berka batch loans table. `status` is expected already human-readable
    (not a Berka code), e.g. "running_ok" | "running_in_debt" |
    "finished_ok" | "defaulted".
    """
    columns = ["loan_id", "account_id", "granted_date", "amount",
               "duration", "payments", "status"]
    if not raw:
        return pd.DataFrame(columns=columns)

    df = pd.DataFrame(raw)
    missing = LIVE_LOAN_REQUIRED_FIELDS - set(df.columns)
    if missing:
        raise ValueError(f"live loan feed missing required fields: {sorted(missing)}")

    for col in ("granted_date", "duration", "payments"):
        if col not in df.columns:
            df[col] = None
    df["status"] = df["status"].fillna("unknown").astype(str).str.strip().str.lower()

    return _finalize_loans(df)


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
