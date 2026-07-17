import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Phone } from "@/components/wahla/Phone";
import { ScreenHeader } from "@/components/wahla/Header";
import { useWahla, type DecisionType } from "@/lib/wahla-store";
import { Wallet, ShoppingBag, Clock, Repeat, Check } from "lucide-react";

export const Route = createFileRoute("/decision")({
  component: Decision,
});

const options: { id: DecisionType; title: string; sub: string; icon: any }[] = [
  { id: "loan", title: "قرض", sub: "اختبر أثر قسط تمويلي جديد", icon: Wallet },
  { id: "installment", title: "شراء بالتقسيط", sub: "اعرف أثر المشتريات المقسطة", icon: ShoppingBag },
  { id: "bnpl", title: "دفع آجل", sub: "راجع أثر الدفعة في تاريخ محدد", icon: Clock },
  { id: "subscription", title: "اشتراك جديد", sub: "اختبر أثر التزام شهري متكرر", icon: Repeat },
];

function Decision() {
  const { decision, setDecision } = useWahla();
  const nav = useNavigate();

  return (
    <Phone>
      <ScreenHeader title="جرّب قرارك" subtitle="اختر نوع الالتزام" />

      <div className="px-5 pb-8 space-y-2.5">
        {options.map((o) => {
          const Icon = o.icon;
          const selected = decision.type === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setDecision({ type: o.id })}
              className={`w-full text-right p-3.5 rounded-2xl border transition-all flex items-center gap-3 ${
                selected
                  ? "bg-coral-soft border-coral"
                  : "bg-white border-border"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selected ? "bg-coral text-white" : "bg-navy-soft text-navy"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 text-right">
                <div className="text-[14px] font-semibold text-navy">{o.title}</div>
                <div className="text-[12px] text-ink-muted mt-0.5">{o.sub}</div>
              </div>
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  selected ? "bg-coral border-coral" : "border-ink-muted/40"
                }`}
              >
                {selected && <Check className="w-3 h-3 text-white" />}
              </span>
            </button>
          );
        })}

        <div className="pt-3 space-y-3">
          <button onClick={() => nav({ to: "/details" })} className="btn-primary w-full">
            متابعة
          </button>
          <Link to="/home" className="block text-center text-[13px] text-ink-muted py-2">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </Phone>
  );
}
