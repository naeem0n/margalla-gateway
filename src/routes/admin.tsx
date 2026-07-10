import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getToken, getApiBase, isDesktopApp } from "@/lib/api-client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!isDesktopApp()) {
      throw redirect({ to: "/" });
    }
    if (location.pathname === "/admin/login" || location.pathname === "/admin/hidden-tools") return;
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("adminToken") || localStorage.getItem("mgt_api_token");
      const hasSupabaseToken = Object.keys(localStorage).some(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
      );

      if (!token && !hasSupabaseToken) {
        throw redirect({ to: "/admin/login" });
      }

      if (token) {
        try {
          const apiBase = getApiBase();
          const verify = await fetch(`${apiBase}/auth/verify`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          if (!verify.ok) {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("mgt_api_token");
            throw redirect({ to: "/admin/login" });
          }
        } catch (e) {
          console.error("Token verification failed:", e);
        }
      }
    }
  },
  component: () => <Outlet />,
});
