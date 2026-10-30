import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword, signToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}));
  if (!name || !email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "name, email and a password of 8+ characters are required" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'customer') RETURNING id, name, email, role`,
      [name, String(email).toLowerCase(), await hashPassword(password)]
    );
    const user = rows[0];
    const token = await signToken({ userId: user.id, role: user.role });
    await setSessionCookie(token);
    return NextResponse.json({ user, token }, { status: 201 });
  } catch (e: any) {
    if (e.code === "23505") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    throw e;
  }
}