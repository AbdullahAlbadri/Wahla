"""Does calibrating the health-score weights with real loan outcomes actually
help, or does 0.561 AUC just reflect a genuinely weak signal in the features
themselves?

Fits a logistic regression (implemented directly with numpy — no sklearn;
this is an offline analysis script, not part of the isolated twin/ package,
but keeping it dependency-light and auditable) on the same 4 components
health_score() already computes (savings/stability/debt/emergency-fund),
predicting real loan default, using the same leakage-free pre-loan-only
extraction as health_score_auc.py.

With only 25 default events in 214 examples, a single train/test split is
close to meaningless — reports repeated stratified k-fold cross-validated
AUC (honest, out-of-sample) alongside the in-sample fit, and is explicit
about the uncertainty that small-n implies.

Run: python3 analysis/calibrate_health_score.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd

from twin import config
from twin.data_loader import load_all
from twin.features import build_account_features

MIN_MONTHS_HISTORY = 6
N_FOLDS = 5
N_REPEATS = 50


def _components(feats: dict) -> np.ndarray:
    """Same 4 inputs health_score() weights — before weighting, not after."""
    savings = np.clip(feats["savings_rate"] / 0.30, 0, 1)
    stability = np.clip(feats["cashflow_stability"], 0, 1)
    debt = 1 - np.clip(feats["debt_ratio"] / 0.40, 0, 1)
    ef = np.clip(feats["emergency_fund_months"] / config.EMERGENCY_FUND_MONTHS_TARGET, 0, 1)
    return np.array([savings, stability, debt, ef])


def extract_examples():
    print("loading + cleaning data...", file=sys.stderr)
    data = load_all()
    tx, loans = data["transactions"], data["loans"]
    outcomes = loans[loans["status"].isin(["finished_ok", "defaulted"])]

    X, y, current_score = [], [], []
    for _, loan in outcomes.iterrows():
        acct_id, granted = loan["account_id"], loan["granted_date"]
        acct_tx = tx[(tx["account_id"] == acct_id) & (tx["trans_date"] < granted)]
        if acct_tx.empty or acct_tx["month"].nunique() < MIN_MONTHS_HISTORY:
            continue
        prior_loans = loans[(loans["account_id"] == acct_id)
                             & (loans["granted_date"] < granted)
                             & (loans["loan_id"] != loan["loan_id"])]
        feats = build_account_features(acct_tx, prior_loans)
        if not feats:
            continue
        X.append(_components(feats))
        y.append(1 if loan["status"] == "defaulted" else 0)
        current_score.append(feats["financial_health_score"])
    return np.array(X), np.array(y), np.array(current_score)


def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -30, 30)))


def fit_logistic(X, y, lr=0.5, epochs=8000, l2=0.05):
    n, d = X.shape
    Xa = np.hstack([np.ones((n, 1)), X])
    w = np.zeros(d + 1)
    for _ in range(epochs):
        p = sigmoid(Xa @ w)
        grad = Xa.T @ (p - y) / n
        grad[1:] += l2 * w[1:] / n
        w -= lr * grad
    return w  # w[0]=intercept, w[1:]=[savings, stability, debt, ef]


def predict_proba(w, X):
    Xa = np.hstack([np.ones((X.shape[0], 1)), X])
    return sigmoid(Xa @ w)


def auc(scores, labels):
    n = len(scores)
    order = sorted(range(n), key=lambda i: scores[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and scores[order[j + 1]] == scores[order[i]]:
            j += 1
        avg_rank = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg_rank
        i = j + 1
    n_pos, n_neg = sum(labels), n - sum(labels)
    if n_pos == 0 or n_neg == 0:
        return None
    rank_sum_pos = sum(ranks[i] for i in range(n) if labels[i] == 1)
    return (rank_sum_pos - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def stratified_kfold_indices(y, k, rng):
    pos_idx = np.where(y == 1)[0]
    neg_idx = np.where(y == 0)[0]
    rng.shuffle(pos_idx)
    rng.shuffle(neg_idx)
    pos_folds = np.array_split(pos_idx, k)
    neg_folds = np.array_split(neg_idx, k)
    for i in range(k):
        test = np.concatenate([pos_folds[i], neg_folds[i]])
        train = np.setdiff1d(np.arange(len(y)), test)
        yield train, test


def main():
    X, y, current_score = extract_examples()
    print(f"\n{len(y)} examples ({y.sum()} defaulted, {len(y) - y.sum()} repaid) "
          f"— same leakage-free extraction as health_score_auc.py\n")

    baseline_auc = auc(list(current_score), list(y))
    print(f"Baseline (current hand-picked weights) AUC vs default: {baseline_auc:.3f}  "
          f"[predicting repayment: {1 - baseline_auc:.3f}]")

    # honest out-of-sample estimate: repeated stratified k-fold
    cv_aucs = []
    rng = np.random.default_rng(42)
    for _ in range(N_REPEATS):
        for train_idx, test_idx in stratified_kfold_indices(y, N_FOLDS, rng):
            w = fit_logistic(X[train_idx], y[train_idx])
            p = predict_proba(w, X[test_idx])
            fold_auc = auc(list(p), list(y[test_idx]))
            if fold_auc is not None:
                cv_aucs.append(fold_auc)

    cv_aucs = np.array(cv_aucs)
    print(f"\nCross-validated (out-of-sample) AUC over {N_FOLDS}-fold x {N_REPEATS} repeats:")
    print(f"  predicting default: mean {cv_aucs.mean():.3f}, "
          f"median {np.median(cv_aucs):.3f}, std {cv_aucs.std():.3f}")
    print(f"  predicting repayment (useful framing): mean {1 - cv_aucs.mean():.3f}")
    print(f"  [95% range across folds: {np.percentile(cv_aucs, 2.5):.3f} - "
          f"{np.percentile(cv_aucs, 97.5):.3f}]  <- this wide because n=25 defaults is tiny")

    # final weights fit on ALL data, for reference if this gets deployed
    w_full = fit_logistic(X, y)
    raw = -w_full[1:]  # flip sign: these components are protective (higher = lower default risk)
    normalized = np.clip(raw, 0, None)
    normalized = normalized / normalized.sum() if normalized.sum() > 0 else raw
    names = ["savings_rate", "cashflow_stability", "debt_ratio", "emergency_fund"]
    print(f"\nCalibrated weights (fit on all {len(y)} examples, for reference):")
    for name, w_val, cur in zip(names, normalized, config.HEALTH_SCORE_WEIGHTS.values()):
        print(f"  {name:20s} current={cur:.2f}  calibrated={w_val:.2f}")

    in_sample_p = predict_proba(w_full, X)
    in_sample_auc = auc(list(in_sample_p), list(y))
    print(f"\nIn-sample AUC with calibrated weights (optimistic, NOT the honest estimate): "
          f"{in_sample_auc:.3f}")
    print("Compare the CV mean above to the baseline 0.561 — that's the real answer.")


if __name__ == "__main__":
    main()
