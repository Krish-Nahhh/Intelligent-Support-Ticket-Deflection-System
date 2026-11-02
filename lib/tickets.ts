import { query } from "./db";

const SLA_HOURS: Record<string, number> = { urgent: 4, high: 8, medium: 24, low: 72 };
export const PRIORITIES = Object.keys(SLA_HOURS);
export const STATUSES = ["open", "deflected", "assigned", "in_progress", "resolved", "closed"];

// Anything that can run a SQL statement: the shared pool (default) or a client inside a transaction.
type Runner = (text: string, params?: any[]) => Promise<{ rows: any[] }>;

// Assigns to the agent with the fewest active tickets. Returns agent id or null.
export async function assignAgent(
  ticketId: number,
  run: Runner = query as Runner
): Promise<number | null> {
  const { rows } = await run(
    `SELECT u.id FROM users u
     LEFT JOIN tickets t ON t.assigned_agent_id = u.id AND t.status IN ('assigned', 'in_progress')
     WHERE u.role = 'agent'
     GROUP BY u.id ORDER BY COUNT(t.id), u.id LIMIT 1`
  );
  if (!rows[0]) return null;
  await run(`UPDATE tickets SET assigned_agent_id = $1, status = 'assigned' WHERE id = $2`, [
    rows[0].id,
    ticketId,
  ]);
  return rows[0].id;
}

export const slaHours = (p: string) => SLA_HOURS[p] ?? 24;
