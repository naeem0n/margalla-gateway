export const RESIDENT_GATE_KEY = "mgt_resident_gate";

export function grantResidentAccess() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(RESIDENT_GATE_KEY, "1");
  }
}

export function hasResidentAccess(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(RESIDENT_GATE_KEY) === "1";
}

export function revokeResidentAccess() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(RESIDENT_GATE_KEY);
  }
}

/** Block direct URL access to resident portal unless Home button was used this session */
export function requireResidentGate(): boolean {
  return hasResidentAccess();
}
