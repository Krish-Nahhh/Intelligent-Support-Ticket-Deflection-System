# Intelligent Support Ticket Deflection System

A support-desk system that answers customers *before* an agent has to. When a customer submits a ticket, the system converts it into a vector embedding, searches the solutions of previously resolved tickets by semantic similarity, and suggests the closest answer. If the customer accepts it, the ticket is **deflected** and no agent is needed. If not, it is assigned to the agent with the lightest workload, and the agent's eventual solution becomes part of the searchable knowledge base.

Built for the DBMS Level 3 project (Option 2: SQL + Vector Database).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend and API | Next.js 16 (App Router, route handlers), React 19, TypeScript, Tailwind CSS |
| SQL database | PostgreSQL 16 |
| Vector database | pgvector (inside the same PostgreSQL instance) |
| Embeddings | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` (384 dimensions, runs locally, no API key) |
| Auth | JWT (`jose`) in an `httpOnly` cookie, passwords hashed with `bcryptjs` |
| Testing | Vitest |
| Packaging | Docker and Docker Compose |

## How it works

1. A **customer** submits a ticket (title, description, priority).
2. The text `title + description` is embedded into a 384-dimension vector and stored in `tickets.embedding`.
3. pgvector finds the nearest resolved ticket using **cosine distance** (`<=>`, served by an HNSW index). Similarity is `1 - distance`.
4. If the best match scores at or above `SIMILARITY_THRESHOLD` (default **0.6**), its solution is shown as a suggestion and recorded in `solution_suggestions`.
5. The customer answers **"Yes, it did"** (the ticket becomes `deflected`) or **"No"** (the ticket is assigned to the agent with the fewest active tickets).
6. With no match, the ticket goes straight to an agent. The agent writes a resolution, which becomes a searchable solution for future tickets.
7. Every ticket gets an **SLA deadline** from its priority: urgent 4h, high 8h, medium 24h, low 72h.

## Roles

| Role | Can do |
|---|---|
| Customer | Create tickets, see own tickets, answer suggestions |
| Agent | See assigned and unassigned tickets, resolve own assigned tickets, view solutions and analytics |
| Admin | See all tickets, resolve any ticket, view solutions and analytics |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- Git
- About 5 GB of free disk space for the first build
- Node.js 22 is only needed if you want to run the tests on your machine (see [Testing](#testing))

## Setup and run (Docker)

**1. Clone the repository**

```bash
git clone https://github.com/Krish-Nahhh/Intelligent-Support-Ticket-Deflection-System.git
cd Intelligent-Support-Ticket-Deflection-System
```

**2. Create `.env.local` in the project root** (this file is git-ignored; never commit it)

```env
DB_PASSWORD=choose_a_password
DATABASE_URL=postgres://postgres:choose_a_password@localhost:5434/tickets
JWT_SECRET=paste_a_long_random_string
SIMILARITY_THRESHOLD=0.6
```

- `DB_PASSWORD` is the password the Docker Postgres container is created with. `DATABASE_URL` must use the same password.
- Inside Docker the app connects to the `db` service automatically (the compose file overrides `DATABASE_URL`), so the `localhost:5434` value is only used when running tools on your own machine.
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

`db:setup` applies the schema, seeds 40 resolved tickets, and generates their embeddings. The first run downloads the embedding model, so it takes a few minutes.

**4. Open** [http://localhost:3000](http://localhost:3000)

> Tip: to avoid typing `--env-file .env.local` every time, also create a `.env` file containing only `DB_PASSWORD=choose_a_password`.

### Useful commands

```bash
docker compose --env-file .env.local logs -f app      # follow app logs
docker compose --env-file .env.local down             # stop (keeps data)
docker compose --env-file .env.local down -v          # stop and delete the database volume
docker compose --env-file .env.local up -d --build    # rebuild after code changes
```

> **Warning:** `npm run db:migrate` (and therefore `db:setup`) drops and recreates every table. Only run it when you want a fresh database. It is never run automatically when the app starts.

## Test accounts

All seeded accounts use the password `password123`.

| Email | Role |
|---|---|
| `customer@test.com` | customer |
| `agent@test.com` | agent |
| `admin@test.com` | admin |

New customers can also register through the API (`POST /api/auth/register`).

## Demo walkthrough

1. Log in as `customer@test.com`, click **+ New ticket**, and submit "I can't sign in to my profile". A suggestion from the seeded knowledge base appears with its match percentage.
2. Click **Yes, it did**. The ticket becomes *Deflected*.
3. Submit something with no match, for example "My screen flickers when I charge the laptop". It is routed to an agent.
4. Log out and log in as `agent@test.com`. Open **All tickets**, click the new ticket, and write a solution under **Resolve this ticket**.
5. Check **Solutions**: the new solution is now part of the knowledge base.
6. Log in as the customer again and submit "Display flashes while plugged in". The agent's solution is suggested.
7. As the agent, open **Analytics** to see suggestions shown, the acceptance rate, and average match.

## Database design

PostgreSQL holds both the relational data and the vectors, so a similarity query can join straight to resolutions in a single statement.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | `id` PK, `email` UNIQUE, `password_hash`, `role` (enum: customer, agent, admin) |
| `tickets` | Support requests | `id` PK, `customer_id` FK, `assigned_agent_id` FK, `status` (enum), `priority`, `embedding vector(384)`, `sla_due_at`, `resolved_at` |
| `resolutions` | Agent solutions | `id` PK, `ticket_id` FK **UNIQUE** (one resolution per ticket), `agent_id` FK, `solution_text` |
| `solution_suggestions` | Which solution was shown for which ticket | `id` PK, `ticket_id` FK, `resolution_id` FK, `similarity`, `accepted` (NULL until the customer answers) |

Ticket status is an enum: `open`, `deflected`, `assigned`, `in_progress`, `resolved`, `closed`.

**Vector search**

- What is embedded: each ticket's `title` + newline + `description`.
- Model: `Xenova/all-MiniLM-L6-v2`, mean pooling, L2-normalized, 384 dimensions.
- Storage: `tickets.embedding vector(384)` with an HNSW index (`vector_cosine_ops`).
- Metric: cosine distance; `similarity = 1 - (a <=> b)`.
- Retrieval: nearest tickets that are `resolved` or `closed` and have a resolution, ordered by distance; the top result is used only if its similarity is at least `SIMILARITY_THRESHOLD`.

## API overview

| Method and path | Access | Description |
|---|---|---|
| `POST /api/auth/register` | public | Create a customer account |
| `POST /api/auth/login` | public | Log in, sets the session cookie |
| `POST /api/auth/logout` | logged in | Clear the session |
| `GET /api/auth/me` | logged in | Current user |
| `POST /api/tickets` | customer | Create a ticket, returns a suggestion or routes to an agent |
| `GET /api/tickets` | logged in | Tickets visible to the role (`?status=` filter) |
| `POST /api/tickets/[id]/resolve` | agent (own tickets), admin | Add a resolution |
| `POST /api/suggestions/[id]/feedback` | customer (own tickets) | Accept or reject a suggestion |
| `GET /api/solutions` | logged in | Resolved tickets with their solutions |
| `GET /api/analytics` | agent, admin | Suggestion and SLA statistics |
| `GET /api/agent/ping` | agent | Role-check endpoint used by tests |

## Project structure

```
app/            Next.js pages and API route handlers
  api/          auth, tickets, suggestions, solutions, analytics
lib/            db pool, auth/JWT, embeddings, similarity search, ticket helpers
db/             schema.sql, migrate.ts, seed.ts, backfill-embeddings.ts
tests/          Vitest API and semantic-search tests
Dockerfile, docker-compose.yml
```

## Testing

The tests call the real route handlers against a real PostgreSQL database and check authentication, role-based access, the ticket lifecycle, the deflection flow, and semantic search quality (paraphrases must score above the threshold, unrelated queries below it).

Tests refuse to run unless the database name contains `test`, so they can never wipe your real data.

With the Docker database running (`docker compose --env-file .env.local up -d db`) and Node.js 22 installed:

1. Create `.env.test` in the project root:

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

The test setup creates `tickets_test` if it does not exist and runs `npm run db:setup` against it.

## Security notes

- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- Sessions are JWTs in an `httpOnly`, `sameSite=lax` cookie (`secure` in production).
- All SQL uses parameterized queries.
- Database credentials and the JWT secret come from environment variables, not source code. `.env*` files are git-ignored and excluded from the Docker image.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Invalid credentials" on the seeded accounts | The database was not seeded. Run `docker compose --env-file .env.local run --rm app npm run db:setup`. |
| Password changed but the database still rejects it | The Postgres volume keeps its first password. Run `docker compose --env-file .env.local down -v`, then set up again. |
| First ticket is slow | The embedding model loads on first use. Later tickets are fast. |
| Docker crashes with a `containerd` or `SIGBUS` error during a build | Free disk space, run `docker builder prune -a -f`, restart Docker Desktop (`wsl --shutdown` on Windows), and retry. |
