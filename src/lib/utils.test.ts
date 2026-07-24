import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn class-name merger", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values and supports conditional objects", () => {
    const show = false as boolean;
    expect(cn("a", show && "b", null, undefined, { c: true, d: false })).toBe("a c");
  });

  it("lets later Tailwind utilities win over conflicting earlier ones", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("flattens array inputs", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });
});
