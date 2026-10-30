import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const { rows } = await query("SELECT id, name, email, role FROM users WHERE id = $1", [
    auth.session.userId,
  ]);
  return NextResponse.json({ user: rows[0] });
}