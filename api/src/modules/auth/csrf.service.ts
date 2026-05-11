function parseCookie(request: Request, name: string): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [k, ...rest] = part.split("=");
    if (k === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

export function issueCsrfToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function validateCsrf(request: Request): boolean {
  const headerToken = request.headers.get("x-csrf-token") ?? "";
  const cookieToken = parseCookie(request, "fa_csrf") ?? "";
  return Boolean(headerToken) && Boolean(cookieToken) && headerToken === cookieToken;
}

export function buildCsrfCookie(token: string, isSecure: boolean): string {
  return `fa_csrf=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=43200${isSecure ? "; Secure" : ""}`;
}

export function buildClearCsrfCookie(isSecure: boolean): string {
  return `fa_csrf=; Path=/; SameSite=Lax; Max-Age=0${isSecure ? "; Secure" : ""}`;
}
