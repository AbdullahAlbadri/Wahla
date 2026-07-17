# Financial Digital Twin — Open Banking Hackathon

A continuously evolving virtual representation of a person's financial
life. Not a budgeting app, not a dashboard, not a chatbot: a **stateful,
simulatable model** of the customer, built from 1M+ real bank transactions.

## Problem

People make their biggest financial decisions — car, loan, BNPL — blind.
Banking apps show the past (what you spent); nothing shows the future
(*who you become* if you sign). Open Banking finally provides the data to
model a person's financial life — but today it powers dashboards, not
decisions.

## Architecture

```
Raw transactions (Berka: 1,056,320 real txns, 4,500 clients)
  → Cleaning pipeline        twin/data_loader.py   (only module touching raw data)
  → Feature engineering      twin/features.py      (20+ documented behavioral features)
  → FINANCIAL TWIN           twin/engine.py        (persistent state + memory + forecast)
  → Simulation engine        twin/simulation.py    (what-if on a copy, never the original)
  → Diff + explanation       twin/diff.py, explain.py, report.py, validation.py
  → Frontend (Lovable)       consumes twins.json / demo_story.json
```

Verified isolation: `python3 check_architecture.py` proves via AST
inspection that no module downstream of the Twin imports the data source
or reads files. Full details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Why this is a Digital Twin (the engineering definition)

1. **Persistent state** — ~30 derived attributes per person, existing
   independently of any query.
2. **Continuous updates** — every event passes through one mutation
   gateway (`apply_event`) that produces an explicit **state transition**
   (State A → event → State B), re-deriving all dependent attributes.
3. **Memory** — a timeline of salary changes, loans, defaults, large
   purchases; extracted from history, extended by every live event.
4. **Behavior model** — financial personality (7 types, with confidence
   score) inferred from engineered features, never hardcoded.
5. **Simulation** — hypothetical futures run on a copy of the state,
   consistency-validated before any result is returned.

Longer version for judges: [HACKATHON.md](HACKATHON.md).

## Dataset

**Berka / PKDD'99** — real (anonymized) retail-bank data: 4,500 accounts,
5,369 clients, 1,056,320 transactions, 682 loans **with real outcomes**,
6,471 standing orders, demographics for 77 districts.

**Validation against reality**: our Health Score never sees loan outcomes,
yet clients whose real loans went into distress score **22.8** on average
vs **42.8** for clients who repaid — the Twin predicts real financial
distress from behavior alone.

## Feature Engineering

Per account, from cleaned transactions only: monthly income & expenses
(median-based, robust to outliers), savings rate, spending volatility,
income stability, debt-to-income, emergency-fund months, detected salary,
recurring payments (subscriptions/bills), weekend-spending and cash-usage
ratios, overdraft history, and a weighted composite **Health Score
(0-100)**. Every formula and weight is documented in `twin/features.py`
and `twin/config.py`.

## Simulation Engine

12 what-if scenarios: buy (cash/BNPL), car with down-payment + financing,
loan, subscription, rent change, salary change, medical emergency,
vacation, monthly investment (with compounding projection), debt payoff,
and ranked multi-scenario comparison. Each returns: verdict
(safe/caution/risky/dangerous), state transition, semantic diff,
24-month forecast, health report, and consistency warnings.

## Explainability

Explanations are **derived, not generated**: a dependency graph
(`twin/diff.py`) maps every changed attribute to the upstream attributes
that caused it, producing "Health fell 84.7 → 79.6 because the loan adds
91/month in obligations, cutting your savings rate from 56% to 49%…" —
mechanically faithful to the numbers. An LLM may rephrase; it cannot
invent.

## Limitations

- Berka amounts reflect 1990s Czech incomes (scaled ÷10); relative
  behavior is realistic, absolute values are modest.
- Forecast is deterministic (median-based); no stochastic scenarios yet.
- Borrowed cash currently counts toward the emergency fund — the
  24-month forecast corrects the picture, but the liquidity metric could
  distinguish owned vs borrowed reserves.
- Categories are coarse (7 bank categories); a real Open Banking feed
  would enable merchant-level enrichment.

## Future: real Open Banking integration

`twin/data_loader.py` is the single swap point. Replace its loaders with
calls to an Open Banking API (account-information consent flow) emitting
the same normalized schema — everything downstream (features, twin,
simulation, explanations) works unchanged. Webhooks for new transactions
map 1:1 to `twin.apply_event(...)`, making the Twin update in real time.

## Run

```bash
python3 build_twins.py                 # full pipeline → twins.json (4,500 twins)
python3 make_demo.py                   # 2-persona demo payload → demo_story.json
python3 build_twins.py --inspect 19    # judge mode: full data lineage
python3 test_events.py                 # production test suite
python3 check_architecture.py          # isolation proof
```
