# Architecture — Financial Digital Twin

```
┌──────────────────────────────────────────────────────────────────┐
│  RAW DATA — 1,056,320 real bank transactions (Berka, 4,500 accts)│
│  swap-in point for a live Open Banking API                       │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  CLEANING PIPELINE                модule: twin/data_loader.py     │
│  types • dedupe • missing values • bank codes → Open Banking     │
│  categories (the ONLY module that knows the data source)         │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  FEATURE ENGINEERING              module: twin/features.py       │
│  20+ documented behavioral features: income/expenses, savings    │
│  rate, volatility, DTI, emergency fund, recurring payments,      │
│  weekend/cash ratios, composite Health Score (0–100)             │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  FINANCIAL TWIN                   module: twin/engine.py         │
│  living state object per person:                                 │
│   • state: income, expenses, balance, debt, health, forecast     │
│   • personality + confidence      (twin/personality.py)          │
│   • memory timeline of life events (twin/memory.py)              │
│   • apply_event() → every new fact mutates state & re-derives    │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  SIMULATION ENGINE                module: twin/simulation.py     │
│  what-if on a COPY of the twin: car, loan, BNPL, subscription,   │
│  rent, salary change, medical emergency, vacation, investment,   │
│  debt payoff, multi-scenario compare (ranked by health score)    │
│  → before / after / changed attributes / verdict                 │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  EXPLAINABILITY / AI REASONING    module: twin/explain.py        │
│  mechanical WHY-narrative from the state diff — always faithful  │
│  to the numbers; an LLM may rephrase, never invents reasoning    │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND (Lovable — unchanged)                                  │
│  consumes twins.json + simulation results (before_after_card,    │
│  explanation, forecast, memory timeline)                         │
└──────────────────────────────────────────────────────────────────┘
```

## Design rules

1. **One-way data flow.** Raw transactions are read exactly once, at build
   time. Everything downstream — simulations, recommendations, forecasts —
   reads only the Twin state.
2. **Single swap point.** Replacing the dataset with a live Open Banking
   API touches only `data_loader.py`; the schema it emits is the contract.
3. **No hardcoded values.** Thresholds, category mappings, and score
   weights live in `twin/config.py`.
4. **Simulations never mutate the real Twin.** They run on a deep copy;
   the real Twin changes only through actual events.
5. **Explanations are derived, not generated.** The WHY text is computed
   from the attribute diff, so it can never contradict the numbers.

## Validation (real outcomes, not synthetic)

The Berka loans table records what actually happened to 682 real loans.
Our Health Score — computed **only** from behavioral features, never from
loan outcomes — separates them:

| Real loan outcome        | Mean Health Score | Mean savings rate |
|--------------------------|------------------:|------------------:|
| Repaid successfully      | 42.8              | +2%               |
| Currently in debt        | 22.8              | −56%              |
| Defaulted                | 37.5              | −12%              |

## Run

```bash
python3 build_twins.py                # full pipeline → data/processed/twins.json
python3 build_twins.py --account 19   # demo: twin + memory + simulations
```
