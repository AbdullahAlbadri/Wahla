// Maps real Wahla API responses onto the mobile app's existing
// FinancialHealthContextType shape (see context/FinancialHealthContext.tsx),
// so the screens' JSX/rendering logic barely changes — only where the data
// comes from changes. Every field with no backend equivalent is either
// hidden, honestly simplified, or derived from a real number — never
// fabricated. See analysis notes inline per field.
import type {
  BudgetResult,
  SuggestionItem,
  TwinState,
} from "./api";
import { categoryLabels, personalityLabels } from "./api";

// Mirrors twin/report.py::_grade() thresholds exactly (75/55/35) so the
// label never drifts out of sync with what the backend would say — this
// avoids needing a POST /api/simulate call just to fetch a grade string.
export function gradeFor(score: number): "excellent" | "good" | "fair" | "poor" {
  if (score >= 75) return "excellent";
  if (score >= 55) return "good";
  if (score >= 35) return "fair";
  return "poor";
}

const scoreLabelAr: Record<string, string> = {
  excellent: "صحة ممتازة",
  good: "صحة جيدة",
  fair: "صحة مقبولة",
  poor: "صحة ضعيفة",
};

const scoreDescriptionAr: Record<string, string> = {
  excellent: "وضعك المالي قوي ومستقر — حافظ على هذا النمط.",
  good: "أنت في مسار جيد، مع تحسينات بسيطة ستصل للصحة الممتازة.",
  fair: "وضعك المالي مقبول، لكنه يحتاج بعض الانتباه لتفادي أي ضغط مستقبلي.",
  poor: "وضعك المالي يحتاج مراجعة عاجلة — ابدأ بأبسط التوصيات أدناه.",
};

// Static, non-data taglines per personality type (same spirit as
// verdictLabels.sub in lib/api.ts) — the archetype label itself comes
// straight from the real financial_personality field.
const archetypeDescriptionAr: Record<string, string> = {
  financially_disciplined: "أنت حذر في إنفاقك وتركّز على الادخار، مع سجل خالٍ من السحب المكشوف.",
  balanced_saver: "توازن جيد بين الإنفاق والادخار، مع دخل مستقر يدعم استقرارك المالي.",
  goal_oriented_planner: "تميل إلى الالتزامات المنظمة والتخطيط المسبق لأهدافك المالية.",
  conservative_spender: "نمط إنفاق ثابت ومحافظ، وتفضّل الكاش على الائتمان.",
  impulse_shopper: "إنفاقك يرتفع في عطلات نهاية الأسبوع، مع تذبذب ملحوظ في المبالغ.",
  risk_tolerant: "مرتاح لمستوى أعلى من الالتزامات المالية، مع هامش أمان أضيق.",
  at_risk: "وضعك المالي الحالي يحتاج متابعة — إنفاقك يتجاوز دخلك في بعض الأشهر.",
};

export interface BudgetSegment {
  id: "needs" | "wants" | "savings";
  label: string;
  amount: number;
  pct: number;
  color: string;
  icon: string;
  ideal: number;
}

function buildBudgetSegments(twin: TwinState, budget: BudgetResult): BudgetSegment[] {
  const income = twin.monthly_income || 0;
  return [
    {
      id: "needs",
      label: "احتياجات",
      amount: Math.round(budget.ratios.needs * income),
      pct: Math.round(budget.ratios.needs * 100),
      color: "#E07A5F",
      icon: "home-outline",
      ideal: Math.round(budget.targets.needs * 100),
    },
    {
      id: "wants",
      label: "رغبات",
      amount: Math.round(budget.ratios.wants * income),
      pct: Math.round(budget.ratios.wants * 100),
      color: "#FFFFFF",
      icon: "cart-outline",
      ideal: Math.round(budget.targets.wants * 100),
    },
    {
      id: "savings",
      label: "ادخار",
      amount: Math.round(budget.ratios.savings * income),
      pct: Math.round(budget.ratios.savings * 100),
      color: "#9AB4D6",
      icon: "wallet-outline",
      ideal: Math.round(budget.targets.savings * 100),
    },
  ];
}

function buildSpendingCategories(twin: TwinState) {
  const expenses = twin.monthly_expenses || 0;
  return Object.entries(twin.category_ratios || {})
    .map(([key, ratio], i) => {
      const catKey = key.replace("_ratio", "");
      const meta = categoryLabels[catKey] ?? {
        label: catKey,
        icon: "ellipsis-horizontal-outline",
        color: "#7A90AD",
      };
      const amount = Math.round(ratio * expenses);
      return {
        id: String(i + 1),
        name: meta.label,
        amount,
        // No per-category budget exists in the backend — set equal to the
        // real amount so no fabricated "over budget" flag ever fires,
        // rather than inventing a target we don't have.
        budget: amount,
        percentage: Math.round(ratio * 100),
        color: meta.color,
        icon: meta.icon,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

// personality_scores measures archetype affinity (0-1 per personality
// type) — NOT the same axis as "financial competency area health" the
// mobile mock's 6 fictional dimensions implied. Rather than force-fit one
// onto the other (misrepresenting what the number means), this derives a
// smaller set of honestly-labeled dimensions from real Twin fields that
// already have direct, unambiguous meaning.
function buildDimensions(twin: TwinState) {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * 100)));
  return [
    { label: "معدل الادخار", value: clamp(twin.savings_rate), color: "#9AB4D6" },
    { label: "إدارة الديون", value: clamp(1 - Math.min(1, twin.debt_ratio)), color: "#9AB4D6" },
    {
      label: "صندوق الطوارئ",
      value: clamp(Math.min(1, twin.emergency_fund_months / 6)),
      color: twin.emergency_fund_months >= 3 ? "#9AB4D6" : "#E07A5F",
    },
    { label: "استقرار الدخل", value: clamp(twin.income_stability ?? 0), color: "#9AB4D6" },
  ];
}

// Only fields the real suggestions endpoint actually returns are mapped;
// impact/effort/points have no backend equivalent, so they're set to a
// single neutral, honestly-non-fabricated value rather than invented per
// suggestion — sweep_amount (idle_cash_savings only) is the one place a
// real number exists for "savings".
const suggestionTypeLabel: Record<string, string> = {
  idle_cash_savings: "ادخار",
  purchase_financing: "تمويل",
  revolving_debt: "ديون",
  card_fee_mismatch: "بطاقات",
  business_financing: "أعمال",
};

function buildRecommendations(suggestions: SuggestionItem[]) {
  return suggestions.map((s, i) => ({
    id: String(i + 1),
    title: s.title,
    description: "detail" in s ? s.detail : "",
    impact: "medium" as const,
    impactPoints: 0,
    effort: "easy" as const,
    category: suggestionTypeLabel[s.type] ?? s.type,
    savings: s.type === "idle_cash_savings" ? (s as any).sweep_amount ?? 0 : 0,
  }));
}

export interface AdaptedFinancialHealth {
  score: number;
  scoreLabel: string;
  scoreDescription: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  currentBalance: number;
  emergencyFundMonths: number;
  savingsRate: number;
  debtRatio: number;
  monthsOfHistory: number;
  lastUpdated: string;
  financialPersonality: string;
  archetypeName: string;
  archetypeDescription: string;
  personalityConfidence: number;
  budgetSegments: BudgetSegment[];
  spendingCategories: ReturnType<typeof buildSpendingCategories>;
  dimensions: ReturnType<typeof buildDimensions>;
  recommendations: ReturnType<typeof buildRecommendations>;
  forecast: TwinState["forecast"];
}

export function buildFinancialHealthData(
  twin: TwinState,
  budget: BudgetResult,
  suggestions: SuggestionItem[],
): AdaptedFinancialHealth {
  const score = Math.round(twin.financial_health_score);
  const grade = gradeFor(score);
  return {
    score,
    scoreLabel: scoreLabelAr[grade],
    scoreDescription: scoreDescriptionAr[grade],
    monthlyIncome: twin.monthly_income,
    monthlyExpenses: twin.monthly_expenses,
    monthlySavings: twin.net_cashflow,
    currentBalance: twin.current_balance,
    emergencyFundMonths: twin.emergency_fund_months,
    savingsRate: twin.savings_rate,
    debtRatio: twin.debt_ratio,
    lastUpdated: twin.last_updated,
    monthsOfHistory: twin.months_of_history,
    financialPersonality: twin.financial_personality,
    archetypeName: personalityLabels[twin.financial_personality] ?? twin.financial_personality,
    archetypeDescription:
      archetypeDescriptionAr[twin.financial_personality] ?? "",
    personalityConfidence: twin.personality_confidence,
    budgetSegments: buildBudgetSegments(twin, budget),
    spendingCategories: buildSpendingCategories(twin),
    dimensions: buildDimensions(twin),
    recommendations: buildRecommendations(suggestions),
    forecast: twin.forecast,
  };
}
