import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { query } from "@/lib/db";
import { authAs, jsonReq, ctx, login } from "../helpers";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as agentPing } from "@/app/api/agent/ping/route";
import { POST as createTicket, GET as listTickets } from "@/app/api/tickets/route";
import { POST as resolveTicket } from "@/app/api/tickets/[id]/resolve/route";
import { POST as feedback } from "@/app/api/suggestions/[id]/feedback/route";

let customer: Awaited<ReturnType<typeof login>>;
let agent: Awaited<ReturnType<typeof login>>;

beforeAll(async () => {
  customer = await login("customer@test.com");
  agent = await login("agent@test.com");
});

afterEach(() => authAs(null));

describe("authentication", () => {
  it("logs in with valid credentials", () => {
    expect(customer.status).toBe(200);
    expect(customer.token).toBeTruthy();
    expect(customer.user.role).toBe("customer");
  });

  it("rejects a wrong password with 401", async () => {
    const bad = await login("customer@test.com", "wrong-password");
    expect(bad.status).toBe(401);
  });

  it("registers a new customer, then rejects the duplicate email with 409", async () => {
    const email = `new_${Date.now()}@test.com`;
    const body = { name: "New User", email, password: "password123" };
    const first = await register(jsonReq(body));
    expect(first.status).toBe(201);
    expect((await first.json()).user.role).toBe("customer");
    const second = await register(jsonReq(body));
    expect(second.status).toBe(409);
  });

  it("rejects registration with a short password (400)", async () => {
    const res = await register(jsonReq({ name: "X", email: "x@test.com", password: "123" }));
    expect(res.status).toBe(400);
  });

  it("/me returns 401 without a token and the user with one", async () => {
    expect((await me()).status).toBe(401);
    authAs(customer.token);
    const res = await me();
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe("customer@test.com");
  });
});

describe("role-based access control", () => {
  it("agent-only route: 401 anonymous, 403 customer, 200 agent", async () => {
    expect((await agentPing()).status).toBe(401);
    authAs(customer.token);
    expect((await agentPing()).status).toBe(403);
    authAs(agent.token);
    expect((await agentPing()).status).toBe(200);
  });

  it("agents cannot create tickets (customer-only)", async () => {
    authAs(agent.token);
    const res = await createTicket(jsonReq({ title: "t", description: "d" }));
    expect(res.status).toBe(403);
  });

  it("customers cannot resolve tickets", async () => {
    authAs(customer.token);
    const res = await resolveTicket(jsonReq({ solution: "x" }), ctx(1));
    expect(res.status).toBe(403);
  });
});

describe("ticket lifecycle", () => {
  let ticketId: number;

  it("validates ticket input (400)", async () => {
    authAs(customer.token);
    const res = await createTicket(jsonReq({ title: "", description: "" }));
    expect(res.status).toBe(400);
  });

  it("an unrelated ticket is routed to an agent with an SLA deadline", async () => {
    authAs(customer.token);
    const res = await createTicket(
      jsonReq({
        title: "Quantum flux capacitor calibration",
        description: "Need help aligning the dilithium crystals in my spaceship engine",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.routedToAgent).toBe(true);
    expect(data.suggestion).toBeNull();
    expect(data.ticket.status).toBe("assigned");
    expect(data.ticket.sla_due_at).toBeTruthy();
    ticketId = data.ticket.id;
  });

  it("customers only see their own tickets", async () => {
    authAs(customer.token);
    const res = await listTickets(new Request("http://localhost/api/tickets"));
    const { tickets } = await res.json();
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets.every((t: any) => t.customer_id === customer.user.id)).toBe(true);
    expect(tickets.some((t: any) => t.id === ticketId)).toBe(true);
  });

  it("agent resolves the ticket, persisting a resolution", async () => {
    authAs(agent.token);
    const res = await resolveTicket(jsonReq({ solution: "Recalibrate the flux core." }), ctx(ticketId));
    expect(res.status).toBe(201);

    const r = await query("SELECT solution_text FROM resolutions WHERE ticket_id = $1", [ticketId]);
    expect(r.rows[0].solution_text).toBe("Recalibrate the flux core.");
    const t = await query("SELECT status, resolved_at FROM tickets WHERE id = $1", [ticketId]);
    expect(t.rows[0].status).toBe("resolved");
    expect(t.rows[0].resolved_at).not.toBeNull();
  });

  it("resolving the same ticket twice returns 409", async () => {
    authAs(agent.token);
    const res = await resolveTicket(jsonReq({ solution: "again" }), ctx(ticketId));
    expect(res.status).toBe(409);
  });
});

describe("deflection flow", () => {
  const loginTicket = {
    title: "Cannot sign in",
    description: "It says my password is wrong when I try to access my account",
  };

  it("a paraphrased ticket gets a stored suggestion, and accepting deflects it", async () => {
    authAs(customer.token);
    const res = await createTicket(jsonReq(loginTicket));
    const data = await res.json();
    expect(data.routedToAgent).toBe(false);
    expect(data.suggestion.solution).toContain("Forgot password");

    const saved = await query("SELECT similarity, accepted FROM solution_suggestions WHERE id = $1", [
      data.suggestion.id,
    ]);
    expect(saved.rows[0].accepted).toBeNull();

    const fb = await feedback(jsonReq({ accepted: true }), ctx(data.suggestion.id));
    expect(fb.status).toBe(200);
    const t = await query("SELECT status FROM tickets WHERE id = $1", [data.ticket.id]);
    expect(t.rows[0].status).toBe("deflected");

    const again = await feedback(jsonReq({ accepted: true }), ctx(data.suggestion.id));
    expect(again.status).toBe(409);
  });

  it("rejecting a suggestion escalates the ticket to an agent", async () => {
    authAs(customer.token);
    const data = await (await createTicket(jsonReq(loginTicket))).json();
    expect(data.suggestion).toBeTruthy();

    await feedback(jsonReq({ accepted: false }), ctx(data.suggestion.id));
    const t = await query("SELECT status, assigned_agent_id FROM tickets WHERE id = $1", [data.ticket.id]);
    expect(t.rows[0].status).toBe("assigned");
    expect(t.rows[0].assigned_agent_id).not.toBeNull();
  });

  it("another customer cannot answer someone else's suggestion (404)", async () => {
    authAs(customer.token);
    const data = await (await createTicket(jsonReq(loginTicket))).json();

    const reg = await register(
      jsonReq({ name: "Other", email: `other_${Date.now()}@test.com`, password: "password123" })
    );
    authAs((await reg.json()).token);
    const res = await feedback(jsonReq({ accepted: true }), ctx(data.suggestion.id));
    expect(res.status).toBe(404);
  });
});