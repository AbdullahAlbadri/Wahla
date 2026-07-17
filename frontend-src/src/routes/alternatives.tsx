import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Phone } from "@/components/wahla/Phone";
import { ScreenHeader } from "@/components/wahla/Header";
import { useAlternatives, useWahla, formatSAR } from "@/lib/wahla-store";
import { verdictLabels } from "@/lib/api";
import {
  TrendingDown, CalendarClock, PauseCircle, Receipt, ChevronLeft,
} from "lucide-react";

export const Route = createFileRoute("/alternatives")({
  component: Alternatives,
});

function Alternatives() {
  const nav = useNavigate();
  const { setDecision } = useWahla();
  const { data: alts, isLoading } = useAlternatives();

  // dynamic chips computed by the simulation engine for THIS user
  const cards = [
    {
      icon: TrendingDown,
      title: "تقليل قيمة القسط",
      sub: "خفض القسط الشهري يمنحك هامشًا ماليًا أفضل",
      chip:
        alts?.reduce_payment?.suggested_monthly > 0
          ? `قسط مقترح: ${formatSAR(alts.reduce_payment.suggested_monthly)} ريال${
              alts.reduce_payment.verdict
                ? " — " + (verdictLabels[alts.reduce_payment.verdict]?.title ?? "")
                : ""
            }`
          : undefined,
      onApply:
        alts?.reduce_payment?.suggested_monthly > 0
          ? () => {
              setDecision({ monthly: alts.reduce_payment.suggested_monthly });
              nav({ to: "/result" });
            }
          : undefined,
    },
    {
      icon: CalendarClock,
      title: "اختيار مدة مختلفة",
      sub: "توزيع الالتزام على مدة مناسبة قد يخفف الضغط الشهري",
      chip: alts?.longer_duration
        ? `على ${alts.longer_duration.months} شهرًا: ${formatSAR(
            alts.longer_duration.monthly,
          )} ريال شهريًا`
        : undefined,
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
      icon: PauseCircle,
      title: "تأجيل القرار",
      sub: "الانتظار حتى تكوين احتياطي مالي قد يكون أكثر أمانًا",
      chip:
        alts?.delay?.months_to_save_buffer != null
          ? alts.delay.months_to_save_buffer === 0
            ? "احتياطيك يغطي 3 أشهر بالفعل"
            : `تحتاج ${alts.delay.months_to_save_buffer} أشهر لبناء احتياطي 3 أشهر`
          : undefined,
    },
    {
      icon: Receipt,
      title: "مراجعة المصروفات المتكررة",
      sub: "تقليل بعض الاشتراكات يساعد على رفع الفائض الشهري",
      chip:
        alts?.review_subscriptions?.recurring_total > 0
          ? `لديك ${alts.review_subscriptions.count} التزامات متكررة بمجموع ${formatSAR(
              alts.review_subscriptions.recurring_total,
            )} ريال`
          : undefined,
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
          return (
            <div key={a.title} className="card-soft p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-coral-soft flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-coral" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold text-navy">{a.title}</h3>
                  <p className="text-[12px] text-ink-muted mt-1 leading-relaxed">{a.sub}</p>
                  {a.chip && (
                    <span className="inline-block mt-2 text-[11px] text-navy bg-navy-soft px-2 py-1 rounded-full">
                      {a.chip}
                    </span>
                  )}
                </div>
                {a.onApply && (
                  <button
                    onClick={a.onApply}
                    className="shrink-0 w-8 h-8 rounded-full bg-navy-soft flex items-center justify-center"
                    aria-label={`جرّب: ${a.title}`}
                  >
                    <ChevronLeft className="w-4 h-4 text-navy" />
                  </button>
                )}
              </div>
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
