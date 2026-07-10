// Margalla Gateway — post-login redirect resolver
// Pure helper so it can be unit-tested without a browser.
export type RoleName = string;
export type AuthDest = "/admin" | "/thirdparty" | "/" | "/resident";

export function resolveDestForRoles(roles: ReadonlyArray<RoleName> | null | undefined): AuthDest {
  const list = (roles ?? []).map((r) => String(r).toLowerCase());
  if (list.includes("admin") || list.includes("super_admin")) return "/admin";
  if (list.includes("partner") || list.includes("third_party") || list.includes("thirdparty")) return "/thirdparty";
  return "/";
}
