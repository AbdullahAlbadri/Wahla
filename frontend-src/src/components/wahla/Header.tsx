import { Link, useRouter } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import logoUrl from "@/assets/wahla-logo-transparent.png";

export function ScreenHeader({
  title,
  subtitle,
  back = true,
  showLogo = false,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  showLogo?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between">
        {back ? (
          <button
            onClick={() => router.history.back()}
            className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-navy"
            aria-label="رجوع"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : <div className="w-10" />}
        {showLogo && (
          <Link to="/home" className="flex items-center gap-2">
            <img src={logoUrl} alt="وهلة" className="h-8 w-auto object-contain" />
          </Link>
        )}
        <div className="w-10" />
      </div>
      {title && (
        <div className="mt-4">
          <h1 className="text-[22px] font-bold text-navy leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted leading-relaxed">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
