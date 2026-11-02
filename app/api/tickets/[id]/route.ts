import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("admin");
  if ("error" in auth) return auth.error;

  const { rows } = await query("DELETE FROM tickets WHERE id = $1 RETURNING id", [
    Number((await params).id),
  ]);
  if (!rows[0]) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  return NextResponse.json({ deleted: rows[0].id });
}