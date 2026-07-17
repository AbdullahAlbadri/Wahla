import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone } from "@/components/wahla/Phone";
import { BottomNav } from "@/components/wahla/BottomNav";
import { useTwin, commitmentsOf, formatSAR } from "@/lib/wahla-store";
import {
  personalityLabels,
  riskLabels,
  memoryTypeLabels,
  type TwinState,
} from "@/lib/api";
import logoUrl from "@/assets/wahla-logo-transparent.png";
import {
  TrendingUp, Wallet, Receipt, ShoppingBag, Sparkles, HeartPulse, History,
  ShieldCheck, Target, BarChart2,
} from "lucide-react";

export const Route = createFileRoute("/home")({
  component: Home,
});

// تصنيف المصروفات بمنطق عميق
function classifySpending(twin: TwinState) {
  const needs: number[] = [];
  const wants: number[] = [];
  const savings: number[] = [];

  for (const p of twin.recurring_payments) {
    const cat = (p.category ?? "").toLowerCase();
    // احتياجات: طعام، علاج، مواصلات، سكن، تأمين، فواتير
    if (/(food|grocery|health|medical|transport|utility|bill|insurance|rent|housing|fuel|pharmacy)/i.test(cat)) {
      needs.push(p.amount);
    }
    // ديون وأقساط
    else if (/(loan|credit|bnpl|installment|debt|tamara|tabby|deferred)/i.test(cat)) {
      savings.push(p.amount); // تُعدّ التزامات لا ترفيه
    }
    // ترفيه ورغبات
    else if (/(entertainment|subscription|streaming|gaming|cafe|restaurant|fashion|beauty|sport)/i.test(cat)) {
      wants.push(p.amount);
    }
    // باقي → احتياجات افتراضية
    else {
      needs.push(p.amount);
    }
  }

  const totalNeeds = needs.reduce((a, b) => a + b, 0) + twin.monthly_loan_payment;
  const totalWants = wants.reduce((a, b) => a + b, 0);
  const totalSavings = Math.max(0, twin.net_cashflow); // الفائض = ادخار محتمل
  const totalObligations = savings.reduce((a, b) => a + b, 0);

  return {
    needs: totalNeeds,
    wants: totalWants,
    savings: totalSavings + totalObligations,
    total: totalNeeds + totalWants + totalSavings + totalObligations || 1,
  };
}

// نقاط القوة المالية بناءً على بيانات التوأم
function strengthPoints(twin: TwinState): string[] {
  const pts: string[] = [];
  if (twin.debt_ratio < 0.2) pts.push("نسبة التزاماتك من دخلك منخفضة جدًا");
  else if (twin.monthly_loan_payment === 0) pts.push("لا توجد عليك قروض نشطة");
  if (twin.emergency_fund_months >= 3) pts.push(`احتياطيك يغطي ${twin.emergency_fund_months.toFixed(1)} أشهر`);
  if (twin.savings_rate > 0.2) pts.push(`معدل ادخارك ${Math.round(twin.savings_rate * 100)}٪ من الدخل`);
  if (twin.net_cashflow > 0) pts.push(`فائض شهري ${formatSAR(twin.net_cashflow)} ريال`);
  if (twin.risk_level === "low") pts.push("مستوى المخاطرة المالية منخفض");
  return pts.slice(0, 3);
}

function Home() {
  const { data: twin, isLoading, error } = useTwin();

  if (isLoading || !twin) {
    return (
      <Phone>
        <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center">
          <div className="w-14 h-14 rounded-full border-4 border-navy-soft border-t-coral animate-spin" />
          <p className="mt-5 text-[15px] text-navy font-medium">
            {error ? "تعذر الاتصال بالتوأم الرقمي" : "نبني توأمك الرقمي المالي..."}
          </p>
          {error != null && (
            <p className="mt-2 text-[12px] text-ink-muted">
              تأكد من تشغيل الخادم ثم أعد المحاولة
            </p>
          )}
        </div>
      </Phone>
    );
  }

  const surplus = twin.net_cashflow;
  const isSurplusNeg = surplus < 0;
  const commitments = commitmentsOf(twin);
  const stable = twin.risk_level === "low";
  const balance6m = twin.forecast?.projected_balances?.[5] ?? twin.current_balance;
  const healthScore = Math.min(Math.round(twin.financial_health_score), 100);
  const spending = classifySpending(twin);
  const strengths = strengthPoints(twin);

  return (
    <Phone>
      <div className="flex flex-col min-h-[100dvh]">
        {/* الترويسة */}
        <div className="px-5 pt-8 pb-4 flex items-start justify-between">
          <img src={logoUrl} alt="وهلة" className="h-9 w-auto object-contain" />
          <div className="text-right">
            <p className="text-[13px] text-ink-muted">مرحبًا</p>
            <h1 className="text-[22px] font-bold text-navy">عبدالله</h1>
          </div>
        </div>

        <div className="px-5 space-y-4 pb-6">
          {/* بطاقة الفائض / العجز */}
          <div className={`rounded-2xl text-white p-5 relative overflow-hidden ${isSurplusNeg ? "bg-coral" : "bg-navy"}`}>
            <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full border ${
                    stable
                      ? "bg-success/20 text-success-soft border-success/30"
                      : "bg-warning/20 text-white border-warning/30"
                  }`}
                >
                  {stable ? "مستقر" : `ضغط ${riskLabels[twin.risk_level]}`}
                </span>
                <p className="text-[13px] text-white/70">{isSurplusNeg ? "العجز الشهري" : "الفائض الشهري"}</p>
              </div>
              <div className="mt-2 flex items-baseline gap-2 justify-end">
                <span className="text-[14px] text-white/70">ريال</span>
                <span className="text-[36px] font-bold">{formatSAR(surplus)}</span>
              </div>
              <p className="text-[12px] text-white/60 mt-1 text-right">
                {isSurplusNeg ? "الالتزامات تتجاوز الدخل بهذا المقدار" : "المتبقي بعد الالتزامات والمصروفات"}
              </p>
            </div>
          </div>

          {/* الصحة المالية */}
          <div className="card-soft p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-navy bg-navy-soft px-2 py-1 rounded-full">
                {personalityLabels[twin.financial_personality] ?? twin.financial_personality}
              </span>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-navy">الصحة المالية</h3>
                <HeartPulse className="w-4 h-4 text-coral" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 flex-row-reverse">
              <span className="text-[24px] font-bold text-navy">{healthScore}</span>
              {/* شريط يمتلئ من اليمين */}
              <div className="flex-1 h-2.5 rounded-full bg-surface border border-border overflow-hidden" style={{ direction: "rtl" }}>
                <div
                  className="h-full rounded-full bg-coral transition-all duration-700"
                  style={{ width: `${healthScore}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-muted">من 100</span>
            </div>
          </div>

          {/* الأرقام الأربعة */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={TrendingUp} label="الدخل الشهري" value={formatSAR(twin.monthly_income)} />
            <MetricCard icon={Receipt} label="الالتزامات" value={formatSAR(commitments)} />
            <MetricCard icon={ShoppingBag} label="متوسط المصروفات" value={formatSAR(twin.monthly_expenses)} />
            <MetricCard icon={Wallet} label="الرصيد الحالي" value={formatSAR(twin.current_balance)} warn={twin.current_balance < 0} />
          </div>

          {/* أبعاد الصحة المالية */}
          <div className="card-soft p-4">
            <div className="flex items-center gap-2 justify-end mb-3">
              <h3 className="text-[14px] font-semibold text-navy">أبعاد صحتك المالية</h3>
              <BarChart2 className="w-4 h-4 text-coral" />
            </div>
            <div className="space-y-3">
              <HealthDimension
                label="معدل الادخار"
                value={Math.round(twin.savings_rate * 100)}
                max={100}
                target={20}
                unit="٪"
              />
              <HealthDimension
                label="نسبة الالتزامات من الدخل"
                value={Math.round(twin.debt_ratio * 100)}
                max={100}
                target={40}
                unit="٪"
                invertColor
              />
              <HealthDimension
                label="صندوق الطوارئ والادخار"
                value={Math.round(Math.min(twin.emergency_fund_months, 6) * 100 / 6)}
                max={100}
                target={50}
                unit={`${twin.emergency_fund_months.toFixed(1)} أشهر`}
                showUnit
              />
            </div>
          </div>

          {/* تقسيم المصروفات: احتياجات / رغبات / ادخار */}
          <div className="card-soft p-4">
            <div className="flex items-center gap-2 justify-end mb-3">
              <h3 className="text-[14px] font-semibold text-navy">تقسيم الإنفاق</h3>
              <Target className="w-4 h-4 text-coral" />
            </div>
            <SpendingBreakdown spending={spending} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <SpendChip color="bg-navy" label="احتياجات" pct={Math.round((spending.needs / spending.total) * 100)} />
              <SpendChip color="bg-coral" label="رغبات" pct={Math.round((spending.wants / spending.total) * 100)} />
              <SpendChip color="bg-success" label="ادخار" pct={Math.round((spending.savings / spending.total) * 100)} />
            </div>
          </div>

          {/* اتجاه الإنفاق الشهري — خط بياني */}
          <div className="card-soft p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-navy bg-navy-soft px-2 py-1 rounded-full">
                توقع التوأم الرقمي
              </span>
              <div className="text-right">
                <p className="text-[13px] text-ink-muted">الرصيد المتوقع</p>
                <div className="mt-1 flex items-baseline gap-1.5 justify-end">
                  <span className="text-[13px] text-ink-muted">ريال</span>
                  <span className="text-[24px] font-bold text-navy">{formatSAR(balance6m)}</span>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-ink-muted mt-1 text-right">
              تقدير خلال 6 أشهر بناءً على نمطك الحالي
            </p>
            <MiniTrend twin={twin} />
            <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
              <span>6 أشهر</span>
              <span>3 أشهر</span>
              <span>الشهر الحالي</span>
            </div>
          </div>

          {/* نقاط القوة */}
          {strengths.length > 0 && (
            <div className="card-soft p-4">
              <div className="flex items-center gap-2 justify-end mb-3">
                <h3 className="text-[14px] font-semibold text-navy">نقاط قوتك</h3>
                <ShieldCheck className="w-4 h-4 text-success" />
              </div>
              <ul className="space-y-2 text-[13px] text-navy">
                {strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 items-start flex-row-reverse">
                    <span className="text-success shrink-0">✓</span>
                    <span className="text-right">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ذاكرة التوأم */}
          {twin.memory.length > 0 && (
            <div className="card-soft p-4">
              <div className="flex items-center gap-2 justify-end">
                <h3 className="text-[14px] font-semibold text-navy">ذاكرة توأمك المالية</h3>
                <History className="w-4 h-4 text-coral" />
              </div>
              <ul className="mt-3 space-y-2.5">
                {twin.memory.slice(0, 4).map((e, i) => (
                  <li key={i} className="flex gap-2 items-start text-[13px] text-navy flex-row-reverse">
                    <span className="w-1.5 h-1.5 rounded-full bg-coral mt-1.5 shrink-0" />
                    <div className="flex-1 text-right">
                      <span>{memoryTypeLabels[e.type] ?? e.title}</span>
                      {e.amount != null && (
                        <span className="text-ink-muted"> — {formatSAR(Math.abs(e.amount))} ريال</span>
                      )}
                      {e.date && (
                        <div className="text-[11px] text-ink-muted mt-0.5">{e.date}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* رؤى سريعة */}
          <div className="card-soft p-4">
            <div className="flex items-center gap-2 justify-end">
              <h3 className="text-[14px] font-semibold text-navy">رؤى سريعة</h3>
              <Sparkles className="w-4 h-4 text-coral" />
            </div>
            <ul className="mt-3 space-y-2 text-[13px] text-navy">
              <li className="flex gap-2 flex-row-reverse">
                <span className="text-coral shrink-0">•</span>
                <span className="text-right">لديك {twin.recurring_payments.length} التزامات شهرية متكررة</span>
              </li>
              <li className="flex gap-2 flex-row-reverse">
                <span className="text-coral shrink-0">•</span>
                <span className="text-right">
                  {twin.emergency_fund_months >= 3
                    ? `احتياطيك يغطي ${twin.emergency_fund_months.toFixed(1)} أشهر من مصروفاتك`
                    : "يمكنك رفع هامش الأمان عبر بناء احتياطي يغطي 3 أشهر"}
                </span>
              </li>
              {twin.debt_ratio > 0.4 && (
                <li className="flex gap-2 flex-row-reverse">
                  <span className="text-coral shrink-0">•</span>
                  <span className="text-right">نسبة التزاماتك من دخلك مرتفعة — تجنب التزامات جديدة</span>
                </li>
              )}
            </ul>
          </div>

          <Link to="/decision" className="btn-primary w-full flex items-center justify-center">
            جرّب قرارك
          </Link>
        </div>

        <div className="mt-auto">
          <BottomNav active="الرئيسية" />
        </div>
      </div>
    </Phone>
  );
}

function MetricCard({
  icon: Icon, label, value, warn = false,
}: {
  icon: any; label: string; value: string; warn?: boolean;
}) {
  return (
    <div className="card-soft p-3.5">
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[12px] text-ink-muted">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-navy-soft flex items-center justify-center">
          <Icon className="w-4 h-4 text-navy" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1 justify-end">
        <span className="text-[11px] text-ink-muted">ريال</span>
        <span className={`text-[18px] font-bold ${warn ? "text-coral" : "text-navy"}`}>{value}</span>
      </div>
    </div>
  );
}

// بُعد صحي واحد مع شريط RTL
function HealthDimension({
  label, value, max, target, unit, invertColor = false, showUnit = false,
}: {
  label: string; value: number; max: number; target: number;
  unit: string; invertColor?: boolean; showUnit?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const isGood = invertColor ? value <= target : value >= target;
  const barColor = isGood ? "bg-success" : value >= target * 0.6 ? "bg-warning" : "bg-coral";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[12px] font-semibold ${isGood ? "text-success" : "text-coral"}`}>
          {showUnit ? unit : `${value}${unit}`}
        </span>
        <span className="text-[12px] text-navy">{label}</span>
      </div>
      <div
        className="h-2 rounded-full bg-surface border border-border overflow-hidden"
        style={{ direction: "rtl" }}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// تقسيم الإنفاق بالأشرطة
function SpendingBreakdown({
  spending,
}: {
  spending: { needs: number; wants: number; savings: number; total: number };
}) {
  const needsPct = (spending.needs / spending.total) * 100;
  const wantsPct = (spending.wants / spending.total) * 100;
  const savingsPct = (spending.savings / spending.total) * 100;

  return (
    <div className="h-3 rounded-full overflow-hidden flex flex-row-reverse">
      <div className="bg-navy h-full transition-all duration-700" style={{ width: `${needsPct}%` }} />
      <div className="bg-coral h-full transition-all duration-700" style={{ width: `${wantsPct}%` }} />
      <div className="bg-success h-full transition-all duration-700" style={{ width: `${savingsPct}%` }} />
    </div>
  );
}

function SpendChip({
  color, label, pct,
}: {
  color: string; label: string; pct: number;
}) {
  return (
    <div className="rounded-xl bg-surface p-2 border border-border">
      <div className={`w-3 h-3 rounded-full ${color} mx-auto mb-1`} />
      <div className="text-[10px] text-ink-muted">{label}</div>
      <div className="text-[13px] font-bold text-navy">{pct}٪</div>
    </div>
  );
}

function MiniTrend({ twin }: { twin: TwinState }) {
  const balances = [twin.current_balance,
                    ...(twin.forecast?.projected_balances?.slice(0, 5) ?? [])];
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = max - min || 1;
  // RTL: أول نقطة على اليمين (الشهر الحالي)، آخر نقطة على اليسار (6 أشهر)
  const points = balances.map((b, i) => [
    10 + (i * 300) / (balances.length - 1),
    12 + 40 * (1 - (b - min) / span),
  ]);
  const d = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const hasNegative = min < 0;
  const zeroY = hasNegative ? 12 + 40 * (1 - (0 - min) / span) : null;

  return (
    <svg viewBox="0 0 320 70" className="w-full mt-3" style={{ direction: "ltr" }}>
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F47F6B" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F47F6B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {zeroY != null && (
        <line x1="10" y1={zeroY} x2="310" y2={zeroY}
          stroke="#F47F6B" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
      )}
      <path d={`${d} L310,70 L10,70 Z`} fill="url(#g)" />
      <path d={d} stroke="#0B2D46" strokeWidth="2" fill="none" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3"
          fill={balances[i] < 0 ? "#F47F6B" : "#0B2D46"} />
      ))}
    </svg>
  );
}
