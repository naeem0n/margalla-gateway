import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/payment-requests")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/financial-ledger"
    });
  },
  component: () => null
});
