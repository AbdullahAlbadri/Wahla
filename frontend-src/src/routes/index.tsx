import { createFileRoute, Link } from "@tanstack/react-router";
import logoUrl from "@/assets/wahla-logo-transparent.png";
import { Phone } from "@/components/wahla/Phone";

export const Route = createFileRoute("/")({
  component: Intro,
});

function Intro() {
  return (
    <Phone>
      <div className="flex flex-col min-h-[100dvh] px-6 pt-14 pb-10">
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up">
          <div className="w-64 h-64 flex items-center justify-center">
            <img src={logoUrl} alt="وهلة" className="w-full h-full object-contain" />
          </div>

          <h1 className="mt-4 text-[32px] font-bold text-navy leading-tight text-right w-full">
            قبل أن تلتزم…
            <br />
            شاهد أثر قرارك
          </h1>
          <p className="mt-4 text-[15px] text-ink-muted leading-relaxed text-right w-full">
            محاكاة تقديرية لأثر القروض والتقسيط قبل اتخاذ القرار.
          </p>
        </div>

        <Link to="/connect" className="btn-primary w-full flex items-center justify-center">
          ابدأ الآن
        </Link>
      </div>
    </Phone>
  );
}
