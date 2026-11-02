# Intelligent Support Ticket Deflection System

A support-desk system that answers customers *before* an agent has to. When a customer submits a ticket, the system turns it into a vector embedding, searches the solutions of previously resolved tickets by **meaning** (not keywords), and suggests the closest answer. If the customer accepts it, the ticket is **deflected** and no agent is needed. If they reject it, or nothing is close enough, the ticket goes to the least-loaded agent. The agent's solution then joins the knowledge base, so the same problem is solved once.

Built for the DBMS Level 3 project (Option 2: SQL + Vector Database).

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Roles](#roles)
- [Database concepts demonstrated](#database-concepts-demonstrated)
- [Prerequisites](#prerequisites)
- [Setup and run with Docker](#setup-and-run-with-docker)
- [Run the app without building its Docker image](#run-the-app-without-building-its-docker-image)
- [Test accounts](#test-accounts)
- [Demo walkthrough](#demo-walkthrough)
- [Database design](#database-design)
- [API overview](#api-overview)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

## Features

- Customer registration and login with role-based access (customer, agent, admin).
- Semantic ticket matching with pgvector and a local embedding model (no API key needed).
- Accept or reject a suggested solution; accepting deflects the ticket, rejecting escalates it.
- Automatic SLA deadlines by priority and automatic assignment to the least-loaded agent.
- Dashboard with live statistics, filterable ticket table, ticket detail panel, solutions knowledge base and analytics.
- Agent resolution form; every resolution becomes a searchable solution.
- Admin tools: delete tickets, overall statistics (from a database view) and an agent workload report.
- Automated tests (28) for authentication, access control, the ticket lifecycle, deflection and search quality.

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend and API | Next.js 16 (App Router, Route Handlers), React 19, TypeScript, Tailwind CSS | One codebase for the interface and the API layer |
| SQL database | PostgreSQL 16 | ENUMs, CHECK constraints, views, transactions with row locks |
| Vector database | pgvector (inside the same PostgreSQL) | Embeddings sit next to the tickets they describe, so one query can join them and one transaction can cover both |
| Embeddings | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` (384 dimensions) | Small, free, runs locally on the CPU, no data leaves the machine |
| Database driver | `pg` with raw, parameterized SQL (no ORM) | Keeps the SQL visible, including `HAVING`, `FOR UPDATE`, views and vector operators |
| Auth | JWT (`jose`) in an httpOnly cookie, passwords hashed with `bcryptjs` | Pure JavaScript, stateless sessions |
| Testing | Vitest | Calls the real route handlers against a real database |
| Packaging | Docker and Docker Compose | Repeatable setup, and a pgvector database without installing the extension by hand |

## How it works

1. A **customer** submits a ticket (title, description, priority). An SLA deadline is set from the priority: urgent 4 h, high 8 h, medium 24 h, low 72 h.
2. The text `title + description` is embedded into a 384-number vector and stored in `tickets.embedding`.
3. pgvector finds the nearest resolved ticket using **cosine distance** (`<=>`, served by an HNSW index). Similarity is `1 - distance`.
4. If the best match scores at least `SIMILARITY_THRESHOLD` (default **0.6**), its solution is shown and recorded in `solution_suggestions`.
5. The customer answers **Yes** (ticket becomes `deflected`) or **No** (ticket is assigned to the agent with the fewest active tickets). This step runs in a transaction.
6. With no match, the ticket goes straight to an agent.
7. The agent writes a resolution (also a transaction). It becomes a searchable solution for future tickets.

## Roles

| Role | Can do |
|---|---|
| Customer | Create tickets, see only their own tickets, answer suggestions, browse solutions |
| Agent | See assigned and unassigned tickets, resolve their own assigned tickets, view solutions and analytics |
| Admin | See all tickets, resolve any ticket, delete tickets, view analytics, overall stats and the agent workload report |

## Database concepts demonstrated

| Concept | Where |
|---|---|
| DDL: `CREATE`, `ALTER`, `DROP` | `db/schema.sql` (the `ALTER TABLE ... ADD CONSTRAINT` statements add the CHECK rules) |
| Primary keys, foreign keys, `UNIQUE`, `NOT NULL`, `DEFAULT`, ENUM types | `db/schema.sql` |
| `CHECK` constraints (database-level validation) | priority values, `resolved_at` required for finished tickets, email format |
| Referential actions | `ON DELETE CASCADE` (resolutions, suggestions), `ON DELETE SET NULL` (suggestion to resolution link) |
| **View** | `ticket_summary`, read by `GET /api/stats` |
| **Indexing** | HNSW index on `tickets.embedding`; automatic B-tree indexes on keys and unique columns |
| **Transactions** with row locks (`FOR UPDATE`) | resolve route and suggestion feedback route |
| **Vector similarity search** | `lib/search.ts` |
| `INSERT`, `UPDATE`, `DELETE`, `SELECT` | create ticket, feedback, resolve routes; admin delete route |
| `JOIN` and `LEFT JOIN` | search, solutions list, `ticket_summary`, agent assignment |
| `GROUP BY` with `HAVING`, aggregates, `ORDER BY` | agent workload report (`HAVING COUNT(...) >= N`), agent assignment |
| Subqueries and `COUNT ... FILTER` | `/api/analytics`, `/api/stats` |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- Git
- About 5 GB of free disk space for the first build
- Node.js 22, only if you want to run the tests or the dev server on your own machine

## Setup and run with Docker

**1. Clone the repository**

```bash
git clone https://github.com/Krish-Nahhh/Intelligent-Support-Ticket-Deflection-System.git
cd Intelligent-Support-Ticket-Deflection-System
```

**2. Create `.env.local` in the project root** (git-ignored; never commit it)

```env
DB_PASSWORD=choose_a_password
DATABASE_URL=postgres://postgres:choose_a_password@localhost:5434/tickets
JWT_SECRET=paste_a_long_random_string
SIMILARITY_THRESHOLD=0.6
```

- `DB_PASSWORD` is the password the database container is created with. `DATABASE_URL` must use the same password (URL-encode `@`, `:` and `/` if it contains them).
- Inside Docker the app connects to the `db` service automatically (the compose file overrides `DATABASE_URL`), so the `localhost:5434` value is used only when you run tools on your own machine.
- Generate a secret with only Docker installed:

  ```bash
  docker run --rm node:22-bookworm-slim node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

**3. Build, set up the database, and start**

```bash
docker compose --env-file .env.local build
docker compose --env-file .env.local run --rm app npm run db:setup
docker compose --env-file .env.local up -d
```

`db:setup` applies the schema, seeds 40 resolved tickets and three accounts, and generates the embeddings. The first run downloads the embedding model, so it takes a few minutes.

**4. Open** [http://localhost:3000](http://localhost:3000)

> Tip: to avoid typing `--env-file .env.local` every time, also create a `.env` file containing only `DB_PASSWORD=choose_a_password`.

### Useful commands

```bash
docker compose --env-file .env.local logs -f app      # follow app logs
docker compose --env-file .env.local down             # stop (keeps data)
docker compose --env-file .env.local up -d --build    # rebuild after code changes
```

**Reset only the database** (keeps the cached embedding model):

```bash
docker compose --env-file .env.local down
docker volume rm ticket-deflection-system_pgdata
docker compose --env-file .env.local run --rm app npm run db:setup
docker compose --env-file .env.local up -d
```

> **Warning:** `npm run db:migrate` (and therefore `db:setup`) drops and recreates every table. It never runs automatically when the app starts. Avoid `docker compose down -v` unless you also want to delete the model cache.

## Run the app without building its Docker image

If you only want the web app and your machine is short on disk space, run just the database in Docker and the app directly:

```bash
docker compose --env-file .env.local up -d db
```

Point the app at the container (port 5434). In PowerShell:

```powershell
$env:DATABASE_URL = "postgres://postgres:choose_a_password@localhost:5434/tickets"
npm install
npm run db:setup      # first time only
npm run dev
```

In bash, use `export DATABASE_URL=...` instead. Open [http://localhost:3000](http://localhost:3000).

## Test accounts

All seeded accounts use the password `password123`.

| Email | Role |
|---|---|
| `customer@test.com` | customer |
| `agent@test.com` | agent |
| `admin@test.com` | admin |

New customers can register through the API (`POST /api/auth/register`).

## Demo walkthrough

1. Log in as `customer@test.com`, click **+ New ticket**, and submit "I can't sign in to my profile". A suggestion appears with its match percentage. Click **Yes, it did**: the ticket becomes *Deflected*.
2. Submit something with no match, for example "My screen flickers when I charge the laptop". It is routed to an agent.
3. Log in as `agent@test.com`, open **All tickets**, click the new ticket and write a solution under **Resolve this ticket**.
4. Open **Solutions**: the new solution is now in the knowledge base.
5. As the customer, submit a similar ticket such as "Laptop screen flickers while charging". The agent's solution is suggested.
6. As the agent, open **Analytics**: suggestions shown, acceptance rate and average match.
7. As `admin@test.com`, open **Analytics** and scroll to the operations report and the agent workload table. Change the minimum active tickets to see the `HAVING` filter at work. Open a ticket you created for testing and delete it. (Do not delete seeded tickets: each carries a solution the suggestions rely on.)

Matching compares the new ticket's title and description with those of earlier resolved tickets, so a ticket worded very differently may not match. Reword it closer to the original to see a suggestion.

## Database design

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | `id` PK, `email` UNIQUE with a format CHECK, `password_hash`, `role` (enum: customer, agent, admin) |
| `tickets` | Support requests | `id` PK, `customer_id` FK, `assigned_agent_id` FK, `status` (enum), `priority` (CHECK: low, medium, high, urgent), `embedding vector(384)`, `sla_due_at`, `resolved_at` |
| `resolutions` | Agent solutions | `id` PK, `ticket_id` FK **UNIQUE** (one solution per ticket, cascades on delete), `agent_id` FK, `solution_text` |
| `solution_suggestions` | Which solution was shown for which ticket | `id` PK, `ticket_id` FK (cascades), `resolution_id` FK (set null on delete), `similarity`, `accepted` (NULL until answered) |

Ticket status is an enum: `open`, `deflected`, `assigned`, `in_progress`, `resolved`, `closed`.

**Constraints added with `ALTER TABLE`:** priority must be one of four values; a ticket that is resolved, closed or deflected must have `resolved_at` set; an email must contain an `@` with characters on both sides.

**View `ticket_summary`:** joins tickets with the customer and agent names (`LEFT JOIN` for unassigned tickets) and computes `sla_breached`, true when the deadline has passed and the ticket is unfinished.

**Vector search**

- What is embedded: each ticket's `title`, a newline, and `description`.
- Model: `Xenova/all-MiniLM-L6-v2`, mean pooling, L2-normalized, 384 dimensions.
- Storage: `tickets.embedding vector(384)` with an HNSW index (`vector_cosine_ops`).
- Metric: cosine distance; `similarity = 1 - (a <=> b)`.
- Retrieval: the nearest tickets that are `resolved` or `closed` and have a resolution, ordered by distance. The top result is used only if its similarity is at least `SIMILARITY_THRESHOLD`.

## API overview

| Method and path | Access | Description |
|---|---|---|
| `POST /api/auth/register` | public | Create a customer account |
| `POST /api/auth/login` | public | Log in, sets the session cookie |
| `POST /api/auth/logout` | anyone | Clear the session |
| `GET /api/auth/me` | logged in | Current user |
| `POST /api/tickets` | customer | Create a ticket; returns a suggestion or routes to an agent |
| `GET /api/tickets` | logged in | Tickets visible to the role (`?status=` filter) |
| `DELETE /api/tickets/[id]` | admin | Delete a ticket; its resolution and suggestions are removed by `ON DELETE CASCADE` |
| `POST /api/tickets/[id]/resolve` | agent (own tickets), admin | Add a resolution (transaction) |
| `POST /api/suggestions/[id]/feedback` | customer (own tickets) | Accept or reject a suggestion (transaction) |
| `GET /api/solutions` | logged in | Resolved tickets with their solutions |
| `GET /api/analytics` | agent, admin | Suggestion and SLA statistics |
| `GET /api/stats` | admin | Totals, deflected count, SLA breaches and deflection rate, read from `ticket_summary` |
| `GET /api/reports/agent-workload?min=N` | admin | Agents with at least N active tickets (`GROUP BY ... HAVING`) |
| `GET /api/agent/ping` | agent | Role-check endpoint used by the tests |

The API also accepts `Authorization: Bearer <token>` (the token is returned by login), which is handy for Postman.

## Project structure

```
app/            Next.js pages and API route handlers
  api/          auth, tickets, suggestions, solutions, analytics, stats, reports, agent
lib/            db pool, auth/JWT, embeddings, similarity search, ticket helpers
db/             schema.sql, migrate.ts, seed.ts, backfill-embeddings.ts
tests/          Vitest setup, integration tests and semantic search tests
Dockerfile, docker-compose.yml, .dockerignore
```

## Testing

There are **28 tests**. `tests/integration/api.test.ts` (16) checks authentication, role-based access, the ticket lifecycle and the deflection flow against real route handlers. `tests/semantic/search.test.ts` (12) checks the embeddings and that paraphrases score above the threshold while unrelated queries score below it.

The tests refuse to run unless the database name contains `test`, so they can never wipe your real data.

With the database container running (`docker compose --env-file .env.local up -d db`) and Node.js 22 installed:

1. Create `.env.test` in the project root (git-ignored):

   ```env
   DATABASE_URL=postgres://postgres:choose_a_password@localhost:5434/tickets_test
   JWT_SECRET=any_test_secret
   SIMILARITY_THRESHOLD=0.6
   ```

2. Run:

   ```bash
   npm install
   npm test
   ```

If you set `DATABASE_URL` in your shell for the dev server, clear it first, because it overrides `.env.test` (PowerShell: `Remove-Item Env:DATABASE_URL`; bash: `unset DATABASE_URL`). The setup creates `tickets_test` if needed and runs `db:setup` against it. The first run downloads the embedding model.

Not covered by automated tests yet: the admin delete, workload report, stats view, CHECK constraint violations and transaction rollback. Demonstrate them manually, for example in `psql`:

```bash
docker compose --env-file .env.local exec db psql -U postgres -d tickets
```

```sql
-- blocked by tickets_priority_check
INSERT INTO tickets (customer_id, title, description, priority) VALUES (3, 'x', 'y', 'banana');

-- transaction rollback
BEGIN;
UPDATE tickets SET status = 'closed', resolved_at = now() WHERE id = 1;
ROLLBACK;
```

## Security notes

- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- Sessions are JWTs in an `httpOnly`, `sameSite=lax` cookie (`secure` in production).
- Every route checks the caller's role on the server.
- All SQL uses parameterized queries.
- Database credentials and the JWT secret come from environment variables. `.env*` files are git-ignored and excluded from the Docker image.
- Not implemented: rate limiting, CSRF tokens beyond `sameSite`, HTTPS in the local setup.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Invalid credentials" on the seeded accounts | The database was not seeded. Run `docker compose --env-file .env.local run --rm app npm run db:setup`. |
| `DB_PASSWORD` is empty or a password error appears | Docker Compose only reads `.env` for variables. Use `--env-file .env.local` on every command, or create a `.env` with `DB_PASSWORD`. |
| Password changed but the database still rejects it | The Postgres volume keeps its first password. Remove the volume (see "Reset only the database") and set up again. |
| `db:embed` fails with `fetch failed` or `SELF_SIGNED_CERT_IN_CHAIN` | Your network inspects HTTPS, so the container cannot download the model. Use a different network (for example a phone hotspot) for the first run. The model is cached in the `hfcache` volume afterwards. |
| A similar ticket is routed to an agent instead of getting a suggestion | The wording was too different, so similarity fell under 0.6. Reword it closer to the original ticket. |
| First ticket after a restart is slow | The embedding model loads on first use. Later tickets are fast. |
| Docker crashes with a `containerd`, `SIGBUS`, read-only file system or 500 error | Free disk space, run `docker builder prune -a -f`, restart Docker Desktop (`wsl --shutdown` on Windows), and retry. As a fallback, use [Run the app without building its Docker image](#run-the-app-without-building-its-docker-image). |
| `npm test` stops without running tests | The database name must contain `test`. Check `.env.test` and clear any `DATABASE_URL` set in your shell. |
| PowerShell cannot find paths containing `[id]` | Use `Get-Content -LiteralPath "app\api\tickets\[id]\route.ts"`. |

## Known limitations

- A suggestion can only be answered right after submitting. If the customer leaves first, the ticket stays open with an unanswered suggestion.
- Only the single best match is shown, and the 0.6 threshold is fixed.
- The statuses `in_progress` and `closed` exist, but no screen sets them yet.
- No notifications, comments, attachments or password reset.
- The seeded tickets were all created at once, so the 7-day volume chart shows one tall bar until real tickets arrive.
