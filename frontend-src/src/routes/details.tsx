import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Phone } from "@/components/wahla/Phone";
import { ScreenHeader } from "@/components/wahla/Header";
import { useWahla, decisionLabels, formatSAR } from "@/lib/wahla-store";

export const Route = createFileRoute("/details")({
  component: Details,
});

const durations = [3, 6, 12, 18];

function Details() {
  const { decision, setDecision } = useWahla();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState(String(decision.monthly));

  const total = (Number(raw) || 0) * decision.months;

  function submit() {
    const v = Number(raw);
    if (!raw || isNaN(v) || v <= 0) {
      setError("أدخل قيمة القسط الشهري");
      return;
    }
    setDecision({ monthly: v });
    nav({ to: "/result" });
  }

  return (
    <Phone>
      <ScreenHeader title="تفاصيل القرار" />

      <div className="px-5 pb-8 space-y-4">
        <Field label="نوع القرار">
          <div className="h-12 px-4 flex items-center rounded-xl border border-border bg-surface text-[14px] text-navy">
            {decisionLabels[decision.type]}
          </div>
        </Field>

        <Field label="قيمة القسط الشهري">
          <div className="relative">
            <input
              inputMode="numeric"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value.replace(/[^\d]/g, ""));
                setError(null);
              }}
              className={`w-full h-12 px-4 pl-14 rounded-xl bg-white border text-[15px] text-navy font-semibold focus:outline-none focus:ring-2 focus:ring-coral/30 ${
                error ? "border-risk" : "border-border"
              }`}
              placeholder="0"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-ink-muted">ريال</span>
          </div>
          {error && <p className="mt-1.5 text-[12px] text-risk">{error}</p>}
        </Field>

        <Field label="مدة الالتزام">
          <div className="grid grid-cols-4 gap-2">
            {durations.map((m) => {
              const active = decision.months === m;
              return (
                <button
                  key={m}
                  onClick={() => setDecision({ months: m })}
                  className={`h-11 rounded-xl text-[12px] font-semibold transition ${
                    active
                      ? "bg-navy text-white"
                      : "bg-white text-navy border border-border"
                  }`}
                >
                  {m === 18 ? "18 شهرًا" : m === 12 ? "12 شهرًا" : `${m} أشهر`}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="تاريخ البداية">
          <div className="h-12 px-4 flex items-center rounded-xl border border-border bg-surface text-[14px] text-navy">
            الشهر القادم
          </div>
        </Field>

        <Field label="هل توجد دفعة أولى؟">
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, l: "نعم" },
              { v: false, l: "لا" },
            ].map((o) => {
              const active = decision.hasDownPayment === o.v;
              return (
                <button
                  key={o.l}
                  onClick={() => setDecision({ hasDownPayment: o.v })}
                  className={`h-11 rounded-xl text-[13px] font-semibold ${
                    active ? "bg-navy text-white" : "bg-white text-navy border border-border"
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="card-soft p-4 bg-navy-soft/40">
          <h3 className="text-[14px] font-semibold text-navy mb-2">ملخص القرار</h3>
          <ul className="space-y-1.5 text-[13px] text-navy">
            <Row label="القسط الشهري" value={`${formatSAR(Number(raw) || 0)} ريال`} />
            <Row label="المدة" value={`${decision.months} ${decision.months >= 11 ? "شهرًا" : "أشهر"}`} />
            <Row label="إجمالي الالتزام" value={`${formatSAR(total)} ريال`} />
            <Row label="البداية" value="الشهر القادم" />
          </ul>
        </div>

        <div className="pt-2 space-y-3">
          <button onClick={submit} className="btn-primary w-full">عرض النتيجة</button>
          <button onClick={() => nav({ to: "/decision" })} className="btn-secondary w-full">
            رجوع
          </button>
        </div>
      </div>
    </Phone>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] text-navy font-medium mb-2">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </li>
  );
}
