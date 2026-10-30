import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../lib/db";

const seedTickets = [
  {
    title: "Can't log in to my account",
    description: "I enter my password but it says invalid credentials.",
    solution: "Use 'Forgot password' to reset it, then clear browser cookies and retry.",
  },
  {
    title: "Charged twice for one order",
    description: "My card shows two payments for the same purchase.",
    solution: "Duplicate holds drop off within 3-5 business days. If a second charge settles, we refund it automatically.",
  },
  {
    title: "Package hasn't arrived",
    description: "Tracking has shown 'in transit' for over a week.",
    solution: "Allow 2 extra business days, then contact the carrier with your tracking ID. We reship if it's lost.",
  },
  // TODO: expand to ~40 across 6-8 themes (login, billing, shipping, refunds, app crashes, etc.)
];

async function main() {
  await pool.query("TRUNCATE solution_suggestions, resolutions, tickets, users RESTART IDENTITY CASCADE");

  const hash = await bcrypt.hash("password123", 10);
  const users = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
      ('Admin', 'admin@test.com', $1, 'admin'),
      ('Agent', 'agent@test.com', $1, 'agent'),
      ('Customer', 'customer@test.com', $1, 'customer')
     RETURNING id, role`,
    [hash]
  );
  const id = (r: string) => users.rows.find((u) => u.role === r).id;

  for (const t of seedTickets) {
    const ticket = await pool.query(
      `INSERT INTO tickets (customer_id, assigned_agent_id, title, description, status, resolved_at)
       VALUES ($1, $2, $3, $4, 'resolved', now()) RETURNING id`,
      [id("customer"), id("agent"), t.title, t.description]
    );
    await pool.query(
      `INSERT INTO resolutions (ticket_id, agent_id, solution_text) VALUES ($1, $2, $3)`,
      [ticket.rows[0].id, id("agent"), t.solution]
    );
  }

  console.log("Seeded");
  await pool.end();
}
main();