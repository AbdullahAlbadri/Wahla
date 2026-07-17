import type { ReactNode } from "react";

export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-navy/5 flex items-start md:items-center justify-center md:py-8" dir="rtl">
      <div
        className="relative w-full md:w-[390px] md:max-w-[390px] bg-surface md:rounded-[36px] md:shadow-[0_30px_80px_-30px_rgba(11,45,70,0.35)] overflow-hidden md:border md:border-navy/10"
        style={{ minHeight: "100dvh" }}
      >
        <div className="md:h-6 md:bg-navy" />
        {children}
      </div>
    </div>
  );
}
