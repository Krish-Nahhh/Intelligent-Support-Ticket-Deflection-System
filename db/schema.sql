DROP TABLE IF EXISTS solution_suggestions, resolutions, tickets, users CASCADE;
DROP TYPE IF EXISTS ticket_status, user_role;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE user_role AS ENUM ('customer', 'agent', 'admin');
CREATE TYPE ticket_status AS ENUM ('open', 'deflected', 'assigned', 'in_progress', 'resolved', 'closed');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'customer'
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES users(id),
  assigned_agent_id INT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT now(),
  sla_due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE resolutions (
  id SERIAL PRIMARY KEY,
  ticket_id INT UNIQUE REFERENCES tickets(id),
  agent_id INT REFERENCES users(id),
  solution_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE solution_suggestions (
  id SERIAL PRIMARY KEY,
  ticket_id INT REFERENCES tickets(id),
  resolution_id INT REFERENCES resolutions(id),
  similarity REAL NOT NULL,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON tickets USING hnsw (embedding vector_cosine_ops);