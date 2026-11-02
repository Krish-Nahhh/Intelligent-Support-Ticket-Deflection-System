import { NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
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

  // Inserting the resolution and marking the ticket resolved must succeed or fail together.
  const client = await pool.connect();
  let t: any;
  let resolution: any;
  try {
    await client.query("BEGIN");

    // FOR UPDATE locks the ticket row so two agents cannot resolve it at the same time.
    const found = await client.query(
      `SELECT id, title, description, status, assigned_agent_id, (embedding IS NOT NULL) AS has_emb
       FROM tickets WHERE id = $1 FOR UPDATE`,
      [ticketId]
    );
    t = found.rows[0];
    if (!t) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (auth.session.role === "agent" && t.assigned_agent_id !== auth.session.userId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not your ticket" }, { status: 403 });
    }
    if (["resolved", "closed", "deflected"].includes(t.status)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Ticket already finished" }, { status: 409 });
    }

    const r = await client.query(
      `INSERT INTO resolutions (ticket_id, agent_id, solution_text)
       VALUES ($1, $2, $3) RETURNING id, ticket_id, solution_text, created_at`,
      [ticketId, auth.session.userId, solution.trim()]
    );
    resolution = r.rows[0];

    await client.query(
      `UPDATE tickets SET status = 'resolved', resolved_at = now() WHERE id = $1`,
      [ticketId]
    );

    await client.query("COMMIT");
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (e.code === "23505") {
      return NextResponse.json({ error: "Resolution already exists" }, { status: 409 });
    }
    throw e;
  } finally {
    client.release();
  }

  // Make sure the ticket is searchable for future deflection (outside the transaction:
  // embedding can be slow and a failure here must not undo the resolution).
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
