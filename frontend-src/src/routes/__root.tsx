import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { WahlaProvider } from "../lib/wahla-store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-navy">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-ink-muted">تعذر العثور على الصفحة المطلوبة.</p>
        <div className="mt-6">
          <Link to="/" className="btn-primary inline-flex items-center justify-center px-6">
            العودة للبداية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-ink-muted">يمكنك المحاولة مرة أخرى.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="btn-primary mt-6 px-6"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "وهلة — قبل أن تلتزم، شاهد أثر قرارك المالي" },
      { name: "description", content: "وهلة: خدمة مصرفية ذكية تساعدك على فهم أثر قرارك المالي قبل الالتزام به." },
      { property: "og:title", content: "وهلة — قبل أن تلتزم، شاهد أثر قرارك المالي" },
      { property: "og:description", content: "وهلة: خدمة مصرفية ذكية تساعدك على فهم أثر قرارك المالي قبل الالتزام به." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "وهلة — قبل أن تلتزم، شاهد أثر قرارك المالي" },
      { name: "twitter:description", content: "وهلة: خدمة مصرفية ذكية تساعدك على فهم أثر قرارك المالي قبل الالتزام به." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f2e39af8-bc03-4012-bf73-c10cb75b85fa/id-preview-81222b09--67cc610f-c8ef-4a3a-b41b-7a2999a71c9d.lovable.app-1782993325160.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f2e39af8-bc03-4012-bf73-c10cb75b85fa/id-preview-81222b09--67cc610f-c8ef-4a3a-b41b-7a2999a71c9d.lovable.app-1782993325160.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <WahlaProvider>
        <Outlet />
      </WahlaProvider>
    </QueryClientProvider>
  );
}
