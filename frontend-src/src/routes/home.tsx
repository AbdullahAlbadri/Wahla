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
} from "lucide-react";

export const Route = createFileRoute("/home")({
  component: Home,
});

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
  const commitments = commitmentsOf(twin);
  const stable = twin.risk_level === "low";
  const balance6m = twin.forecast?.projected_balances?.[5] ?? twin.current_balance;

  return (
    <Phone>
      <div className="flex flex-col min-h-[100dvh]">
        <div className="px-5 pt-8 pb-4 flex items-start justify-between">
          <div>
            <p className="text-[13px] text-ink-muted">مرحبًا</p>
            <h1 className="text-[22px] font-bold text-navy">عبدالله</h1>
          </div>
          <img src={logoUrl} alt="وهلة" className="h-9 w-auto object-contain" />
        </div>

        <div className="px-5 space-y-4 pb-6">
          {/* Surplus hero card */}
          <div className="rounded-2xl bg-navy text-white p-5 relative overflow-hidden">
            <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-coral/20 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-white/70">الفائض الشهري</p>
                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full border ${
                    stable
                      ? "bg-success/20 text-success-soft border-success/30"
                      : "bg-warning/20 text-white border-warning/30"
                  }`}
                >
                  {stable ? "مستقر" : `ضغط ${riskLabels[twin.risk_level]}`}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[36px] font-bold">{formatSAR(surplus)}</span>
                <span className="text-[14px] text-white/70">ريال</span>
              </div>
              <p className="text-[12px] text-white/60 mt-1">
                المتبقي بعد الالتزامات والمصروفات
              </p>
            </div>
          </div>

          {/* Health + personality (from the Digital Twin) */}
          <div className="card-soft p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-coral" />
                <h3 className="text-[14px] font-semibold text-navy">الصحة المالية</h3>
              </div>
              <span className="text-[11px] text-navy bg-navy-soft px-2 py-1 rounded-full">
                {personalityLabels[twin.financial_personality] ?? twin.financial_personality}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[24px] font-bold text-navy">
                {Math.round(twin.financial_health_score)}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-surface border border-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-coral transition-all duration-700"
                  style={{ width: `${twin.financial_health_score}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-muted">من 100</span>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={TrendingUp} label="الدخل الشهري" value={formatSAR(twin.monthly_income)} />
            <MetricCard icon={Receipt} label="الالتزامات" value={formatSAR(commitments)} />
            <MetricCard icon={ShoppingBag} label="متوسط المصروفات" value={formatSAR(twin.monthly_expenses)} />
            <MetricCard icon={Wallet} label="الرصيد الحالي" value={formatSAR(twin.current_balance)} />
          </div>

          {/* Future balance (from the Twin forecast) */}
          <div className="card-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-ink-muted">رصيدك المتوقع</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[24px] font-bold text-navy">{formatSAR(balance6m)}</span>
                  <span className="text-[13px] text-ink-muted">ريال</span>
                </div>
              </div>
              <span className="text-[11px] text-navy bg-navy-soft px-2 py-1 rounded-full">
                توقع التوأم الرقمي
              </span>
            </div>
            <p className="text-[12px] text-ink-muted mt-1">
              تقدير خلال 6 أشهر بناءً على نمطك الحالي
            </p>

            <MiniTrend twin={twin} />
            <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
              <span>الشهر الحالي</span>
              <span>3 أشهر</span>
              <span>6 أشهر</span>
            </div>
          </div>

          {/* Memory timeline (Twin memory) */}
          {twin.memory.length > 0 && (
            <div className="card-soft p-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-coral" />
                <h3 className="text-[14px] font-semibold text-navy">ذاكرة توأمك المالية</h3>
              </div>
              <ul className="mt-3 space-y-2.5">
                {twin.memory.slice(0, 4).map((e, i) => (
                  <li key={i} className="flex gap-2 items-start text-[13px] text-navy">
                    <span className="w-1.5 h-1.5 rounded-full bg-coral mt-1.5 shrink-0" />
                    <div className="flex-1">
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

          {/* Insights */}
          <div className="card-soft p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-coral" />
              <h3 className="text-[14px] font-semibold text-navy">رؤى سريعة</h3>
            </div>
            <ul className="mt-3 space-y-2 text-[13px] text-navy">
              <li className="flex gap-2">
                <span className="text-coral">•</span>
                لديك {twin.recurring_payments.length} التزامات شهرية متكررة
              </li>
              <li className="flex gap-2">
                <span className="text-coral">•</span>
                {twin.emergency_fund_months >= 3
                  ? `احتياطيك يغطي ${twin.emergency_fund_months.toFixed(1)} أشهر من مصروفاتك`
                  : "يمكنك رفع هامش الأمان عبر بناء احتياطي يغطي 3 أشهر"}
              </li>
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

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="card-soft p-3.5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-navy-soft flex items-center justify-center">
          <Icon className="w-4 h-4 text-navy" />
        </div>
        <span className="text-[12px] text-ink-muted">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[18px] font-bold text-navy">{value}</span>
        <span className="text-[11px] text-ink-muted">ريال</span>
      </div>
    </div>
  );
}

function MiniTrend({ twin }: { twin: TwinState }) {
  // real Twin forecast: balance now + months 1..5, RTL-friendly
  const balances = [twin.current_balance,
                    ...(twin.forecast?.projected_balances?.slice(0, 5) ?? [])];
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = max - min || 1;
  const points = balances.map((b, i) => [
    10 + (i * 300) / (balances.length - 1),
    12 + 40 * (1 - (b - min) / span),
  ]);
  const d = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  return (
    <svg viewBox="0 0 320 70" className="w-full mt-3">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F47F6B" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F47F6B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L310,70 L10,70 Z`} fill="url(#g)" />
      <path d={d} stroke="#0B2D46" strokeWidth="2" fill="none" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#F47F6B" />
      ))}
    </svg>
  );
}
