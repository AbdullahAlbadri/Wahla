# Model validation results

Real numbers computed against the actual Berka dataset (1,056,320 transactions,
4,500 accounts, 682 loans with a real outcome). Methodology and scripts in this
folder — reproducible with `python3 analysis/health_score_auc.py` and
`python3 analysis/forecast_backtest.py`.

## 1. financial_health_score vs real loan default (leakage-free)

`analysis/health_score_auc.py`

HACKATHON.md's original claim (22.8 vs 42.8 mean score gap between defaulted
and repaid loans) was computed from each account's *full* transaction
history — including transactions *after* the loan was granted. A defaulted
loan's own consequences (overdrafts, erratic spending under financial
stress) leak into the "predictive" score, inflating the apparent gap.

Recomputed using **only transactions strictly before `granted_date`** —
what the score could actually have known at decision time:

| | value |
|---|---|
| Loans with a known outcome (finished_ok / defaulted) | 234 |
| Usable after requiring ≥6 months of pre-loan history | 214 |
| Mean health_score — defaulted loans (n=25) | 49.8 |
| Mean health_score — repaid loans (n=189) | 52.3 |
| **AUC (health_score ranking repayment higher)** | **0.561** |

0.5 = no better than chance, 1.0 = perfect discrimination. **0.561 is weak** —
close to random, far from the 22.8-vs-42.8 framing's implied strength.

**Takeaway:** the score has *some* real signal (>0.5, and consistent in
direction) but nowhere near what the original claim implied. This is the
concrete case for improvement #1 (calibrate the health-score weights via
logistic regression on these same 214 leakage-free examples, rather than the
current hand-picked weights) — a natural next step now that this eval
harness exists to measure whether calibration actually helps.

## 2. 24-month balance forecast (6-month backtest)

`analysis/forecast_backtest.py`

For 4,497 accounts: cut history at a point, build the Twin and forecast from
data strictly before the cutoff, compare the forecast's month-6 balance to
the account's real balance 6 months later.

| | value |
|---|---|
| Accounts backtested | 4,497 |
| Mean absolute error (MAE) | 1,785 |
| Median absolute error | 1,087 |
| Median actual balance (scale reference) | 3,851 |
| **MAE as % of median balance** | **46.3%** |
| Bias | −239 (forecast slightly undershoots — pessimistic) |
| Forecasts within 20% of actual | 36.8% |

**Takeaway:** the linear forecast is directionally unbiased (small −239
bias) but individually noisy — only about a third of forecasts land within
20% of the real outcome 6 months out. This is the concrete case for
improvement #3 (confidence bands from `spending_volatility` instead of a
single point estimate) — a range like "8,000–14,000" would honestly
represent this much error instead of implying false precision with a single
number.

## What this changes about the pitch

Don't present "22.8 vs 42.8" as-is — it's measuring the wrong thing
(post-outcome data). Presenting the leakage-free **0.561 AUC** honestly, plus
the forecast's **46.3% MAE**, is a weaker headline number but a defensible
one — and turning "AUC went from ~0.56 to X after calibration" into an actual
before/after story is a stronger demo moment than a single unverified
average-gap claim.
