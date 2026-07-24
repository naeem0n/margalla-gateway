import { describe, expect, it } from "vitest";
import * as flags from "./feature-config";

describe("feature-config flags", () => {
  it("exposes every flag as a boolean", () => {
    for (const value of Object.values(flags)) {
      expect(typeof value).toBe("boolean");
    }
  });

  it("keeps the documented default flag values", () => {
    expect(flags.ENABLE_PARKING).toBe(false);
    expect(flags.ENABLE_GAS).toBe(true);
    expect(flags.ENABLE_MAINTENANCE).toBe(true);
    expect(flags.ENABLE_LATE_FEE).toBe(false);
    expect(flags.ENABLE_SECURITY_DEPOSIT).toBe(false);
    expect(flags.ENABLE_SYNC).toBe(true);
  });
});
