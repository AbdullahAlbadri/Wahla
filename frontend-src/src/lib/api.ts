// Financial Digital Twin API client — the single bridge to the backend.
// Everything the UI shows comes from Twin state, never raw transactions.

export const API_BASE =
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";

export interface TwinState {
  account_id: number;
  monthly_income: number;
  monthly_expenses: number;
  net_cashflow: number;
  savings_rate: number;
  debt_ratio: number;
  monthly_loan_payment: number;
  current_balance: number;
  emergency_fund_months: number;
  financial_health_score: number;
  financial_personality: string;
  personality_confidence: number;
  risk_level: "low" | "medium" | "high";
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
  };
}

export interface TwinDiffEntry {
  attribute: string;
  before: number | string;
  after: number | string;
  delta: number | null;
  reasons: string[];
}

export interface SimulationResult {
  simulation: string;
  verdict: "safe" | "caution" | "risky" | "dangerous";
  before: Record<string, any>;
  after: Record<string, any>;
  twin_diff: TwinDiffEntry[];
  forecast_after: TwinState["forecast"];
  explanation: string;
  total_commitment: number;
  validation: { check: string; severity: string; message: string }[];
  health_report: { summary: string };
}

export interface DemoAccount {
  id: number;
  title: string;
  bank: string;
  mask: string;
  persona: string;
  health_score: number | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export const fetchAccounts = () => get<DemoAccount[]>("/api/accounts");

export const fetchTwin = (accountId: number) =>
  get<TwinState>(`/api/twin/${accountId}`);

export async function simulateDecision(
  accountId: number,
  decision: { type: string; monthly: number; months: number; hasDownPayment: boolean },
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/api/simulate/${accountId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(decision),
  });
  if (!res.ok) throw new Error(`simulate: ${res.status}`);
  return res.json();
}

export const fetchAlternatives = (
  accountId: number,
  monthly: number,
  months: number,
) =>
  get<any>(`/api/alternatives/${accountId}?monthly=${monthly}&months=${months}`);

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
