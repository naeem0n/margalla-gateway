import { apiFetch } from "./api-client";
import { toast } from "sonner";

export async function reportErrorToSupport(error: Error | string, context?: any) {
  const name = error instanceof Error ? error.name : "Manual Error";
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : new Error().stack;

  try {
    toast.loading("Sending report to support...", { id: "manual-report" });
    await apiFetch("/support/report-error", {
      method: "POST",
      body: JSON.stringify({
        errorName: name,
        errorMessage: message,
        errorStack: stack,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          ...(context || {}),
        },
      }),
    });
    toast.dismiss("manual-report");
    toast.success("Error reported! Support team has been notified.");
  } catch (err: any) {
    toast.dismiss("manual-report");
    toast.error(err.message || "Failed to submit error report");
  }
}
