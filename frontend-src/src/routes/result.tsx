import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone } from "@/components/wahla/Phone";
import { ScreenHeader } from "@/components/wahla/Header";
import { useWahla, useSimulation, formatSAR } from "@/lib/wahla-store";
import {
  verdictLabels, reasonLabels, attributeLabels, riskLabels,
  type SimulationResult, type TwinDiffEntry,
} from "@/lib/api";
import { AlertTriangle, TrendingDown, TrendingUp, Info, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/result")({
  component: Result,
});

function Result() {
  const { decision } = useWahla();
  const nav = useNavigate();
  const [period, setPeriod] = useState(6);
  const { data: sim, isLoading, error } = useSimulation();
  const [displayNew, setDisplayNew] = useState(0);

  const newSurplus = sim?.after?.net_cashflow ?? 0;

  useEffect(() => {
    if (!sim) return;
    let i = 0;
    const steps = 20;
    const iv = setInterval(() => {
      i++;
      setDisplayNew(Math.round((newSurplus * i) / steps));
      if (i >= steps) clearInterval(iv);
    }, 25);
    return () => clearInterval(iv);
  }, [sim, newSurplus]);

  if (isLoading || (!sim && !error)) {
    return (
      <Phone>
        <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center">
          <div className="w-14 h-14 rounded-full border-4 border-navy-soft border-t-coral animate-spin" />
          <p className="mt-5 text-[15px] text-navy font-medium">
            توأمك الرقمي يحاكي أثر القرار...
          </p>
          <p className="mt-2 text-[12px] text-ink-muted">قد يستغرق ذلك لحظات قليلة</p>
        </div>
      </Phone>
    );
  }

  if (error || !sim) {
    return (
      <Phone>
        <ScreenHeader title="نتيجة المحاكاة" />
        <div className="px-5 pt-10 text-center">
          <p className="text-[15px] text-navy font-medium">تعذر الاتصال بمحرك المحاكاة</p>
          <button onClick={() => nav({ to: "/details" })} className="btn-secondary mt-6 px-6">
            الرجوع
          </button>
        </div>
      </Phone>
    );
  }

  const verdict = verdictLabels[sim.verdict] ?? verdictLabels.caution;
  const before = sim.before;
  const after = sim.after;
  const drop = Math.round(before.net_cashflow - after.net_cashflow);
  const dropPct = before.net_cashflow > 0
    ? Math.round((drop / before.net_cashflow) * 100)
    : null;
  const balances = sim.forecast_after?.projected_balances ?? [];
  const balanceEst = balances[period - 1] ?? after.current_balance;
  const lowestBalance = balances.length
    ? Math.min(...balances.slice(0, period))
    : after.current_balance;
  const totalPeriod = decision.monthly * period;

  return (
    <Phone>
      <ScreenHeader title="نتيجة المحاكاة" subtitle="الأثر المتوقع على وضعك المالي" />

      <div className="px-5 pb-8 space-y-4 animate-fade-up">
        {/* Verdict from the simulation engine */}
        <div
          className={`rounded-2xl border p-4 ${
            verdict.tone === "ok"
              ? "bg-success-soft border-success/25"
              : verdict.tone === "warn"
                ? "bg-warning-soft border-warning/25"
                : "bg-coral-soft border-coral/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                verdict.tone === "ok" ? "bg-success/20" : verdict.tone === "warn" ? "bg-warning/20" : "bg-coral/20"
              }`}
            >
              {verdict.tone === "ok" ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${verdict.tone === "warn" ? "text-warning" : "text-coral"}`} />
              )}
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-navy">{verdict.title}</h3>
              <p className="text-[13px] text-navy/80 mt-1 leading-relaxed">{verdict.sub}</p>
            </div>
          </div>
        </div>

        {/* Before / after from the Twin state transition */}
        <div>
          <h3 className="text-[14px] font-semibold text-navy mb-3">قبل القرار وبعده</h3>
          <div className="grid grid-cols-2 gap-3">
            <ComparisonCard
              title="قبل القرار"
              tone="ok"
              rows={[
                ["الفائض الشهري", `${formatSAR(before.net_cashflow)} ريال`],
                ["الصحة المالية", `${Math.round(before.financial_health_score)} / 100`],
                ["مستوى الضغط", riskLabels[before.risk_level] ?? before.risk_level],
              ]}
            />
            <ComparisonCard
              title="بعد القرار"
              tone={verdict.tone === "ok" ? "ok" : "warn"}
              rows={[
                ["الفائض الشهري", `${formatSAR(displayNew)} ريال`],
                ["الصحة المالية", `${Math.round(after.financial_health_score)} / 100`],
                ["مستوى الضغط", riskLabels[after.risk_level] ?? after.risk_level],
              ]}
            />
          </div>
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
              drop > 0 ? "bg-coral-soft border-coral/20" : "bg-success-soft border-success/20"
            }`}
          >
            {drop > 0 ? (
              <TrendingDown className="w-4 h-4 text-coral" />
            ) : (
              <TrendingUp className="w-4 h-4 text-success" />
            )}
            <span className="text-[13px] text-navy font-medium">
              {drop > 0
                ? `انخفاض الفائض بمقدار ${formatSAR(drop)} ريال شهريًا`
                : `تحسن الفائض بمقدار ${formatSAR(-drop)} ريال شهريًا`}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="card-soft p-4">
          <h3 className="text-[14px] font-semibold text-navy">مقارنة الفائض الشهري</h3>
          <div className="mt-4 flex items-end gap-6 justify-center h-32">
            <BarItem
              label="الوضع الحالي"
              value={before.net_cashflow}
              max={Math.max(before.net_cashflow, after.net_cashflow, 1)}
              color="navy"
            />
            <BarItem
              label="بعد الالتزام"
              value={after.net_cashflow}
              max={Math.max(before.net_cashflow, after.net_cashflow, 1)}
              color="coral"
            />
          </div>
        </div>

        {/* Timeline — real forecast from the Twin */}
        <div className="card-soft p-4">
          <h3 className="text-[14px] font-semibold text-navy mb-3">اختر الفترة الزمنية</h3>
          <div className="grid grid-cols-3 gap-2">
            {[3, 6, 12].map((m) => {
              const active = period === m;
              return (
                <button
                  key={m}
                  onClick={() => setPeriod(m)}
                  className={`h-10 rounded-xl text-[12px] font-semibold ${
                    active ? "bg-navy text-white" : "bg-surface text-navy border border-border"
                  }`}
                >
                  {m === 12 ? "12 شهرًا" : `${m} أشهر`}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
            <Info2 label="الرصيد المتوقع" value={`${formatSAR(balanceEst)} ريال`} />
            <Info2 label="أقل رصيد متوقع" value={`${formatSAR(lowestBalance)} ريال`} />
            <Info2 label="إجمالي الالتزام" value={`${formatSAR(totalPeriod)} ريال`} />
            <Info2
              label="انخفاض هامش الأمان"
              value={dropPct != null ? `${dropPct}%` : "—"}
            />
          </div>
          {sim.forecast_after?.months_to_zero != null && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-coral-soft border border-coral/20 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-coral" />
              <span className="text-[13px] text-navy font-medium">
                بهذا النمط، قد يصل رصيدك إلى الصفر خلال {sim.forecast_after.months_to_zero} شهرًا
              </span>
            </div>
          )}
        </div>

        {/* WHY — rendered from the TwinDiff, reason by reason */}
        <div>
          <h3 className="text-[14px] font-semibold text-navy mb-3">لماذا ظهرت هذه النتيجة؟</h3>
          <div className="space-y-2">
            {diffLines(sim).map((t, i) => (
              <div key={i} className="card-soft p-3 flex gap-2 items-start">
                <span className="w-6 h-6 rounded-full bg-navy-soft text-navy text-[12px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-[13px] text-navy leading-relaxed">{t}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-ink-muted leading-relaxed">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>
            نتيجة من محاكاة توأمك الرقمي بناءً على دخلك ونمط إنفاقك الفعلي، وقد تتغير عند تغير
            الدخل أو المصروفات.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button onClick={() => nav({ to: "/alternatives" })} className="btn-primary w-full">
            عرض البدائل
          </button>
          <button onClick={() => nav({ to: "/details" })} className="btn-secondary w-full">
            تعديل القرار
          </button>
        </div>
      </div>
    </Phone>
  );
}

// TwinDiff → Arabic "why" lines: attribute movement + causal reason
function diffLines(sim: SimulationResult): string[] {
  const fmtVal = (attr: string, v: number | string) => {
    if (typeof v === "string") return riskLabels[v] ?? v;
    if (attr === "savings_rate" || attr === "debt_ratio")
      return `${Math.round((v as number) * 100)}%`;
    if (attr === "emergency_fund_months") return `${(v as number).toFixed(1)} أشهر`;
    if (attr === "financial_health_score") return `${Math.round(v as number)}`;
    return `${formatSAR(v as number)} ريال`;
  };
  const interesting = new Set([
    "financial_health_score", "savings_rate", "emergency_fund_months",
    "net_cashflow", "risk_level", "debt_ratio",
  ]);
  return sim.twin_diff
    .filter((c: TwinDiffEntry) => interesting.has(c.attribute))
    .slice(0, 5)
    .map((c) => {
      const label = attributeLabels[c.attribute] ?? c.attribute;
      let line = `${label}: ${fmtVal(c.attribute, c.before)} ← ${fmtVal(c.attribute, c.after)}`;
      const reasons = (c.reasons ?? [])
        .map((r) => reasonLabels[r] ?? null)
        .filter(Boolean);
      if (reasons.length) line += ` — بسبب ${reasons.join(" و")}`;
      return line;
    });
}

function ComparisonCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: [string, string][];
  tone: "ok" | "warn";
}) {
  const isOk = tone === "ok";
  return (
    <div
      className={`rounded-2xl p-3.5 border ${
        isOk ? "bg-success-soft border-success/20" : "bg-coral-soft border-coral/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-navy">{title}</span>
        <span className={`w-2 h-2 rounded-full ${isOk ? "bg-success" : "bg-coral"}`} />
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map(([k, v]) => (
          <li key={k}>
            <div className="text-[10px] text-ink-muted">{k}</div>
            <div className="text-[13px] font-semibold text-navy">{v}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarItem({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: "navy" | "coral";
}) {
  const h = Math.max((Math.max(value, 0) / max) * 100, 6);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[12px] font-bold text-navy">{formatSAR(value)}</div>
      <div className="w-14 h-24 bg-surface rounded-xl relative overflow-hidden border border-border">
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-xl transition-all duration-700 ${
            color === "navy" ? "bg-navy" : "bg-coral"
          }`}
          style={{ height: `${h}%` }}
        />
      </div>
      <div className="text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3 border border-border">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="text-[14px] font-bold text-navy mt-1">{value}</div>
    </div>
  );
}
