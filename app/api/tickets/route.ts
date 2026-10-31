import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { embed, toVectorLiteral } from "@/lib/embeddings";
import { findSimilarResolutions, SIMILARITY_THRESHOLD } from "@/lib/search";
import { assignAgent, slaHours, PRIORITIES, STATUSES } from "@/lib/tickets";

export async function POST(req: Request) {
  const auth = await requireRole("customer");
  if ("error" in auth) return auth.error;

  const { title, description, priority = "medium" } = await req.json().catch(() => ({}));
  if (!title?.trim() || !description?.trim() || !PRIORITIES.includes(priority)) {
    return NextResponse.json(
      { error: `title, description and priority (${PRIORITIES.join("/")}) required` },
      { status: 400 }
    );
  }

  const { rows } = await query(
    `INSERT INTO tickets (customer_id, title, description, priority, sla_due_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))
     RETURNING id, title, description, status, priority, sla_due_at, created_at, assigned_agent_id`,
    [auth.session.userId, title.trim(), description.trim(), priority, slaHours(priority)]
  );
  const ticket = rows[0];

  let suggestion = null;
  try {
    const vec = await embed(`${ticket.title}\n${ticket.description}`);
    if (vec) {
      await query("UPDATE tickets SET embedding = $1::vector WHERE id = $2", [
        toVectorLiteral(vec),
        ticket.id,
      ]);
      const [best] = await findSimilarResolutions(vec, 1);
      if (best && best.similarity >= SIMILARITY_THRESHOLD) {
        const s = await query(
          `INSERT INTO solution_suggestions (ticket_id, resolution_id, similarity)
           VALUES ($1, $2, $3) RETURNING id`,
          [ticket.id, best.resolution_id, best.similarity]
        );
        suggestion = {
          id: s.rows[0].id,
          similarity: best.similarity,
          solution: best.solution_text,
        };
      }
    }
  } catch (e) {
    console.error("Semantic search failed, routing to agent:", e);
  }

  if (!suggestion) {
    const agentId = await assignAgent(ticket.id);
    ticket.assigned_agent_id = agentId;
    ticket.status = agentId ? "assigned" : "open";
  }

  return NextResponse.json({ ticket, suggestion, routedToAgent: !suggestion }, { status: 201 });
}

export async function GET(req: Request) {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const { role, userId } = auth.session;

  const status = new URL(req.url).searchParams.get("status");
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const where: string[] = [];
  const p: unknown[] = [];
  if (role === "customer") {
    p.push(userId);
    where.push(`customer_id = $${p.length}`);
  } else if (role === "agent") {
    p.push(userId);
    where.push(`(assigned_agent_id = $${p.length} OR assigned_agent_id IS NULL)`);
  }
  if (status) {
    p.push(status);
    where.push(`status = $${p.length}::ticket_status`);
  }

  const { rows } = await query(
    `SELECT id, customer_id, assigned_agent_id, title, description, status, priority,
            sla_due_at, created_at, resolved_at,
            (sla_due_at < now() AND status NOT IN ('resolved', 'closed', 'deflected')) AS sla_breached
     FROM tickets
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY created_at DESC`,
    p
  );
  return NextResponse.json({ tickets: rows });
}