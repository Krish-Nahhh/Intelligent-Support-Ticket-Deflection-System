"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

type Role = "customer" | "agent" | "admin";
type User = { id: number; name: string; email: string; role: Role };

type ApiTicket = {
  id: number;
  customer_id: number | null;
  assigned_agent_id: number | null;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  sla_due_at: string | null;
  created_at: string;
  sla_breached: boolean | null;
};

type Ticket = {
  id: number;
  customer_id: number | null;
  assigned_agent_id: number | null;
  title: string;
  description: string;
  status: string; // raw, e.g. "in_progress"
  priority: string; // display, e.g. "High"
  sla_due_at: string | null;
  created_at: string;
  sla_breached: boolean;
};

type Solution = {
  id: number;
  ticket_id: number;
  title: string;
  solution_text: string;
  created_at: string;
  agent_name: string | null;
};

type Analytics = {
  total_tickets: number;
  deflected: number;
  suggestions: number;
  accepted: number;
  rejected: number;
  avg_similarity: number | null;
  sla_breached: number;
};

type AdminStats = {
  total: number;
  deflected: number;
  sla_breached: number;
  deflection_rate: number;
};

type WorkloadRow = { id: number; name: string; active_tickets: number };

type SubmitResult = {
  suggestion: { id: number; similarity: number; solution: string } | null;
  routedToAgent: boolean;
};

const FINISHED = ["resolved", "closed", "deflected"];

const allNavItems = [
  { label: "Overview", number: "01" },
  { label: "All tickets", number: "02" },
  { label: "Solutions", number: "03" },
  { label: "Analytics", number: "04" },
];

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPriority(priority: string | null) {
  const value = priority || "medium";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatTicketId(id: number) {
  return `TKT-${String(id).padStart(4, "0")}`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function toTicket(t: ApiTicket): Ticket {
  return {
    id: t.id,
    customer_id: t.customer_id ?? null,
    assigned_agent_id: t.assigned_agent_id ?? null,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: formatPriority(t.priority),
    sla_due_at: t.sla_due_at ?? null,
    created_at: t.created_at,
    sla_breached: Boolean(t.sla_breached),
  };
}

function statusClass(status: string) {
  if (status === "resolved" || status === "closed") return "text-[#8FB29B]";
  if (status === "deflected") return "text-[#9E8B7A]";
  if (status === "in_progress" || status === "assigned")
    return "text-[#C9AE86]";
  return "text-[#C7838B]";
}

function pad(n: number) {
  return String(n).padStart(3, "0");
}

/* ---------- Small presentational pieces ---------- */

function Metric({
  label,
  value,
  note,
  index,
}: {
  label: string;
  value: string;
  note: string;
  index: number;
}) {
  return (
    <article
      className={`py-6 ${index % 2 === 0 ? "pr-4" : "pl-4"} ${
        index > 0 ? "sm:border-l sm:border-[#594438] sm:px-5" : ""
      } ${index < 2 ? "border-b border-[#594438] sm:border-b-0" : ""}`}
    >
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[#9E8B7A]">
        {label}
      </p>
      <p className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#B8A697]">{note}</p>
    </article>
  );
}

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-[#B8A697]">{label}</span>
        <span className="font-semibold">
          {value} <span className="text-[#9E8B7A]">· {pct}%</span>
        </span>
      </div>
      <div className="h-1 bg-[#594438]">
        <div
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TicketTable({
  rows,
  loading,
  error,
  emptyText,
  onOpen,
}: {
  rows: Ticket[];
  loading: boolean;
  error: string;
  emptyText: string;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#594438] text-[10px] uppercase tracking-[0.15em] text-[#9E8B7A]">
            <th className="py-4 pr-4 font-medium">Reference</th>
            <th className="px-4 py-4 font-medium">Subject</th>
            <th className="px-4 py-4 font-medium">SLA due</th>
            <th className="px-4 py-4 font-medium">Priority</th>
            <th className="px-4 py-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={5}
                className="py-12 text-center text-sm text-[#9E8B7A]"
              >
                Loading tickets...
              </td>
            </tr>
          )}

          {!loading && error && (
            <tr>
              <td
                colSpan={5}
                className="py-12 text-center text-sm text-[#C7838B]"
              >
                {error}
              </td>
            </tr>
          )}

          {!loading &&
            !error &&
            rows.map((ticket) => (
              <tr
                key={ticket.id}
                tabIndex={0}
                onClick={() => onOpen(ticket.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(ticket.id);
                }}
                className="cursor-pointer border-b border-[#453025] transition-colors hover:bg-[#38251B] focus:bg-[#38251B] focus:outline-none"
              >
                <td className="py-5 pr-4 font-mono text-xs text-[#9E8B7A]">
                  {formatTicketId(ticket.id)}
                </td>
                <td className="max-w-[300px] whitespace-normal px-4 py-5 font-medium text-[#F5F0E8]">
                  {ticket.title}
                </td>
                <td className="px-4 py-5 text-xs text-[#B8A697]">
                  {FINISHED.includes(ticket.status) ? (
                    "—"
                  ) : (
                    <>
                      {formatDate(ticket.sla_due_at)}
                      {ticket.sla_breached && (
                        <span className="ml-2 font-semibold text-[#C7838B]">
                          Overdue
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="px-4 py-5">
                  <span
                    className={
                      ticket.priority === "Urgent" ||
                      ticket.priority === "High"
                        ? "font-semibold text-[#C7838B]"
                        : "text-[#B8A697]"
                    }
                  >
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-4 py-5">
                  <span className={statusClass(ticket.status)}>
                    {formatStatus(ticket.status)}
                  </span>
                </td>
              </tr>
            ))}

          {!loading && !error && rows.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="py-12 text-center text-sm text-[#9E8B7A]"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TicketPanel({
  ticket,
  solution,
  user,
  onClose,
  onResolved,
  onDeleted,
}: {
  ticket: Ticket;
  solution: Solution | undefined;
  user: User | null;
  onClose: () => void;
  onResolved: () => void;
  onDeleted: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const finished = FINISHED.includes(ticket.status);
  const isStaff = user?.role === "agent" || user?.role === "admin";
  const canResolve =
    !finished &&
    !!user &&
    (user.role === "admin" ||
      (user.role === "agent" && ticket.assigned_agent_id === user.id));

  async function deleteTicket() {
    setDeleting(true);
    setDeleteErr("");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete ticket");
      onDeleted();
    } catch (e2) {
      setDeleteErr(e2 instanceof Error ? e2.message : "Could not delete ticket");
      setDeleting(false);
    }
  }

  async function resolve(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not resolve ticket");
      setText("");
      onResolved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not resolve ticket");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close ticket"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-[#594438] bg-[#2C1A0E] p-6 text-[#F5F0E8]">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-xs text-[#9E8B7A]">
            {formatTicketId(ticket.id)}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[#B8A697] hover:text-[#F5F0E8]"
          >
            Close
          </button>
        </div>

        <h2 className="mt-4 text-2xl font-bold leading-tight">
          {ticket.title}
        </h2>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-[#594438] py-4 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[#9E8B7A]">
              Status
            </dt>
            <dd className={`mt-1 ${statusClass(ticket.status)}`}>
              {formatStatus(ticket.status)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[#9E8B7A]">
              Priority
            </dt>
            <dd className="mt-1">{ticket.priority}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[#9E8B7A]">
              Created
            </dt>
            <dd className="mt-1 text-xs">{formatDate(ticket.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[#9E8B7A]">
              SLA due
            </dt>
            <dd className="mt-1 text-xs">
              {finished ? "—" : formatDate(ticket.sla_due_at)}
              {!finished && ticket.sla_breached && (
                <span className="ml-2 font-semibold text-[#C7838B]">
                  Overdue
                </span>
              )}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
          Description
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#D9CBB9]">
          {ticket.description}
        </p>

        {solution && (
          <div className="mt-6 border border-[#594438] p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
              Solution
              {solution.agent_name ? ` · ${solution.agent_name}` : ""}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {solution.solution_text}
            </p>
          </div>
        )}

        {ticket.status === "deflected" && (
          <p className="mt-6 text-sm text-[#B8A697]">
            The customer accepted a suggested solution, so no agent was needed.
          </p>
        )}

        {canResolve && (
          <form onSubmit={resolve} className="mt-6 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
              Resolve this ticket
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write the solution. It will be suggested to future customers with similar problems."
              required
              rows={5}
              className="w-full border border-[#594438] bg-transparent px-3 py-2 text-sm text-[#F5F0E8] outline-none placeholder:text-[#9E8B7A]"
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-[#2A4A3A] px-5 py-3 text-sm font-semibold text-[#F5F0E8] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Resolve ticket"}
            </button>
            {err && <p className="text-sm text-[#C7838B]">{err}</p>}
          </form>
        )}

        {!canResolve && !finished && isStaff && (
          <p className="mt-6 text-sm text-[#B8A697]">
            Only the assigned agent (or an admin) can resolve this ticket.
          </p>
        )}

        {user?.role === "admin" && (
          <div className="mt-8 border-t border-[#594438] pt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
              Admin actions
            </p>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="mt-3 border border-[#6B1E2D] px-4 py-2 text-sm font-semibold text-[#C7838B] transition hover:bg-[#3A1A1F]"
              >
                Delete ticket
              </button>
            ) : (
              <div className="mt-3 border border-[#6B1E2D] p-4">
                <p className="text-sm leading-6 text-[#D9CBB9]">
                  This permanently deletes the ticket together with its
                  resolution and suggestions. It cannot be undone.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={deleteTicket}
                    className="bg-[#6B1E2D] px-4 py-2 text-sm font-semibold text-[#F5F0E8] disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Yes, delete permanently"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                    className="border border-[#594438] px-4 py-2 text-sm text-[#B8A697] hover:bg-[#38251B]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {deleteErr && (
              <p className="mt-3 text-sm text-[#C7838B]">{deleteErr}</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/* ---------- Page ---------- */

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [solutionSearch, setSolutionSearch] = useState("");

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");

  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [workloadMin, setWorkloadMin] = useState(1);
  const [adminError, setAdminError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Read the clock only in the browser (inside an effect), never during prerender.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [feedback, setFeedback] = useState<
    "idle" | "sending" | "accepted" | "rejected"
  >("idle");
  const [feedbackError, setFeedbackError] = useState("");

  const loadTickets = useCallback(async () => {
    try {
      const response = await fetch("/api/tickets");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load tickets");
      if (!Array.isArray(data.tickets)) {
        throw new Error("Unexpected response from the ticket API");
      }
      setTickets((data.tickets as ApiTicket[]).map(toTicket));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSolutions = useCallback(async () => {
    try {
      const response = await fetch("/api/solutions");
      const data = await response.json();
      if (response.ok && Array.isArray(data.solutions)) {
        setSolutions(data.solutions as Solution[]);
      }
    } catch {
      /* the Solutions view just stays empty */
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        setUser(data.user as User);
      } catch {
        window.location.href = "/login";
      }
    }
    loadUser();
    loadTickets();
    loadSolutions();
  }, [loadTickets, loadSolutions]);

  useEffect(() => {
    if (activeNav !== "Analytics") return;
    async function loadAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load analytics");
        setAnalytics(data.analytics as Analytics);
        setAnalyticsError("");
      } catch (err) {
        setAnalyticsError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      }
    }
    loadAnalytics();
  }, [activeNav, tickets]);

  useEffect(() => {
    if (activeNav !== "Analytics" || user?.role !== "admin") return;
    async function loadAdminReports() {
      try {
        const [statsRes, workRes] = await Promise.all([
          fetch("/api/stats"),
          fetch(`/api/reports/agent-workload?min=${workloadMin}`),
        ]);
        const statsData = await statsRes.json();
        const workData = await workRes.json();
        if (!statsRes.ok) {
          throw new Error(statsData.error || "Failed to load stats");
        }
        if (!workRes.ok) {
          throw new Error(workData.error || "Failed to load workload report");
        }
        setAdminStats(statsData as AdminStats);
        setWorkload((workData.agents ?? []) as WorkloadRow[]);
        setAdminError("");
      } catch (err) {
        setAdminError(
          err instanceof Error ? err.message : "Failed to load admin reports"
        );
      }
    }
    loadAdminReports();
  }, [activeNav, tickets, user, workloadMin]);

  async function submitTicket(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setResult(null);
    setFeedback("idle");
    setFeedbackError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          priority: newPriority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");
      setResult({
        suggestion: data.suggestion,
        routedToAgent: data.routedToAgent,
      });
      setNewTitle("");
      setNewDescription("");
      await loadTickets();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create ticket"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendFeedback(accepted: boolean) {
    if (!result?.suggestion) return;
    setFeedback("sending");
    setFeedbackError("");
    try {
      const res = await fetch(
        `/api/suggestions/${result.suggestion.id}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save feedback");
      setFeedback(accepted ? "accepted" : "rejected");
      await loadTickets();
    } catch (err) {
      setFeedback("idle");
      setFeedbackError(
        err instanceof Error ? err.message : "Could not save feedback"
      );
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleResolved() {
    await Promise.all([loadTickets(), loadSolutions()]);
  }

  async function handleDeleted() {
    setSelectedId(null);
    await Promise.all([loadTickets(), loadSolutions()]);
  }

  const navItems = useMemo(
    () =>
      allNavItems.filter(
        (item) => item.label !== "Analytics" || user?.role !== "customer"
      ),
    [user]
  );

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const statusLabel = formatStatus(ticket.status);
      const matchesSearch =
        !q ||
        [
          formatTicketId(ticket.id),
          ticket.title,
          ticket.priority,
          statusLabel,
        ].some((value) => value.toLowerCase().includes(q));
      const matchesStatus =
        statusFilter === "All statuses" || statusLabel === statusFilter;
      const matchesPriority =
        priorityFilter === "All priorities" ||
        ticket.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const counts = useMemo(() => {
    const open = tickets.filter((t) =>
      ["open", "assigned", "in_progress"].includes(t.status)
    ).length;
    const resolved = tickets.filter((t) =>
      ["resolved", "closed"].includes(t.status)
    ).length;
    const deflected = tickets.filter((t) => t.status === "deflected").length;
    const breached = tickets.filter(
      (t) => t.sla_breached && !FINISHED.includes(t.status)
    ).length;
    const weekAgo = now === null ? 0 : now - 7 * 24 * 60 * 60 * 1000;
    const lastWeek =
      now === null
        ? 0
        : tickets.filter((t) => new Date(t.created_at).getTime() >= weekAgo)
            .length;
    return {
      total: tickets.length,
      open,
      resolved,
      deflected,
      breached,
      lastWeek,
    };
  }, [tickets, now]);

  const volume = useMemo(() => {
    if (now === null) return [];
    const days: { date: number; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.getTime(),
        label: d
          .toLocaleDateString("en-US", { weekday: "short" })
          .toUpperCase(),
        count: 0,
      });
    }
    tickets.forEach((t) => {
      const c = new Date(t.created_at);
      c.setHours(0, 0, 0, 0);
      const slot = days.find((d) => d.date === c.getTime());
      if (slot) slot.count += 1;
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    return days.map((d) => ({
      ...d,
      pct: Math.max(2, Math.round((d.count / max) * 100)),
      isMax: d.count === max && d.count > 0,
    }));
  }, [tickets, now]);

  const filteredSolutions = useMemo(() => {
    const q = solutionSearch.trim().toLowerCase();
    return solutions.filter(
      (s) =>
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.solution_text.toLowerCase().includes(q)
    );
  }, [solutions, solutionSearch]);

  const solutionByTicket = useMemo(() => {
    const map = new Map<number, Solution>();
    solutions.forEach((s) => map.set(s.ticket_id, s));
    return map;
  }, [solutions]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;
  const isCustomer = user?.role === "customer";
  const isAdmin = user?.role === "admin";
  const recent = filteredTickets.slice(0, 8);

  const statCards = [
    {
      label: "TOTAL TICKETS",
      value: pad(counts.total),
      note: `${counts.lastWeek} in the last 7 days`,
    },
    {
      label: "OPEN",
      value: pad(counts.open),
      note: counts.breached
        ? `${counts.breached} past SLA`
        : "Needs attention",
    },
    {
      label: "RESOLVED",
      value: pad(counts.resolved),
      note: "Closed by an agent",
    },
    {
      label: "DEFLECTED",
      value: pad(counts.deflected),
      note: "Solutions accepted",
    },
  ];

  const filters = (
    <div className="mt-6 grid gap-3 border-y border-[#594438] py-4 md:grid-cols-[minmax(200px,1fr)_180px_180px]">
      <label className="flex min-w-0 items-center gap-3 border-b border-[#594438] pb-3 md:border-b-0 md:pb-0">
        <span className="text-[#9E8B7A]">⌕</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tickets, subjects, status..."
          aria-label="Search tickets"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#F5F0E8] outline-none placeholder:text-[#9E8B7A]"
        />
      </label>

      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        aria-label="Filter by status"
        className="border-b border-[#594438] bg-[#2C1A0E] py-3 text-sm text-[#F5F0E8] outline-none md:border-b-0 md:border-l md:pl-4"
      >
        <option>All statuses</option>
        <option>Open</option>
        <option>Deflected</option>
        <option>Assigned</option>
        <option>In Progress</option>
        <option>Resolved</option>
        <option>Closed</option>
      </select>

      <select
        value={priorityFilter}
        onChange={(event) => setPriorityFilter(event.target.value)}
        aria-label="Filter by priority"
        className="border-b border-[#594438] bg-[#2C1A0E] py-3 text-sm text-[#F5F0E8] outline-none md:border-b-0 md:border-l md:pl-4"
      >
        <option>All priorities</option>
        <option>Urgent</option>
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>
    </div>
  );

  return (
    <main className="min-h-screen md:flex">
      <aside className="flex w-full shrink-0 flex-col border-b border-[#594438] p-5 md:min-h-screen md:w-[228px] md:border-b-0 md:border-r md:p-6">
        <a href="#" className="inline-flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center bg-[#F5F0E8] text-lg font-bold text-[#2C1A0E]">
            R
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight">
              resolve<span className="text-[#9E8B7A]">.</span>
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-[#9E8B7A]">
              Intelligent support
            </span>
          </span>
        </a>

        <div className="mt-10">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9E8B7A]">
            Workspace
          </p>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveNav(item.label)}
                className={`flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left text-sm transition ${
                  activeNav === item.label
                    ? "border-[#9E8B7A] bg-[#38251B] text-[#F5F0E8]"
                    : "border-transparent text-[#B8A697] hover:bg-[#38251B] hover:text-[#F5F0E8]"
                }`}
              >
                <span className="w-6 font-mono text-[10px] text-[#9E8B7A]">
                  {item.number}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-9 border-t border-[#594438] pt-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
            The system
          </p>
          <p className="mt-3 text-sm font-semibold">Resolve it once.</p>
          <p className="mt-2 text-xs leading-5 text-[#B8A697]">
            Surface relevant solutions from previously resolved support
            requests.
          </p>
          <div className="mt-4 h-1 w-full bg-[#594438]">
            <div className="h-full w-2/3 bg-[#2A4A3A]" />
          </div>
        </div>

        <div className="mt-8 border-t border-[#594438] pt-5 md:mt-auto md:pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
            Signed in
          </p>
          <p className="mt-2 text-sm">{user ? user.name : "…"}</p>
          <p className="mt-1 text-xs capitalize text-[#9E8B7A]">
            {user ? user.role : ""}
          </p>
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-5 py-7 md:px-9 md:py-8 lg:px-12">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[#594438] pb-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9E8B7A]">
              Support operations / {activeNav}
            </p>

            {activeNav === "Overview" ? (
              <>
                <h1 className="mt-5 text-4xl font-bold leading-[1.06] tracking-tight md:text-5xl lg:text-6xl">
                  Find the pattern.
                  <br />
                  <span className="font-normal text-[#9E8B7A]">
                    Resolve it once.
                  </span>
                </h1>
                <p className="mt-5 max-w-lg text-sm leading-6 text-[#B8A697]">
                  A clearer view of incoming issues, recurring problems, and
                  opportunities for automated resolution.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
                  {activeNav}
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-[#B8A697]">
                  {activeNav === "All tickets" &&
                    (isCustomer
                      ? "Every ticket you have submitted. Select one to see its details."
                      : "Select a ticket to read it and, if it is yours, resolve it.")}
                  {activeNav === "Solutions" &&
                    "Solutions from resolved tickets. These are what customers see as suggestions."}
                  {activeNav === "Analytics" &&
                    "How well suggested solutions are deflecting tickets."}
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            {isCustomer && (
              <button
                type="button"
                onClick={() => {
                  setShowForm((v) => !v);
                  setResult(null);
                  setFormError("");
                  setFeedback("idle");
                }}
                className="bg-[#2A4A3A] px-5 py-3 text-sm font-semibold text-[#F5F0E8] transition hover:bg-[#355D49]"
              >
                {showForm ? "Close" : "+ New ticket"}
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="border border-[#594438] px-5 py-3 text-sm font-semibold text-[#B8A697] transition hover:bg-[#38251B] hover:text-[#F5F0E8]"
            >
              Log out
            </button>
          </div>
        </header>

        {showForm && isCustomer && (
          <section className="border-b border-[#594438] py-7">
            <form onSubmit={submitTicket} className="max-w-2xl space-y-4">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title"
                required
                className="w-full border border-[#594438] bg-transparent px-3 py-2 text-sm text-[#F5F0E8] outline-none placeholder:text-[#9E8B7A]"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe the problem"
                required
                rows={4}
                className="w-full border border-[#594438] bg-transparent px-3 py-2 text-sm text-[#F5F0E8] outline-none placeholder:text-[#9E8B7A]"
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                aria-label="Priority"
                className="border border-[#594438] bg-[#2C1A0E] px-3 py-2 text-sm text-[#F5F0E8]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2A4A3A] px-5 py-3 text-sm font-semibold text-[#F5F0E8] disabled:opacity-50"
                >
                  {submitting ? "Searching for a solution..." : "Submit ticket"}
                </button>
              </div>
              {formError && (
                <p className="text-sm text-[#C7838B]">{formError}</p>
              )}
            </form>

            {result && (
              <div className="mt-6 max-w-2xl border border-[#594438] p-4">
                {result.suggestion ? (
                  <>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
                      Suggested solution ·{" "}
                      {Math.round(result.suggestion.similarity * 100)}% match
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {result.suggestion.solution}
                    </p>

                    {feedback === "accepted" && (
                      <p className="mt-4 text-sm text-[#8FB29B]">
                        Glad that helped. Your ticket is marked as deflected.
                      </p>
                    )}
                    {feedback === "rejected" && (
                      <p className="mt-4 text-sm text-[#C9AE86]">
                        Sorry that did not help. Your ticket was assigned to an
                        agent.
                      </p>
                    )}
                    {(feedback === "idle" || feedback === "sending") && (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-[#B8A697]">
                          Did this solve your problem?
                        </span>
                        <button
                          type="button"
                          disabled={feedback === "sending"}
                          onClick={() => sendFeedback(true)}
                          className="bg-[#2A4A3A] px-4 py-2 text-sm font-semibold text-[#F5F0E8] disabled:opacity-50"
                        >
                          Yes, it did
                        </button>
                        <button
                          type="button"
                          disabled={feedback === "sending"}
                          onClick={() => sendFeedback(false)}
                          className="border border-[#594438] px-4 py-2 text-sm font-semibold text-[#B8A697] hover:bg-[#38251B] disabled:opacity-50"
                        >
                          No, send to an agent
                        </button>
                      </div>
                    )}
                    {feedbackError && (
                      <p className="mt-3 text-sm text-[#C7838B]">
                        {feedbackError}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm">
                    No close match found. Your ticket was routed to an agent.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {activeNav === "Overview" && (
          <>
            <section
              aria-label="Ticket statistics"
              className="grid grid-cols-2 border-b border-[#594438] sm:grid-cols-4"
            >
              {statCards.map((stat, index) => (
                <Metric
                  key={stat.label}
                  index={index}
                  label={stat.label}
                  value={stat.value}
                  note={stat.note}
                />
              ))}
            </section>

            <section className="grid border-b border-[#594438] lg:grid-cols-[1.5fr_1fr]">
              <article className="py-7 lg:pr-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
                      01 / Activity
                    </p>
                    <h2 className="mt-2 text-xl font-bold">Ticket volume</h2>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[#9E8B7A]">
                    Last 7 days
                  </span>
                </div>

                <div className="mt-7 flex h-36 items-end gap-3 sm:gap-5">
                  {volume.map((item) => (
                    <div
                      key={item.date}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-3"
                    >
                      <div className="flex h-full w-full items-end">
                        <div
                          className={`w-full transition-colors ${
                            item.isMax
                              ? "bg-[#6B1E2D]"
                              : "bg-[#2A4A3A] hover:bg-[#426B54]"
                          }`}
                          style={{ height: `${item.pct}%` }}
                          title={`${item.label}: ${item.count} ticket${
                            item.count === 1 ? "" : "s"
                          }`}
                        />
                      </div>
                      <span className="text-[9px] tracking-wider text-[#9E8B7A]">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="border-t border-[#594438] py-7 lg:border-l lg:border-t-0 lg:pl-8">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
                  02 / Resolution
                </p>
                <h2 className="mt-2 text-xl font-bold">Outcomes</h2>

                <div className="mt-7 space-y-5">
                  <Bar
                    label="Resolved"
                    value={counts.resolved}
                    total={counts.total}
                    color="#2A4A3A"
                  />
                  <Bar
                    label="Open"
                    value={counts.open}
                    total={counts.total}
                    color="#6B1E2D"
                  />
                  <Bar
                    label="Deflected"
                    value={counts.deflected}
                    total={counts.total}
                    color="#9E8B7A"
                  />
                </div>
              </article>
            </section>

            <section className="pt-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
                03 / Queue
              </p>
              <h2 className="mt-2 text-2xl font-bold">Recent tickets</h2>
              <p className="mt-2 text-sm text-[#B8A697]">
                {loading
                  ? "Loading tickets..."
                  : `Showing ${recent.length} of ${tickets.length} tickets`}
              </p>
              {filters}
              <TicketTable
                rows={recent}
                loading={loading}
                error={error}
                emptyText="No tickets match your search and filters."
                onOpen={setSelectedId}
              />
            </section>
          </>
        )}

        {activeNav === "All tickets" && (
          <section className="pt-8">
            <p className="text-sm text-[#B8A697]">
              {loading
                ? "Loading tickets..."
                : `${filteredTickets.length} of ${tickets.length} tickets`}
            </p>
            {filters}
            <TicketTable
              rows={filteredTickets}
              loading={loading}
              error={error}
              emptyText={
                isCustomer && tickets.length === 0
                  ? "You have not submitted any tickets yet."
                  : "No tickets match your search and filters."
              }
              onOpen={setSelectedId}
            />
          </section>
        )}

        {activeNav === "Solutions" && (
          <section className="pt-8">
            <p className="text-sm text-[#B8A697]">
              {filteredSolutions.length} of {solutions.length} solutions
            </p>
            <div className="mt-6 border-y border-[#594438] py-4">
              <label className="flex items-center gap-3">
                <span className="text-[#9E8B7A]">⌕</span>
                <input
                  type="search"
                  value={solutionSearch}
                  onChange={(e) => setSolutionSearch(e.target.value)}
                  placeholder="Search solutions..."
                  aria-label="Search solutions"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#F5F0E8] outline-none placeholder:text-[#9E8B7A]"
                />
              </label>
            </div>

            <div className="divide-y divide-[#453025]">
              {filteredSolutions.map((s) => (
                <article key={s.id} className="py-6">
                  <p className="font-mono text-xs text-[#9E8B7A]">
                    {formatTicketId(s.ticket_id)}
                    {s.agent_name ? ` · ${s.agent_name}` : ""} ·{" "}
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#D9CBB9]">
                    {s.solution_text}
                  </p>
                </article>
              ))}
              {filteredSolutions.length === 0 && (
                <p className="py-12 text-center text-sm text-[#9E8B7A]">
                  No solutions match your search.
                </p>
              )}
            </div>
          </section>
        )}

        {activeNav === "Analytics" && (
          <section className="pt-2">
            {analyticsError && (
              <p className="py-8 text-sm text-[#C7838B]">{analyticsError}</p>
            )}
            {!analytics && !analyticsError && (
              <p className="py-8 text-sm text-[#9E8B7A]">Loading analytics...</p>
            )}
            {analytics && (
              <>
                <div className="grid grid-cols-2 border-b border-[#594438] sm:grid-cols-4">
                  <Metric
                    index={0}
                    label="SUGGESTIONS SHOWN"
                    value={pad(analytics.suggestions)}
                    note="Matches above the threshold"
                  />
                  <Metric
                    index={1}
                    label="ACCEPTANCE RATE"
                    value={
                      analytics.accepted + analytics.rejected > 0
                        ? `${Math.round(
                            (analytics.accepted /
                              (analytics.accepted + analytics.rejected)) *
                              100
                          )}%`
                        : "—"
                    }
                    note="Of suggestions with feedback"
                  />
                  <Metric
                    index={2}
                    label="AVG MATCH"
                    value={
                      analytics.avg_similarity === null
                        ? "—"
                        : `${Math.round(analytics.avg_similarity * 100)}%`
                    }
                    note="Similarity of shown suggestions"
                  />
                  <Metric
                    index={3}
                    label="PAST SLA"
                    value={pad(analytics.sla_breached)}
                    note="Unfinished and overdue"
                  />
                </div>

                <div className="grid gap-10 py-8 md:grid-cols-2">
                  <article>
                    <h2 className="text-xl font-bold">Suggestion outcomes</h2>
                    <div className="mt-6 space-y-5">
                      <Bar
                        label="Accepted"
                        value={analytics.accepted}
                        total={analytics.suggestions}
                        color="#2A4A3A"
                      />
                      <Bar
                        label="Rejected"
                        value={analytics.rejected}
                        total={analytics.suggestions}
                        color="#6B1E2D"
                      />
                      <Bar
                        label="Awaiting feedback"
                        value={Math.max(
                          0,
                          analytics.suggestions -
                            analytics.accepted -
                            analytics.rejected
                        )}
                        total={analytics.suggestions}
                        color="#9E8B7A"
                      />
                    </div>
                  </article>

                  <article>
                    <h2 className="text-xl font-bold">Tickets by status</h2>
                    <div className="mt-6 space-y-5">
                      {[
                        "open",
                        "assigned",
                        "in_progress",
                        "resolved",
                        "closed",
                        "deflected",
                      ].map((s) => (
                        <Bar
                          key={s}
                          label={formatStatus(s)}
                          value={tickets.filter((t) => t.status === s).length}
                          total={tickets.length}
                          color={
                            s === "resolved" || s === "closed"
                              ? "#2A4A3A"
                              : s === "deflected"
                                ? "#9E8B7A"
                                : "#6B1E2D"
                          }
                        />
                      ))}
                    </div>
                  </article>
                </div>

                {isAdmin && (
                  <div className="border-t border-[#594438] py-8">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
                      Admin only
                    </p>
                    <h2 className="mt-2 text-xl font-bold">Operations report</h2>

                    {adminError && (
                      <p className="mt-4 text-sm text-[#C7838B]">{adminError}</p>
                    )}

                    {adminStats && (
                      <div className="mt-6 grid grid-cols-2 border-y border-[#594438] sm:grid-cols-4">
                        <Metric
                          index={0}
                          label="DEFLECTION RATE"
                          value={`${adminStats.deflection_rate}%`}
                          note="Deflected of all tickets"
                        />
                        <Metric
                          index={1}
                          label="ALL TICKETS"
                          value={pad(adminStats.total)}
                          note="Counted from ticket_summary"
                        />
                        <Metric
                          index={2}
                          label="DEFLECTED"
                          value={pad(adminStats.deflected)}
                          note="Solved without an agent"
                        />
                        <Metric
                          index={3}
                          label="SLA BREACHED"
                          value={pad(adminStats.sla_breached)}
                          note="Unfinished and overdue"
                        />
                      </div>
                    )}

                    <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold">Agent workload</h3>
                        <p className="mt-1 text-sm text-[#B8A697]">
                          Agents with at least this many active (assigned or
                          in progress) tickets.
                        </p>
                      </div>
                      <label className="flex items-center gap-3 text-sm text-[#B8A697]">
                        Minimum active tickets
                        <select
                          value={workloadMin}
                          onChange={(e) => setWorkloadMin(Number(e.target.value))}
                          className="border border-[#594438] bg-[#2C1A0E] px-3 py-2 text-sm text-[#F5F0E8]"
                        >
                          {[1, 2, 3, 5, 10].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <table className="mt-4 w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#594438] text-[10px] uppercase tracking-[0.15em] text-[#9E8B7A]">
                          <th className="py-3 pr-4 font-medium">Agent</th>
                          <th className="px-4 py-3 font-medium">Active tickets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workload.map((row) => (
                          <tr key={row.id} className="border-b border-[#453025]">
                            <td className="py-4 pr-4 font-medium">{row.name}</td>
                            <td className="px-4 py-4 text-[#B8A697]">
                              {row.active_tickets}
                            </td>
                          </tr>
                        ))}
                        {workload.length === 0 && (
                          <tr>
                            <td
                              colSpan={2}
                              className="py-8 text-center text-sm text-[#9E8B7A]"
                            >
                              No agent has at least {workloadMin} active
                              ticket{workloadMin === 1 ? "" : "s"}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-[#594438] pt-5 text-[10px] uppercase tracking-[0.12em] text-[#9E8B7A]">
          <span>Resolve · Intelligent Support</span>
          <span>Built for better resolutions</span>
        </footer>
      </section>

      {selected && (
        <TicketPanel
          key={selected.id}
          ticket={selected}
          solution={solutionByTicket.get(selected.id)}
          user={user}
          onClose={() => setSelectedId(null)}
          onResolved={handleResolved}
          onDeleted={handleDeleted}
        />
      )}
    </main>
  );
}
