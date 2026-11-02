DROP VIEW IF EXISTS ticket_summary;
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
  ticket_id INT UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  agent_id INT REFERENCES users(id),
  solution_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE solution_suggestions (
  id SERIAL PRIMARY KEY,
  ticket_id INT REFERENCES tickets(id) ON DELETE CASCADE,
  resolution_id INT REFERENCES resolutions(id) ON DELETE SET NULL,
  similarity REAL NOT NULL,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON tickets USING hnsw (embedding vector_cosine_ops);

-- ALTER statements: add integrity constraints after table creation
ALTER TABLE tickets ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
ALTER TABLE tickets ADD CONSTRAINT tickets_resolved_at_check
  CHECK (status NOT IN ('resolved', 'closed', 'deflected') OR resolved_at IS NOT NULL);
ALTER TABLE users ADD CONSTRAINT users_email_check CHECK (email LIKE '%_@_%');

-- View used by the stats endpoint
CREATE VIEW ticket_summary AS
SELECT t.id, t.title, t.status, t.priority, t.created_at, t.resolved_at, t.sla_due_at,
       c.name AS customer_name,
       a.name AS agent_name,
       (t.sla_due_at < now() AND t.status NOT IN ('resolved', 'closed', 'deflected')) AS sla_breached
FROM tickets t
JOIN users c ON c.id = t.customer_id
LEFT JOIN users a ON a.id = t.assigned_agent_id;