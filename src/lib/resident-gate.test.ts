import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "../../test/memory-storage";
import {
  RESIDENT_GATE_KEY,
  grantResidentAccess,
  hasResidentAccess,
  requireResidentGate,
  revokeResidentAccess,
} from "./resident-gate";

beforeEach(() => {
  vi.stubGlobal("sessionStorage", createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resident-gate session gate", () => {
  it("denies access by default", () => {
    expect(hasResidentAccess()).toBe(false);
    expect(requireResidentGate()).toBe(false);
  });

  it("grants access via the Home-button flow", () => {
    grantResidentAccess();
    expect(sessionStorage.getItem(RESIDENT_GATE_KEY)).toBe("1");
    expect(hasResidentAccess()).toBe(true);
    expect(requireResidentGate()).toBe(true);
  });

  it("revokes previously granted access", () => {
    grantResidentAccess();
    revokeResidentAccess();
    expect(hasResidentAccess()).toBe(false);
    expect(sessionStorage.getItem(RESIDENT_GATE_KEY)).toBeNull();
  });

  it("treats any non-'1' value as no access", () => {
    sessionStorage.setItem(RESIDENT_GATE_KEY, "0");
    expect(hasResidentAccess()).toBe(false);
  });
});
