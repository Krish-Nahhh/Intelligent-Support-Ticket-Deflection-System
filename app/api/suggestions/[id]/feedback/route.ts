import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
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

  // Recording the answer and updating the ticket (deflect or assign) are one unit of work.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // FOR UPDATE OF s locks the suggestion so a double click cannot answer it twice.
    const { rows } = await client.query(
      `SELECT s.id, s.accepted, s.ticket_id
       FROM solution_suggestions s JOIN tickets t ON t.id = s.ticket_id
       WHERE s.id = $1 AND t.customer_id = $2
       FOR UPDATE OF s`,
      [suggestionId, auth.session.userId]
    );
    const s = rows[0];
    if (!s) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }
    if (s.accepted !== null) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Feedback already recorded" }, { status: 409 });
    }

    await client.query("UPDATE solution_suggestions SET accepted = $1 WHERE id = $2", [
      accepted,
      s.id,
    ]);

    if (accepted) {
      await client.query(
        `UPDATE tickets SET status = 'deflected', resolved_at = now() WHERE id = $1`,
        [s.ticket_id]
      );
    } else {
      // runs on the same connection, so it is part of the transaction
      await assignAgent(s.ticket_id, (text: string, p?: any[]) => client.query(text, p));
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, deflected: accepted });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
