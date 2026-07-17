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
from twin.data_loader import load_all, load_live_loans, load_live_transactions
from twin.engine import FinancialTwin
from twin.confidence import data_confidence, label as confidence_label
from twin.features import build_account_features, historical_snapshots, predict_from_history
from twin.memory import build_timeline
from twin.patterns import detect_patterns
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
# Full batch transaction/loan history, loaded once at startup — needed for
# GET /api/twin/{id}/history to recompute real historical snapshots (see
# twin/features.py::historical_snapshots). Only covers the Berka batch
# accounts; live-connected accounts (POST /api/connect) have no entry here
# and the history endpoint returns an honest empty list for them, same
# spirit as every other "not enough data yet" empty-state in this app.
_BATCH_TX = None
_BATCH_LOANS = None


def _load_twins():
    path = config.OUTPUT_DIR / "twins.json"
    raw = json.loads(path.read_text())
    fields = set(FinancialTwin.__dataclass_fields__)
    for k, state in raw.items():
        state = {f: v for f, v in state.items() if f in fields}
        _TWINS[int(k)] = FinancialTwin(**state)
    print(f"loaded {len(_TWINS)} twins")


def _load_batch_history():
    global _BATCH_TX, _BATCH_LOANS
    data = load_all()
    _BATCH_TX = data["transactions"]
    _BATCH_LOANS = data["loans"]
    print(f"loaded batch history: {len(_BATCH_TX)} transactions, {len(_BATCH_LOANS)} loans")


_load_twins()
_load_batch_history()


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
    down_payment: float = 0


def _decision_events(d: Decision) -> list[dict]:
    """Map a Wahla decision onto Twin events.

    BNPL is a short fixed-term commitment — it stops weighing on cash flow
    after `months` installments (see fixed_term_commitment in engine.py).
    loan/installment/subscription are ongoing recurring costs with no
    built-in end date in this model, so they stay on new_subscription.
    A down payment (when present) adds a one-off expense of its own real
    amount up front — previously this silently reused the monthly
    installment amount instead of the actual down payment.
    """
    events: list[dict] = []
    if d.hasDownPayment and d.down_payment > 0:
        events.append({"type": "one_off_expense", "amount": d.down_payment})
    if d.type == "bnpl":
        events.append({"type": "fixed_term_commitment", "monthly_amount": d.monthly,
                       "term_months": d.months, "name": d.type})
    else:
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


@app.get("/api/twin/{account_id}/history")
def get_twin_history(account_id: int, months: int = 12):
    """Real historical monthly snapshots — each one recomputed from only the
    transactions that existed by that month, not fabricated. Empty list for
    accounts with no batch history (e.g. a live-connected account) or too
    little history for even one honest cutoff.
    """
    _twin(account_id)  # 404 if the account doesn't exist at all
    if _BATCH_TX is None or _BATCH_TX.empty:
        return []
    acct_tx = _BATCH_TX[_BATCH_TX["account_id"] == account_id]
    if acct_tx.empty:
        return []
    acct_loans = _BATCH_LOANS[_BATCH_LOANS["account_id"] == account_id]
    return historical_snapshots(acct_tx, acct_loans, max_months=months)


@app.get("/api/twin/{account_id}/predictions")
def get_twin_predictions(account_id: int):
    """Real empirical probabilities (twin/features.py::predict_from_history)
    — each one a frequency count over the account's own historical months,
    never a fitted/black-box model. None when there's too little history.
    """
    _twin(account_id)
    if _BATCH_TX is None or _BATCH_TX.empty:
        return None
    acct_tx = _BATCH_TX[_BATCH_TX["account_id"] == account_id]
    if acct_tx.empty:
        return None
    acct_loans = _BATCH_LOANS[_BATCH_LOANS["account_id"] == account_id]
    snapshots = historical_snapshots(acct_tx, acct_loans, max_months=24)
    prediction = predict_from_history(snapshots)
    if prediction is None:
        return None
    dc = data_confidence(prediction["months_observed"])
    prediction["confidence"] = {"score": dc, "label": confidence_label(dc)}
    return prediction


@app.get("/api/twin/{account_id}/patterns")
def get_twin_patterns(account_id: int):
    """Real, evidence-backed behavioral patterns (twin/patterns.py) — never
    a single-occurrence guess. Empty list for accounts with no batch
    history or not enough evidence for any pattern.
    """
    _twin(account_id)
    if _BATCH_TX is None or _BATCH_TX.empty:
        return []
    acct_tx = _BATCH_TX[_BATCH_TX["account_id"] == account_id]
    if acct_tx.empty:
        return []
    acct_loans = _BATCH_LOANS[_BATCH_LOANS["account_id"] == account_id]
    return detect_patterns(acct_tx, acct_loans)


@app.post("/api/simulate/{account_id}")
def simulate(account_id: int, d: Decision):
    twin = _twin(account_id)
    sim = SimulationEngine(twin)
    result = sim._run(_decision_events(d), f"wahla_{d.type}_{d.monthly:.0f}")
    result["total_commitment"] = round(d.monthly * d.months, 2)
    return result


@app.get("/api/alternatives/{account_id}")
def alternatives(account_id: int, monthly: float, months: int):
    """For each Wahla alternative card, quantify the improvement.

    Beyond the original 4 fixed scenarios, this wires in previously-dormant
    SimulationEngine capability (invest_monthly, payoff_debt) so the set of
    alternatives responds to the account's actual situation instead of
    always being the same 4 regardless of context — the real fix for
    "everything is just reduce payment or reduce duration". Each new
    scenario is only surfaced when it's genuinely viable for this account
    (e.g. "use liquidity" only if the balance can actually cover it).
    """
    twin = _twin(account_id)
    sim = SimulationEngine(twin)

    # reduced installment: largest amount keeping savings rate >= 10%
    headroom = max(twin.monthly_income * (twin.savings_rate - 0.10), 0)
    suggested = round(min(monthly * 0.6, headroom), -1) if headroom else round(monthly * 0.6, -1)

    base = sim.new_subscription(monthly, "current_choice")
    reduced = sim.new_subscription(suggested, "reduced") if suggested > 0 else None
    longer_monthly = round(monthly * months / 18, 2)
    longer = sim.new_subscription(longer_monthly, "longer_term")

    ranked = [("الوضع الحالي", base)]
    if reduced:
        ranked.append(("تقليل القسط", reduced))
    ranked.append(("تمديد المدة", longer))

    total_commitment = round(monthly * months, 2)
    use_liquidity = None
    if twin.current_balance >= total_commitment > 0:
        paid_cash = sim.buy_item(total_commitment, "paid_in_full")
        use_liquidity = {
            "feasible": True,
            "verdict": paid_cash["verdict"],
            "health_after": paid_cash["after"]["financial_health_score"],
            "balance_after": paid_cash["after"]["current_balance"],
        }
        ranked.append(("استخدام السيولة الحالية", paid_cash))
    else:
        use_liquidity = {"feasible": False, "verdict": None, "health_after": None, "balance_after": None}

    # 7% assumed annual return — a standard financial-planning benchmark
    # (same spirit as the existing EMERGENCY_FUND_MONTHS_TARGET constant),
    # not a claim about this user's actual investment behavior.
    invested = sim.invest_monthly(monthly, annual_return=0.07, horizon_months=months)
    invest_instead = {
        "verdict": invested["verdict"],
        "health_after": invested["after"]["financial_health_score"],
        "projected_value": invested["investment_projection"]["projected_value"],
        "projected_gain": invested["investment_projection"]["projected_gain"],
    }
    ranked.append(("استثمار المبلغ بدل الالتزام به", invested))

    restructure_debt = None
    if twin.monthly_loan_payment > 0:
        payoff = sim.payoff_debt(twin.monthly_loan_payment)
        restructure_debt = {
            "feasible": True,
            "freed_up_monthly": twin.monthly_loan_payment,
            "verdict": payoff["verdict"],
            "health_after": payoff["after"]["financial_health_score"],
        }
        ranked.append(("إعادة هيكلة الالتزامات الحالية", payoff))
    else:
        restructure_debt = {"feasible": False, "freed_up_monthly": 0, "verdict": None, "health_after": None}

    ranked.sort(key=lambda pair: pair[1]["after"]["financial_health_score"], reverse=True)
    best_scenario = ranked[0][0]

    return {
        "current_verdict": base["verdict"],
        "best_scenario": best_scenario,
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
        "use_liquidity": use_liquidity,
        "invest_instead": invest_instead,
        "restructure_debt": restructure_debt,
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
