import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole("agent", "admin");
  if ("error" in auth) return auth.error;

  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM tickets)::int AS total_tickets,
       (SELECT COUNT(*) FROM tickets WHERE status = 'deflected')::int AS deflected,
       (SELECT COUNT(*) FROM solution_suggestions)::int AS suggestions,
       (SELECT COUNT(*) FROM solution_suggestions WHERE accepted = true)::int AS accepted,
       (SELECT COUNT(*) FROM solution_suggestions WHERE accepted = false)::int AS rejected,
       (SELECT AVG(similarity) FROM solution_suggestions)::float8 AS avg_similarity,
       (SELECT COUNT(*) FROM tickets
          WHERE sla_due_at < now() AND status NOT IN ('resolved', 'closed', 'deflected'))::int AS sla_breached`
  );
  return NextResponse.json({ analytics: rows[0] });
}
