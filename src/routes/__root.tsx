import { Outlet, Link, createRootRoute, HeadContent, Scripts, useNavigate } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from "react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { registerPWA } from "@/lib/registerPWA";
import GhostModeGlobalBar from "@/components/admin/GhostModeGlobalBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// 1. Initialize QueryClient outside the component
const queryClient = new QueryClient();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/welcome"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Margalla Gateway — Luxury Living Redefined" },
      { name: "description", content: "Premium apartments with modern architecture, 24/7 security, and full residential management." },
      { property: "og:title", content: "Margalla Gateway — Luxury Living Redefined" },
      { property: "og:description", content: "Premium apartments with modern architecture, 24/7 security, and full residential management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Margalla Gateway — Luxury Living Redefined" },
      { name: "twitter:description", content: "Premium apartments with modern architecture, 24/7 security, and full residential management." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/3ffe785d-17b1-4a5e-b845-7299760d2a91" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/3ffe785d-17b1-4a5e-b845-7299760d2a91" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  const navigate = useNavigate();

  useEffect(() => {
    registerPWA();
  }, []);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error("Global window error caught:", event.error);
      const err = event.error || new Error(event.message || "Unknown error");
      toast.error(`A system error occurred: ${err.message || err}`, {
        duration: 8000,
        action: {
          label: "Report to Support",
          onClick: () => {
            import("@/lib/support").then(({ reportErrorToSupport }) => {
              reportErrorToSupport(err, { source: "window.error" });
            });
          }
        }
      });
    };
    
    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection caught:", event.reason);
      const err = event.reason || new Error("Unhandled promise rejection");
      toast.error(`Action or request failed: ${err.message || err}`, {
        duration: 8000,
        action: {
          label: "Report to Support",
          onClick: () => {
            import("@/lib/support").then(({ reportErrorToSupport }) => {
              reportErrorToSupport(err, { source: "window.unhandledrejection" });
            });
          }
        }
      });
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handlePromiseRejection);
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handlePromiseRejection);
    };
  }, []);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api && api.onNavigate) {
      const unsubscribe = api.onNavigate((_event: any, targetPath: string) => {
        navigate({ to: targetPath as any });
      });
      return unsubscribe;
    }
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + A
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        const currentPath = window.location.hash ? window.location.hash.replace(/^#/, "") : window.location.pathname;
        if (currentPath === "/welcome" || currentPath === "/" || currentPath === "") {
          e.preventDefault();
          toast.success("Admin portal access unlocked! Redirecting...", {
            duration: 1500,
          });
          setTimeout(() => {
            navigate({ to: "/admin/login" });
          }, 800);
        }
      }
      // Ctrl + Alt + A
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "a") {
        const currentPath = window.location.hash ? window.location.hash.replace(/^#/, "") : window.location.pathname;
        if (currentPath === "/welcome" || currentPath === "/" || currentPath === "") {
          e.preventDefault();
          toast.success("Redirecting to Third-Party Partner Portal...", {
            duration: 1500,
          });
          setTimeout(() => {
            navigate({ to: "/thirdparty" });
          }, 800);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <GhostModeGlobalBar />
          <Outlet />
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
