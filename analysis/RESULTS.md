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
direction) but nowhere near what the original claim implied.

## 1b. Does calibrating the weights with logistic regression actually help?

`analysis/calibrate_health_score.py`

Tested improvement #1 directly instead of assuming it would work: fit a
logistic regression on the same 4 health-score components (savings,
cashflow stability, debt ratio, emergency fund), predicting real default,
on the same 214 leakage-free examples (25 defaults). Evaluated honestly
with repeated 5-fold stratified cross-validation — not a single train/test
split, and not the in-sample fit, both of which would be optimistic on this
little data. One metric throughout: "discrimination AUC" — AUC of a risk
score (higher = more likely to default) against real default, so the
baseline's 0.561 (a flip of health_score, which runs the opposite way) and
every model below are directly comparable with no sign games.

| | discrimination AUC |
|---|---|
| Baseline (current hand-picked weights) | 0.561 |
| Calibrated weights — in-sample (optimistic, don't trust this one) | 0.613 |
| **Calibrated weights — cross-validated (honest, out-of-sample)** | **0.508** |
| 95% range across CV folds | 0.266 – 0.732 |

**Answer: no, free calibration does not help.** The in-sample number (0.613)
looks like an improvement, which is exactly the overfitting trap the CV
estimate is there to catch: with only 25 default events for a 4-parameter
model, there isn't enough signal to calibrate reliably (rule of thumb wants
~10+ events per parameter; this has ~6). The 95% range spans from
worse-than-random to decent, a symptom of too little data.

**Middle ground tested: shrink the fitted weights toward the current ones
instead of fitting freely** (Bayesian ridge, prior = current hand-picked
weights, `prior_strength` controls how hard to pull toward them):

| prior_strength | discrimination AUC |
|---|---|
| 0 (free fit) | 0.508 |
| 0.5 | 0.539 |
| 2 | 0.551 |
| 8 | 0.555 |
| 30 | 0.559 |
| 100 (≈ fixed baseline) | 0.561 |

Monotonic, and converges exactly to 0.561 at high strength — a real sanity
check that the math is doing what it should. **No amount of shrinkage beats
the baseline; the best any setting achieves is matching it.** So this isn't
"the idea was wrong" — it's that **25 labeled defaults can't support fitting
even a heavily-regularized 4-parameter model better than just keeping the
hand-picked weights.**

## 1c. Is there a stronger signal among the *other* ~15 computed features?

`analysis/feature_scan.py`

The 4 components above are the ones `health_score()` happens to use — not
necessarily the most predictive ones. Scanned every other feature
`build_account_features()` already computes (no new data needed) for raw
discrimination against real default, same 214 leakage-free examples:

| feature | AUC | direction |
|---|---|---|
| **cash_usage_ratio** | **0.726** | higher → more likely default |
| income_stability | 0.678 | lower → more likely default |
| emergency_fund_months | 0.619 | lower → more likely default |
| current_balance | 0.618 | lower → more likely default |
| spending_volatility | 0.606 | higher → more likely default |
| months_of_history | 0.604 | lower → more likely default |
| weekend_spending_ratio | 0.603 | higher → more likely default |
| financial_health_score (current formula) | 0.561 | — |
| debt_ratio (25% of the current formula's weight) | **0.500** | no signal at all |

`cash_usage_ratio` — how much of someone's spending is cash withdrawals,
already computed by `features.py`, never surfaced anywhere in the UI or
the health score — beats the entire current formula on its own, with no
fitting at all (a raw feature, not a fitted weight, so none of the
overfitting risk from section 1b applies to it directly).

**Verified this isn't just luck from scanning 18 candidates**: re-evaluated
`cash_usage_ratio`'s AUC across 30×5-fold cross-validation (same feature,
no re-selection per fold) — mean 0.727, median 0.729, closely matching the
full-sample 0.726. A fitted model would show a large in-sample-vs-CV gap
(section 1b did); a stable raw feature doesn't, and this one doesn't.

Caveat that's still real: choosing the best of 18 candidates *on the same
214 examples* is itself a mild form of selection bias (the "look elsewhere
effect") — the fold-stability check above addresses re-fitting risk, not
the initial selection step. Treat 0.726 as a strong lead to validate
against new loan outcomes as they arrive, not a guaranteed population
value.

**Concrete, low-risk recommendation**: `debt_ratio` currently gets 25% of
the health score's weight and has *zero* real discriminative power (AUC
0.500 — literal chance) in this leakage-free test, while `cash_usage_ratio`
gets 0% weight and is the single strongest signal found. Don't refit a new
4-parameter formula (section 1b already showed that fails at this sample
size) — simplest safe move is surfacing `cash_usage_ratio` as its own
signal (a UI insight, or a simple flag/threshold) rather than folding it
into a re-weighted composite score that would inherit the same
small-sample overfitting problem.

Real next steps, in order of cost: (a) relax the ≥6-months-history filter
to recover some of the 20 excluded loans, (b) get more labeled outcomes —
the underlying constraint, not a code problem.

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
(post-outcome data). The honest numbers are weaker but defensible: **0.561
AUC** (leakage-free) on the health score, **46.3% MAE** on the 6-month
forecast, and — tested, not assumed — **calibration doesn't beat the
hand-picked weights at this sample size** (0.493 CV AUC vs 0.561 baseline).

That last point is worth saying out loud to judges rather than hiding:
"we built an eval harness, tested whether ML calibration would help, and it
didn't at n=25 — so we know *why* we're not using it, instead of just not
having tried." That's a stronger technical story than either an unverified
average-gap claim or an ML feature added without checking it actually
works.
