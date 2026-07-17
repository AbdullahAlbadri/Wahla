import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Phone } from "@/components/wahla/Phone";
import { ScreenHeader } from "@/components/wahla/Header";
import { useAlternatives, useWahla, useTwin, formatSAR } from "@/lib/wahla-store";
import { verdictLabels } from "@/lib/api";
import {
  TrendingDown, CalendarClock, PauseCircle, Receipt, ChevronLeft, ChevronDown, ChevronUp,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/alternatives")({
  component: Alternatives,
});

function Alternatives() {
  const nav = useNavigate();
  const { setDecision, decision } = useWahla();
  const { data: alts, isLoading } = useAlternatives();
  const { data: twin } = useTwin();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  const cards = [
    {
      id: "reduce",
      icon: TrendingDown,
      title: "تقليل قيمة القسط",
      sub: "خفض القسط الشهري يمنحك هامشًا ماليًا أفضل ويحافظ على استقرارك",
      chip:
        alts?.reduce_payment?.suggested_monthly > 0
          ? `قسط مقترح: ${formatSAR(alts.reduce_payment.suggested_monthly)} ريال`
          : undefined,
      verdict: alts?.reduce_payment?.verdict,
      details: alts?.reduce_payment?.suggested_monthly > 0 && twin ? [
        [`القسط الحالي`, `${formatSAR(decision.monthly)} ريال`],
        [`القسط المقترح`, `${formatSAR(alts.reduce_payment.suggested_monthly)} ريال`],
        [`التوفير الشهري`, `${formatSAR(decision.monthly - alts.reduce_payment.suggested_monthly)} ريال`],
        [`الفائض المتوقع`, `${formatSAR((twin.net_cashflow - alts.reduce_payment.suggested_monthly))} ريال`],
      ] as [string, string][] : [],
      onApply:
        alts?.reduce_payment?.suggested_monthly > 0
          ? () => {
              setDecision({ monthly: alts.reduce_payment.suggested_monthly });
              nav({ to: "/result" });
            }
          : undefined,
    },
    {
      id: "longer",
      icon: CalendarClock,
      title: "توزيع على مدة أطول",
      sub: "تمديد مدة الالتزام يخفف القسط الشهري ويقلل الضغط على ميزانيتك",
      chip: alts?.longer_duration
        ? `${alts.longer_duration.months} شهرًا: ${formatSAR(alts.longer_duration.monthly)} ريال/شهر`
        : undefined,
      verdict: null,
      details: alts?.longer_duration && twin ? [
        [`المدة الحالية`, `${decision.months} أشهر`],
        [`المدة المقترحة`, `${alts.longer_duration.months} شهرًا`],
        [`القسط الجديد`, `${formatSAR(alts.longer_duration.monthly)} ريال/شهر`],
        [`الفرق في القسط`, `${formatSAR(decision.monthly - alts.longer_duration.monthly)} ريال أقل`],
      ] as [string, string][] : [],
      onApply: alts?.longer_duration
        ? () => {
            setDecision({
              monthly: alts.longer_duration.monthly,
              months: alts.longer_duration.months,
            });
            nav({ to: "/result" });
          }
        : undefined,
    },
    {
      id: "delay",
      icon: PauseCircle,
      title: "تأجيل القرار وبناء احتياطي",
      sub: "الانتظار حتى تكوين احتياطي مالي يجعل القرار أكثر أمانًا وأقل ضغطًا",
      chip:
        alts?.delay?.months_to_save_buffer != null
          ? alts.delay.months_to_save_buffer === 0
            ? "احتياطيك يغطي 3 أشهر بالفعل ✓"
            : `${alts.delay.months_to_save_buffer} أشهر لبناء احتياطي 3 أشهر`
          : undefined,
      verdict: null,
      details: alts?.delay && twin ? [
        [`الاحتياطي الحالي`, `${twin.emergency_fund_months.toFixed(1)} أشهر`],
        [`الهدف المقترح`, `3 أشهر`],
        [`المدة المقدّرة`, alts.delay.months_to_save_buffer === 0 ? "مكتمل" : `${alts.delay.months_to_save_buffer} أشهر`],
        [`الوفر الشهري المطلوب`, twin.net_cashflow > 0 ? `${formatSAR(twin.net_cashflow * 0.3)} ريال` : "—"],
      ] as [string, string][] : [],
      onApply: undefined,
    },
    {
      id: "review",
      icon: Receipt,
      title: "مراجعة الاشتراكات المتكررة",
      sub: "تقليل الاشتراكات غير الضرورية يرفع فائضك ويحسن قدرتك على الالتزام",
      chip:
        alts?.review_subscriptions?.recurring_total > 0
          ? `${alts.review_subscriptions.count} التزامات بمجموع ${formatSAR(alts.review_subscriptions.recurring_total)} ريال`
          : undefined,
      verdict: null,
      details: alts?.review_subscriptions && twin ? [
        [`عدد الالتزامات`, `${alts.review_subscriptions.count}`],
        [`إجمالي الاشتراكات`, `${formatSAR(alts.review_subscriptions.recurring_total)} ريال/شهر`],
        [`نسبة من الدخل`, `${Math.round((alts.review_subscriptions.recurring_total / (twin.monthly_income || 1)) * 100)}٪`],
        [`إذا وفّرت 30٪`, `${formatSAR(alts.review_subscriptions.recurring_total * 0.3)} ريال/شهر`],
      ] as [string, string][] : [],
      onApply: undefined,
    },
  ];

  return (
    <Phone>
      <ScreenHeader title="بدائل مقترحة" subtitle="لتحسين القرار" />

      <div className="px-5 pb-8 space-y-3">
        {isLoading && (
          <div className="card-soft p-4 text-center text-[13px] text-ink-muted">
            توأمك الرقمي يحسب البدائل...
          </div>
        )}

        {cards.map((a) => {
          const Icon = a.icon;
          const isOpen = expanded === a.id;

          return (
            <div key={a.id} className="card-soft overflow-hidden">
              {/* رأس البطاقة */}
              <button
                className="w-full p-4 text-right"
                onClick={() => toggleExpand(a.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-coral-soft flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-coral" />
                  </div>
                  <div className="flex-1 text-right">
                    <h3 className="text-[14px] font-semibold text-navy">{a.title}</h3>
                    <p className="text-[12px] text-ink-muted mt-0.5 leading-relaxed">{a.sub}</p>
                    {a.chip && (
                      <span className="inline-block mt-2 text-[11px] text-navy bg-navy-soft px-2 py-1 rounded-full">
                        {a.chip}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 mt-1">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-ink-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-ink-muted" />
                    )}
                  </div>
                </div>
              </button>

              {/* تفاصيل موسعة */}
              {isOpen && a.details.length > 0 && (
                <div className="px-4 pb-4 border-t border-border mt-1">
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {a.details.map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-surface p-2.5 border border-border text-right">
                        <div className="text-[10px] text-ink-muted">{k}</div>
                        <div className="text-[13px] font-bold text-navy mt-0.5">{v}</div>
                      </div>
                    ))}
                  </div>
                  {a.verdict && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-success-soft border border-success/20 px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      <span className="text-[12px] text-navy">
                        {verdictLabels[a.verdict]?.title ?? a.verdict}
                      </span>
                    </div>
                  )}
                  {a.onApply && (
                    <button
                      onClick={a.onApply}
                      className="mt-3 w-full h-10 rounded-xl bg-navy text-white text-[13px] font-semibold flex items-center justify-center gap-2"
                    >
                      <span>جرّب هذا البديل</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-2">
          <button onClick={() => nav({ to: "/home" })} className="btn-secondary w-full">
            العودة للرئيسية
          </button>
        </div>
      </div>
    </Phone>
  );
}
