import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { assignAgent } from "@/lib/tickets";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("customer");
  if ("error" in auth) return auth.error;
  const suggestionId = Number((await params).id);

  const { accepted } = await req.json().catch(() => ({}));
  if (typeof accepted !== "boolean") {
    return NextResponse.json({ error: "accepted (boolean) required" }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT s.id, s.accepted, s.ticket_id
     FROM solution_suggestions s JOIN tickets t ON t.id = s.ticket_id
     WHERE s.id = $1 AND t.customer_id = $2`,
    [suggestionId, auth.session.userId]
  );
  const s = rows[0];
  if (!s) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  if (s.accepted !== null) {
    return NextResponse.json({ error: "Feedback already recorded" }, { status: 409 });
  }

  await query("UPDATE solution_suggestions SET accepted = $1 WHERE id = $2", [accepted, s.id]);

  if (accepted) {
    await query(`UPDATE tickets SET status = 'deflected', resolved_at = now() WHERE id = $1`, [
      s.ticket_id,
    ]);
  } else {
    await assignAgent(s.ticket_id);
  }
  return NextResponse.json({ ok: true, deflected: accepted });
}