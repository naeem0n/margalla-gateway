import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/bulk-utility")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/financial-ledger"
    });
  },
  component: () => null
});
