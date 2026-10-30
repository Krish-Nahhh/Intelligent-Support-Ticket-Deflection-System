import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { embed, toVectorLiteral } from "@/lib/embeddings";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("agent", "admin");
  if ("error" in auth) return auth.error;
  const ticketId = Number((await params).id);

  const { solution } = await req.json().catch(() => ({}));
  if (!solution?.trim()) {
    return NextResponse.json({ error: "solution required" }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, title, description, status, assigned_agent_id, (embedding IS NOT NULL) AS has_emb
     FROM tickets WHERE id = $1`,
    [ticketId]
  );
  const t = rows[0];
  if (!t) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (auth.session.role === "agent" && t.assigned_agent_id !== auth.session.userId) {
    return NextResponse.json({ error: "Not your ticket" }, { status: 403 });
  }
  if (["resolved", "closed", "deflected"].includes(t.status)) {
    return NextResponse.json({ error: "Ticket already finished" }, { status: 409 });
  }

  let resolution;
  try {
    const r = await query(
      `INSERT INTO resolutions (ticket_id, agent_id, solution_text)
       VALUES ($1, $2, $3) RETURNING id, ticket_id, solution_text, created_at`,
      [ticketId, auth.session.userId, solution.trim()]
    );
    resolution = r.rows[0];
  } catch (e: any) {
    if (e.code === "23505") {
      return NextResponse.json({ error: "Resolution already exists" }, { status: 409 });
    }
    throw e;
  }

  await query(`UPDATE tickets SET status = 'resolved', resolved_at = now() WHERE id = $1`, [ticketId]);

  // Make sure the ticket is searchable for future deflection
  if (!t.has_emb) {
    try {
      const vec = await embed(`${t.title}\n${t.description}`);
      if (vec) {
        await query("UPDATE tickets SET embedding = $1::vector WHERE id = $2", [
          toVectorLiteral(vec),
          ticketId,
        ]);
      }
    } catch (e) {
      console.error("Embedding on resolve failed:", e);
    }
  }

  return NextResponse.json({ resolution }, { status: 201 });
}