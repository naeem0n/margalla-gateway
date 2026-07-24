export type JwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
};

/**
 * Decode a JWT payload without verifying its signature.
 * Returns null when the token is malformed or cannot be decoded.
 */
export function parseJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}
