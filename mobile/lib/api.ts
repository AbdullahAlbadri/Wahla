// Financial Digital Twin API client — the single bridge to the backend.
// Everything the UI shows comes from Twin state, never raw transactions.
// Mirrors the existing web client at frontend-src/src/lib/api.ts, trimmed to
// the endpoints this app uses and adapted for React Native (no import.meta).

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

// Fixed per scope — no account-picker screen in this app.
export const ACCOUNT_ID = 21;

export interface TwinState {
  account_id: number;
  monthly_income: number;
  monthly_expenses: number;
  net_cashflow: number;
  savings_rate: number;
  debt_ratio: number;
  monthly_loan_payment: number;
  current_balance: number;
  avg_monthly_balance: number;
  emergency_fund_months: number;
  income_stability: number;
  spending_volatility: number;
  cashflow_stability: number;
  financial_health_score: number;
  financial_personality: string;
  personality_confidence: number;
  personality_scores: Record<string, number>;
  risk_level: "low" | "medium" | "high";
  category_ratios: Record<string, number>;
  months_of_history: number;
  last_updated: string;
  recurring_payments: { amount: number; category: string; monthly: boolean }[];
  memory: {
    date: string | null;
    type: string;
    title: string;
    amount?: number;
    outcome?: string;
  }[];
  forecast: {
    horizon_months: number;
    projected_balances: number[];
    balance_in_12m: number;
    balance_in_24m: number;
    months_to_zero: number | null;
    confidence: { score: number; label: "high" | "medium" | "low" };
  };
}

export interface TwinDiffEntry {
  attribute: string;
  before: number | string;
  after: number | string;
  delta: number | null;
  reasons: string[];
}

// Mirrors FinancialTwin.snapshot() in twin/engine.py exactly — the fixed
// set of fields the backend actually puts in before/after.
export interface TwinSnapshot {
  monthly_income: number;
  monthly_expenses: number;
  net_cashflow: number;
  savings_rate: number;
  debt_ratio: number;
  current_balance: number;
  emergency_fund_months: number;
  financial_health_score: number;
  financial_personality: string;
  personality_confidence: number;
  risk_level: "low" | "medium" | "high";
  monthly_loan_payment: number;
}

export interface SimulationResult {
  simulation: string;
  verdict: "safe" | "caution" | "risky" | "dangerous";
  before: TwinSnapshot;
  after: TwinSnapshot;
  twin_diff: TwinDiffEntry[];
  forecast_after: TwinState["forecast"];
  explanation: string;
  total_commitment: number;
  validation: { check: string; severity: string; message: string }[];
  health_report: { summary: string };
  confidence: { score: number; label: "high" | "medium" | "low" };
}

export interface AlternativesResult {
  current_verdict: "safe" | "caution" | "risky" | "dangerous";
  best_scenario: string;
  reduce_payment: {
    suggested_monthly: number;
    verdict: string | null;
    health_after: number | null;
  };
  longer_duration: { months: number; monthly: number; verdict: string; health_after: number };
  delay: { months_to_save_buffer: number | null };
  use_liquidity: { feasible: boolean; verdict: string | null; health_after: number | null; balance_after: number | null };
  invest_instead: { verdict: string; health_after: number; projected_value: number; projected_gain: number };
  restructure_debt: { feasible: boolean; freed_up_monthly: number; verdict: string | null; health_after: number | null };
  review_subscriptions: { recurring_total: number; count: number };
}

export interface BudgetResult {
  ratios: { needs: number; wants: number; savings: number };
  targets: { needs: number; wants: number; savings: number };
  monthly_adjustment: null | {
    rule: string;
    action: string;
    detail: string;
    shift_pct?: number;
    current: BudgetResult["ratios"];
  };
}

export interface DecisionCheckResult {
  allow: boolean;
  step: number;
  reason: string;
}

// Mirrors twin/config.py's illustrative product catalogs exactly (real
// shapes returned by twin/suggestions.py, not placeholders).
export interface SavingsTier { max_balance: number | null; aer_min: number; aer_max: number }
export interface CarFinancingOption { years: number; annual_rate: number; months: number; installment: number }
export interface RealEstateFinancingOption { years: number; financing_ratio: number; installment: number }
export interface BusinessFinancingTier {
  size: string;
  max_amount: number;
  margin_min: number | null;
  margin_max: number | null;
  max_months: number | null;
}

export type SuggestionItem = (
  | { type: "idle_cash_savings"; title: string; detail: string; product: string; sweep_amount?: number; target_tier?: SavingsTier }
  | {
      type: "purchase_financing";
      title: string;
      detail: string;
      allow: boolean;
      recommended?: CarFinancingOption | RealEstateFinancingOption;
      fallback_tight?: (CarFinancingOption | RealEstateFinancingOption) & { note: string };
    }
  | { type: "revolving_debt"; title: string; root_cause: string; options?: { action: string; detail: string }[] }
  | { type: "card_fee_mismatch"; title: string; detail: string; action: string }
  | { type: "business_financing"; title: string; detail: string; tier: BusinessFinancingTier }
) & { basis?: string[] };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export const fetchTwin = (accountId: number) => get<TwinState>(`/api/twin/${accountId}`);

export interface TwinHistoryPoint {
  month: string; // "YYYY-MM"
  financial_health_score: number;
  savings_rate: number;
  net_cashflow: number;
  debt_ratio: number;
  financial_personality: string;
  personality_confidence: number;
  monthly_income: number;
  monthly_expenses: number;
  category_ratios: Record<string, number>;
}

// Real recomputed monthly snapshots (see twin/features.py::historical_snapshots
// on the backend) — empty array for accounts with too little history, never
// a fabricated series.
export const fetchTwinHistory = (accountId: number, months = 12) =>
  get<TwinHistoryPoint[]>(`/api/twin/${accountId}/history?months=${months}`);

export interface ConfidenceScore { score: number; label: "high" | "medium" | "low" }

export interface TwinPredictions {
  months_observed: number;
  overspending_probability: number;
  deficit_probability: number;
  debt_increase_probability: number;
  confidence: ConfidenceScore;
}

// Real empirical frequencies from the account's own historical months (see
// twin/features.py::predict_from_history) — null when there's too little
// history for any of them to mean anything.
export const fetchTwinPredictions = (accountId: number) =>
  get<TwinPredictions | null>(`/api/twin/${accountId}/predictions`);

export interface DecisionPattern {
  type: "loan_track_record" | "month_end_concentration";
  detail: string;
  [key: string]: unknown;
}

// Real, evidence-backed behavioral patterns (see twin/patterns.py) — never
// a single-occurrence guess.
export const fetchTwinPatterns = (accountId: number) =>
  get<DecisionPattern[]>(`/api/twin/${accountId}/patterns`);

export const simulateDecision = (
  accountId: number,
  decision: { type: string; monthly: number; months: number; hasDownPayment: boolean; down_payment?: number },
) => post<SimulationResult>(`/api/simulate/${accountId}`, decision);

export const fetchAlternatives = (accountId: number, monthly: number, months: number) =>
  get<AlternativesResult>(`/api/alternatives/${accountId}?monthly=${monthly}&months=${months}`);

export const fetchBudget = (accountId: number) => get<BudgetResult>(`/api/budget/${accountId}`);

export const checkDecision = (
  accountId: number,
  req: { is_need: boolean; amount: number; can_pay_installments: boolean },
) => post<DecisionCheckResult>(`/api/decision-check/${accountId}`, req);

export const fetchSuggestions = (
  accountId: number,
  req: { signals: Record<string, unknown>; history: unknown[] },
) => post<SuggestionItem[]>(`/api/suggestions/${accountId}`, req);

// Mobile app's Simulator screen calls this "deferred"; the backend calls it "bnpl".
export const COMMITMENT_TYPE_TO_API: Record<string, string> = {
  loan: "loan",
  installment: "installment",
  deferred: "bnpl",
  subscription: "subscription",
};

// Arabic labels for Twin enums (presentation only — logic stays in backend)
export const personalityLabels: Record<string, string> = {
  financially_disciplined: "منضبط ماليًا",
  balanced_saver: "مدخر متوازن",
  goal_oriented_planner: "مخطط لأهدافه",
  conservative_spender: "منفق محافظ",
  impulse_shopper: "إنفاق اندفاعي",
  risk_tolerant: "متقبل للمخاطر",
  at_risk: "وضع حرج",
};

export const riskLabels: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
};

export const verdictLabels: Record<
  string,
  { title: string; sub: string; tone: "ok" | "warn" | "risk" }
> = {
  safe: {
    title: "القرار آمن",
    sub: "وضعك المالي يتحمل هذا الالتزام بأريحية.",
    tone: "ok",
  },
  caution: {
    title: "القرار يحتاج انتباه",
    sub: "الالتزام ممكن، لكنه يقلص هامش الأمان لديك.",
    tone: "warn",
  },
  risky: {
    title: "القرار يحتاج مراجعة",
    sub: "القسط الجديد يضغط وضعك المالي بشكل ملحوظ.",
    tone: "warn",
  },
  dangerous: {
    title: "القرار غير آمن حاليًا",
    sub: "هذا الالتزام قد يقودك إلى عجز مالي خلال أشهر.",
    tone: "risk",
  },
};

// Arabic phrasing for TwinDiff reasons (backend emits canonical English)
export const reasonLabels: Record<string, string> = {
  "monthly obligations increased": "ارتفاع الالتزامات الشهرية",
  "monthly obligations decreased": "انخفاض الالتزامات الشهرية",
  "recurring spending increased": "زيادة المصروفات المتكررة",
  "recurring spending decreased": "انخفاض المصروفات المتكررة",
  "income increased": "ارتفاع الدخل",
  "income decreased": "انخفاض الدخل",
  "cash reserve grew": "نمو الاحتياطي النقدي",
  "cash reserve consumed": "استهلاك الاحتياطي النقدي",
  "savings rate improved": "تحسن معدل الادخار",
  "savings rate fell": "انخفاض معدل الادخار",
  "debt ratio increased": "ارتفاع نسبة الالتزامات للدخل",
  "debt ratio decreased": "انخفاض نسبة الالتزامات للدخل",
  "liquidity buffer grew": "نمو هامش السيولة",
  "liquidity buffer shrank": "تقلص هامش السيولة",
  "overall health improved": "تحسن الصحة المالية",
  "overall health deteriorated": "تراجع الصحة المالية",
};

export const attributeLabels: Record<string, string> = {
  financial_health_score: "الصحة المالية",
  savings_rate: "معدل الادخار",
  net_cashflow: "الفائض الشهري",
  monthly_expenses: "المصروفات الشهرية",
  emergency_fund_months: "صندوق الطوارئ",
  debt_ratio: "نسبة الالتزامات",
  current_balance: "الرصيد",
  risk_level: "مستوى الضغط",
  financial_personality: "الشخصية المالية",
  personality_confidence: "دقة التصنيف",
  monthly_loan_payment: "أقساط القروض",
  monthly_income: "الدخل الشهري",
};

export const memoryTypeLabels: Record<string, string> = {
  salary_detected: "رصد دخل شهري منتظم",
  salary_change: "تغيّر في الدخل",
  loan_granted: "حصول على تمويل",
  loan_finished: "انتهاء تمويل",
  large_purchase: "عملية شراء كبيرة",
  first_overdraft: "دخول الحساب في السحب المكشوف",
};

// Static labels for the coarse categories category_ratios actually contains
// (Berka's real granularity — see twin/config.py NEED_CATEGORIES/WANT_CATEGORIES).
// Do NOT invent categories the backend doesn't return.
export const categoryLabels: Record<string, { label: string; icon: string; color: string }> = {
  household: { label: "احتياجات المنزل", icon: "home-outline", color: "#6366F1" },
  loan_payment: { label: "أقساط تمويل", icon: "card-outline", color: "#F59E0B" },
  insurance: { label: "تأمين", icon: "shield-checkmark-outline", color: "#10B981" },
  bank_fee: { label: "رسوم بنكية", icon: "receipt-outline", color: "#EF4444" },
  overdraft_fee: { label: "رسوم سحب مكشوف", icon: "alert-circle-outline", color: "#DC2626" },
  uncategorized: { label: "غير مصنف", icon: "ellipsis-horizontal-outline", color: "#9CA3AF" },
};
