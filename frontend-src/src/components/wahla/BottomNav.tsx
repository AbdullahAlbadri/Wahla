import { Link } from "@tanstack/react-router";
import { Home, Sparkles, Bell, User } from "lucide-react";

const items = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/decision", label: "المحاكاة", icon: Sparkles },
  { to: "/home", label: "التنبيهات", icon: Bell },
  { to: "/home", label: "حسابي", icon: User },
] as const;

export function BottomNav({ active = "الرئيسية" }: { active?: string }) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-border pb-6 pt-3 px-4">
      <div className="flex justify-between">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = it.label === active;
          return (
            <Link
              key={it.label}
              to={it.to}
              className="flex-1 flex flex-col items-center gap-1 py-1"
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-coral" : "text-ink-muted"}`} />
              <span className={`text-[11px] ${isActive ? "text-navy font-semibold" : "text-ink-muted"}`}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
