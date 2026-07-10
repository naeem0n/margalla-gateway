import { describe, expect, it } from "vitest";
import { resolveInvoiceDisplayValues } from "./print-invoice";

describe("resolveInvoiceDisplayValues", () => {
  it("falls back to the grand total when the amount is missing", () => {
    const resolved = resolveInvoiceDisplayValues({
      amount: undefined as unknown as string,
      tax: "0",
      grandTotal: "65000",
    });

    expect(resolved).toEqual({
      amount: "65000",
      tax: "0",
      grandTotal: "65000",
    });
  });

  it("normalizes numeric strings and strips invalid values", () => {
    const resolved = resolveInvoiceDisplayValues({
      amount: "65000",
      tax: "0",
      grandTotal: "undefined" as unknown as string,
    });

    expect(resolved).toEqual({
      amount: "65000",
      tax: "0",
      grandTotal: "65000",
    });
  });
});
