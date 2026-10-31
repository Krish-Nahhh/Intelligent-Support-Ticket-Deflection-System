import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// Knowledge base of resolved tickets and their solutions.
// Ticket descriptions are left out on purpose so customers never see other customers' details.
export async function GET() {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;

  const { rows } = await query(
    `SELECT r.id, r.ticket_id, t.title, r.solution_text, r.created_at, u.name AS agent_name
     FROM resolutions r
     JOIN tickets t ON t.id = r.ticket_id
     LEFT JOIN users u ON u.id = r.agent_id
     ORDER BY r.created_at DESC, r.id DESC`
  );
  return NextResponse.json({ solutions: rows });
}
