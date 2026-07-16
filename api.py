"""HTTP API bridging the Wahla frontend to the Financial Digital Twin.

Endpoints (all JSON):
  GET  /api/accounts                     demo accounts for the connect screen
  POST /api/connect                      live Open Banking feed → cleaned → Twin
  GET  /api/twin/{account_id}            full Twin state
  POST /api/simulate/{account_id}        Wahla decision → simulation result
  GET  /api/alternatives/{account_id}    smarter-alternative suggestions
  GET  /api/budget/{account_id}          50/30/20 split + monthly adjustment rule
  POST /api/decision-check/{account_id}  Base Logic: allow/deny a spending decision
  POST /api/suggestions/{account_id}     passive product suggestion layer

Run: python3 -m uvicorn api:app --port 8000 --reload
"""
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from twin import config
from twin.budget_rule import budget_ratios, decision_check, monthly_adjustment
from twin.data_loader import load_live_loans, load_live_transactions
from twin.engine import FinancialTwin
from twin.features import build_account_features
from twin.memory import build_timeline
from twin.simulation import SimulationEngine
from twin.suggestions import generate_suggestions

app = FastAPI(title="Financial Digital Twin API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
    allow_headers=["*"],
)

# demo personas surfaced on the connect screen (real Berka accounts)
DEMO_ACCOUNTS = [
    {"id": 21, "title": "الحساب الرئيسي", "bank": "مصرف الإنماء",
     "mask": "•••• 4821", "persona": "منضبط ماليًا"},
    {"id": 19, "title": "حساب إضافي", "bank": "مصرف الإنماء",
     "mask": "•••• 7914", "persona": "إنفاق اندفاعي"},
    {"id": 2, "title": "حساب المخطط", "bank": "مصرف الإنماء",
     "mask": "•••• 3058", "persona": "مخطط لأهدافه"},
]

_TWINS: dict[int, FinancialTwin] = {}


def _load_twins():
    path = config.OUTPUT_DIR / "twins.json"
    raw = json.loads(path.read_text())
    fields = set(FinancialTwin.__dataclass_fields__)
    for k, state in raw.items():
        state = {f: v for f, v in state.items() if f in fields}
        _TWINS[int(k)] = FinancialTwin(**state)
    print(f"loaded {len(_TWINS)} twins")


_load_twins()


def _twin(account_id: int) -> FinancialTwin:
    twin = _TWINS.get(account_id)
    if twin is None:
        raise HTTPException(404, f"no twin for account {account_id}")
    return twin


class Decision(BaseModel):
    """Mirrors the Wahla DecisionState."""
    type: str            # loan | installment | bnpl | subscription
    monthly: float
    months: int
    hasDownPayment: bool = False


def _decision_events(d: Decision) -> list[dict]:
    """Map a Wahla decision onto Twin events.

    All four decision types are a recurring monthly commitment; a down
    payment adds a one-off expense of one installment up front.
    """
    events: list[dict] = []
    if d.hasDownPayment:
        events.append({"type": "one_off_expense", "amount": d.monthly})
    events.append({"type": "new_subscription", "monthly_amount": d.monthly,
                   "name": d.type})
    return events


@app.get("/api/accounts")
def accounts():
    out = []
    for a in DEMO_ACCOUNTS:
        twin = _TWINS.get(a["id"])
        out.append({**a, "health_score": twin.financial_health_score if twin else None})
    return out


class LiveTransaction(BaseModel):
    """One transaction as it would arrive from a live Open Banking connection.

    Fields stay loose (amount/trans_date optional-ish) on purpose: a real
    feed will contain the occasional malformed row, and rejecting the whole
    batch on one bad transaction would defeat the point of a cleaning layer.
    load_live_transactions() is where bad rows actually get dropped.
    """
    trans_id: str
    account_id: int
    trans_date: str | None = None
    amount: float | None = None
    trans_type: str
    balance: float | None = None
    operation: str | None = None
    category: str | None = None


class ConnectPayload(BaseModel):
    account_id: int
    transactions: list[LiveTransaction]
    loans: list[dict] = []
    demo: dict = {}


@app.post("/api/connect")
def connect_live_account(payload: ConnectPayload):
    """Live equivalent of build_twins.py: raw feed → cleaned → features → Twin.

    Nothing here reaches features.py/engine.py until it has passed through
    load_live_transactions()/load_live_loans() — the same cleaning contract
    the Berka batch pipeline uses in twin/data_loader.py. A malformed loan
    or transaction gets dropped by cleaning, not rejected outright: a real
    feed of thousands of records will always contain a few bad ones.
    """
    raw = [t.model_dump() for t in payload.transactions]
    tx = load_live_transactions(raw)
    if tx.empty:
        raise HTTPException(422, "no valid transactions survived cleaning")

    loans = load_live_loans(payload.loans)

    feats = build_account_features(tx, loans)
    if not feats:
        raise HTTPException(422, "not enough cleaned data to build a twin")

    twin = FinancialTwin.from_features(
        payload.account_id, feats, payload.demo, memory=build_timeline(tx, loans))
    _TWINS[payload.account_id] = twin
    return twin.to_dict()


@app.get("/api/twin/{account_id}")
def get_twin(account_id: int):
    return _twin(account_id).to_dict()


@app.post("/api/simulate/{account_id}")
def simulate(account_id: int, d: Decision):
    twin = _twin(account_id)
    sim = SimulationEngine(twin)
    result = sim._run(_decision_events(d), f"wahla_{d.type}_{d.monthly:.0f}")
    result["total_commitment"] = round(d.monthly * d.months, 2)
    return result


@app.get("/api/alternatives/{account_id}")
def alternatives(account_id: int, monthly: float, months: int):
    """For each Wahla alternative card, quantify the improvement."""
    twin = _twin(account_id)
    sim = SimulationEngine(twin)

    # reduced installment: largest amount keeping savings rate >= 10%
    headroom = max(twin.monthly_income * (twin.savings_rate - 0.10), 0)
    suggested = round(min(monthly * 0.6, headroom), -1) if headroom else round(monthly * 0.6, -1)

    base = sim.new_subscription(monthly, "current_choice")
    reduced = sim.new_subscription(suggested, "reduced") if suggested > 0 else None
    longer_monthly = round(monthly * months / 18, 2)
    longer = sim.new_subscription(longer_monthly, "longer_term")

    return {
        "current_verdict": base["verdict"],
        "reduce_payment": {
            "suggested_monthly": suggested,
            "verdict": reduced["verdict"] if reduced else None,
            "health_after": reduced["after"]["financial_health_score"] if reduced else None,
        },
        "longer_duration": {
            "months": 18,
            "monthly": longer_monthly,
            "verdict": longer["verdict"],
            "health_after": longer["after"]["financial_health_score"],
        },
        "delay": {
            "months_to_save_buffer": (
                None if twin.net_cashflow <= 0 else round(
                    max(3 * twin.monthly_expenses - twin.current_balance, 0)
                    / twin.net_cashflow)
            ),
        },
        "review_subscriptions": {
            "recurring_total": round(sum(
                p["amount"] for p in twin.recurring_payments
                if p.get("monthly")), 2),
            "count": len(twin.recurring_payments),
        },
    }


@app.get("/api/budget/{account_id}")
def budget(account_id: int):
    """50/30/20 split for this Twin, and which monthly adjustment rule (if any) applies."""
    twin = _twin(account_id)
    state = twin.to_dict()
    return {
        "ratios": budget_ratios(state),
        "targets": config.BUDGET_RULE_TARGETS,
        "monthly_adjustment": monthly_adjustment(state),
    }


class DecisionCheckRequest(BaseModel):
    is_need: bool
    amount: float
    can_pay_installments: bool = False


@app.post("/api/decision-check/{account_id}")
def decision_check_endpoint(account_id: int, req: DecisionCheckRequest):
    """Base Logic 4-step tree: should this spending decision be added?"""
    twin = _twin(account_id)
    return decision_check(
        twin.to_dict(), is_need=req.is_need, amount=req.amount,
        can_pay_installments=req.can_pay_installments)


class SuggestionsRequest(BaseModel):
    signals: dict = {}
    history: list[dict] = []


@app.post("/api/suggestions/{account_id}")
def suggestions_endpoint(account_id: int, req: SuggestionsRequest):
    """Passive product suggestion layer, priority-ordered, cooldown-filtered.

    `signals` carries the optional stub inputs (idle-cash product status,
    a pending car/real-estate purchase, revolving card balance, etc.) —
    see twin/suggestions.py's module docstring for the full key list.
    """
    twin = _twin(account_id)
    return generate_suggestions(twin.to_dict(), signals=req.signals, history=req.history)
