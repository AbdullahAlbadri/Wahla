import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Check, ShieldCheck } from "lucide-react";
import { Phone } from "@/components/wahla/Phone";
import { ScreenHeader } from "@/components/wahla/Header";
import { useAccounts, useWahla } from "@/lib/wahla-store";

export const Route = createFileRoute("/connect")({
  component: Connect,
});

function Connect() {
  const nav = useNavigate();
  const [consent, setConsent] = useState(false);
  const { accountId, setAccountId } = useWahla();
  const { data: accounts, isLoading } = useAccounts();

  return (
    <Phone>
      <ScreenHeader
        title="ربط الحسابات"
        subtitle="لتحليل دخلك ومصروفاتك والتزاماتك."
      />

      <div className="px-5 pb-8 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-navy mb-3">الحسابات المتاحة</h2>
          <div className="space-y-3">
            {isLoading && (
              <div className="card-soft p-4 text-center text-[13px] text-ink-muted">
                جاري تحميل الحسابات...
              </div>
            )}
            {(accounts ?? []).map((a) => {
              const linked = a.id === accountId;
              return (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id)}
                  className={`w-full text-right card-soft p-4 flex items-center gap-3 border transition ${
                    linked ? "border-coral" : "border-transparent"
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-navy-soft flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-navy">{a.title}</div>
                    <div className="text-[12px] text-ink-muted mt-0.5">
                      {a.bank} · {a.mask}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full ${
                      linked ? "bg-success-soft text-success" : "bg-navy-soft text-navy"
                    }`}
                  >
                    {linked ? "مرتبط" : "جاهز للربط"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-soft p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-navy" />
            <h3 className="text-[14px] font-semibold text-navy">موافقتك وخصوصيتك</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {[
              "يمكنك إلغاء الربط في أي وقت",
              "لن يتم تنفيذ أي عملية دون موافقتك",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-[13px] text-navy">
                <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setConsent((c) => !c)}
            className="mt-4 w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface text-right"
          >
            <span
              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                consent ? "bg-coral border-coral" : "bg-white border-ink-muted/40"
              }`}
            >
              {consent && <Check className="w-3.5 h-3.5 text-white" />}
            </span>
            <span className="text-[13px] text-navy leading-snug">
              أوافق على استخدام البيانات لتحليل وضعي المالي
            </span>
          </button>
        </div>

        <div className="pt-2">
          <button
            disabled={!consent}
            onClick={() => nav({ to: "/home" })}
            className="btn-primary w-full"
          >
            متابعة
          </button>
        </div>
      </div>
    </Phone>
  );
}
