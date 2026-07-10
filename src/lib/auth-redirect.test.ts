import { describe, it, expect } from "vitest";
import { resolveDestForRoles } from "./auth-redirect";

describe("Margalla Gateway — post-login redirect", () => {
  it("admin role → /admin", () => {
    expect(resolveDestForRoles(["admin"])).toBe("/admin");
  });

  it("SUPER_ADMIN alias → /admin", () => {
    expect(resolveDestForRoles(["SUPER_ADMIN"])).toBe("/admin");
  });

  it("admin wins over partner / resident", () => {
    expect(resolveDestForRoles(["resident", "partner", "admin"])).toBe("/admin");
  });

  it("partner role → /thirdparty", () => {
    expect(resolveDestForRoles(["partner"])).toBe("/thirdparty");
  });

  it("third_party alias → /thirdparty", () => {
    expect(resolveDestForRoles(["third_party"])).toBe("/thirdparty");
  });

  it("resident-only → /", () => {
    expect(resolveDestForRoles(["resident"])).toBe("/");
  });

  it("empty / null → / (safe default)", () => {
    expect(resolveDestForRoles([])).toBe("/");
    expect(resolveDestForRoles(null)).toBe("/");
    expect(resolveDestForRoles(undefined)).toBe("/");
  });
});
