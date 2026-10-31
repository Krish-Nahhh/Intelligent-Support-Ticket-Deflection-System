import { query } from "./db";

const SLA_HOURS: Record<string, number> = { urgent: 4, high: 8, medium: 24, low: 72 };
export const PRIORITIES = Object.keys(SLA_HOURS);
export const STATUSES = ["open", "deflected", "assigned", "in_progress", "resolved", "closed"];

// Assigns to the agent with the fewest active tickets. Returns agent id or null.
export async function assignAgent(ticketId: number): Promise<number | null> {
  const { rows } = await query(
    `SELECT u.id FROM users u
     LEFT JOIN tickets t ON t.assigned_agent_id = u.id AND t.status IN ('assigned', 'in_progress')
     WHERE u.role = 'agent'
     GROUP BY u.id ORDER BY COUNT(t.id), u.id LIMIT 1`
  );
  if (!rows[0]) return null;
  await query(`UPDATE tickets SET assigned_agent_id = $1, status = 'assigned' WHERE id = $2`, [
    rows[0].id,
    ticketId,
  ]);
  return rows[0].id;
}

export const slaHours = (p: string) => SLA_HOURS[p] ?? 24;