import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole("agent", "admin");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ ok: true, role: auth.session.role });
}