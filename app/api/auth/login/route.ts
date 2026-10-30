import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const { rows } = await query(
    "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
    [String(email).toLowerCase()]
  );
  const u = rows[0];
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken({ userId: u.id, role: u.role });
  await setSessionCookie(token);
  return NextResponse.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
    token,
  });
}