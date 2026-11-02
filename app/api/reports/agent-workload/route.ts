import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// GET /api/reports/agent-workload?min=2  -> agents with at least `min` active tickets
export async function GET(req: Request) {
  const auth = await requireRole("admin");
  if ("error" in auth) return auth.error;

  const min = Number(new URL(req.url).searchParams.get("min") ?? 1) || 1;
  const { rows } = await query(
    `SELECT u.id, u.name, COUNT(t.id)::int AS active_tickets
     FROM users u
     JOIN tickets t ON t.assigned_agent_id = u.id AND t.status IN ('assigned', 'in_progress')
     WHERE u.role = 'agent'
     GROUP BY u.id, u.name
     HAVING COUNT(t.id) >= $1
     ORDER BY active_tickets DESC`,
    [min]
  );
  return NextResponse.json({ agents: rows });
}