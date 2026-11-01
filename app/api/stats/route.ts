import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole("admin");
  if ("error" in auth) return auth.error;

  const { rows } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'deflected')::int AS deflected,
            COUNT(*) FILTER (WHERE sla_breached)::int AS sla_breached
     FROM ticket_summary`
  );
  const { total, deflected, sla_breached } = rows[0];
  return NextResponse.json({
    total,
    deflected,
    sla_breached,
    deflection_rate: total ? Number(((deflected / total) * 100).toFixed(1)) : 0,
  });
}