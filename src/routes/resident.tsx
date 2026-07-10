import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { hasResidentAccess } from "@/lib/resident-gate";

export const Route = createFileRoute("/resident")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("mgt_api_token");
      const residentGate = sessionStorage.getItem("mgt_resident_gate") === "1";
      const hasSupabaseToken = Object.keys(localStorage).some(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
      );
      if (!token && !residentGate && !hasSupabaseToken) {
        throw redirect({ to: "/welcome" });
      }
    }
  },
  component: () => <Outlet />,
});
