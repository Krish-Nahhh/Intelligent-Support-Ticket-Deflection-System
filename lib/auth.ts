import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export type Role = "customer" | "agent" | "admin";
export type Session = { userId: number; role: Role };

const COOKIE = "session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export async function signToken(s: Session) {
  return new SignJWT({ role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.userId))
    .setExpirationTime("7d")
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

// Accepts the cookie (browser) or "Authorization: Bearer <token>" (Postman, tests)
export async function getSession(): Promise<Session | null> {
  const bearer = (await headers()).get("authorization");
  const token =
    bearer?.startsWith("Bearer ") ? bearer.slice(7) : (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: Number(payload.sub), role: payload.role as Role };
  } catch {
    return null;
  }
}

// Usage in a route:
//   const auth = await requireRole("agent", "admin");
//   if ("error" in auth) return auth.error;
//   const { session } = auth;
// With no roles passed, any logged-in user is allowed.
export async function requireRole(
  ...roles: Role[]
): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (roles.length && !roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}