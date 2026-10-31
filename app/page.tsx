
"use client";

import { useEffect, useMemo, useState } from "react";

type Ticket = {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
};

type ApiTicket = {
  id: number;
  title: string;
  priority: string | null;
  status: string;
  created_at: string;
};

const stats = [
  { label: "TOTAL TICKETS", value: "248", note: "+12 this week" },
  { label: "OPEN", value: "042", note: "Needs attention" },
  { label: "RESOLVED", value: "186", note: "This month" },
  { label: "DEFLECTED", value: "064", note: "Solutions found" },
];

const activity = [
  { day: "MON", value: 45 },
  { day: "TUE", value: 70 },
  { day: "WED", value: 55 },
  { day: "THU", value: 90 },
  { day: "FRI", value: 65 },
  { day: "SAT", value: 35 },
  { day: "SUN", value: 50 },
];

const navItems = [
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

export default function Home() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      try {
        const response = await fetch("/api/tickets");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load tickets");
        }

        if (!Array.isArray(data.tickets)) {
          throw new Error("Unexpected response from the ticket API");
        }

        const loadedTickets: Ticket[] = (
          data.tickets as ApiTicket[]
        ).map((ticket) => ({
          id: ticket.id,
          title: ticket.title,
          category: "Uncategorized",
          priority: formatPriority(ticket.priority),
          status: formatStatus(ticket.status),
          created_at: ticket.created_at,
        }));

        if (!cancelled) {
          setTickets(loadedTickets);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load tickets"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTickets();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        [
          formatTicketId(ticket.id),
          ticket.title,
          ticket.category,
          ticket.priority,
          ticket.status,
        ].some((value) => value.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All statuses" ||
        ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === "All priorities" ||
        ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

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
          <p className="mt-2 text-[10px] text-[#9E8B7A]">
            Semantic resolution · Preview
          </p>
        </div>

        <div className="mt-8 border-t border-[#594438] pt-5 md:mt-auto md:pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
            Environment
          </p>
          <p className="mt-2 text-sm">Development workspace</p>
          <p className="mt-1 text-xs text-[#9E8B7A]">Frontend preview</p>
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-5 py-7 md:px-9 md:py-8 lg:px-12">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[#594438] pb-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9E8B7A]">
              Support operations / {activeNav}
            </p>

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
          </div>

          <button
            type="button"
            onClick={() =>
              window.alert(
                "Ticket creation will be connected to the backend in a later step."
              )
            }
            className="bg-[#2A4A3A] px-5 py-3 text-sm font-semibold text-[#F5F0E8] transition hover:bg-[#355D49]"
          >
            + New ticket
          </button>
        </header>

        <section
          aria-label="Ticket statistics"
          className="grid grid-cols-2 border-b border-[#594438] sm:grid-cols-4"
        >
          {stats.map((stat, index) => (
            <article
              key={stat.label}
              className={`py-6 ${
                index % 2 === 0 ? "pr-4" : "pl-4"
              } ${
                index > 0 ? "sm:border-l sm:border-[#594438] sm:px-5" : ""
              } ${
                index < 2 ? "border-b border-[#594438] sm:border-b-0" : ""
              }`}
            >
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[#9E8B7A]">
                {stat.label}
              </p>
              <p className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-[#B8A697]">{stat.note}</p>
            </article>
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
                Illustrative data
              </span>
            </div>

            <div className="mt-7 flex h-36 items-end gap-3 sm:gap-5">
              {activity.map((item) => (
                <div
                  key={item.day}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-3"
                >
                  <div className="flex h-full w-full items-end">
                    <div
                      className={`w-full transition-colors ${
                        item.day === "THU"
                          ? "bg-[#6B1E2D]"
                          : "bg-[#2A4A3A] hover:bg-[#426B54]"
                      }`}
                      style={{ height: `${item.value}%` }}
                      title={`${item.day}: ${item.value}% sample activity`}
                    />
                  </div>
                  <span className="text-[9px] tracking-wider text-[#9E8B7A]">
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="border-t border-[#594438] py-7 lg:border-l lg:border-t-0 lg:pl-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
              02 / Resolution
            </p>
            <h2 className="mt-2 text-xl font-bold">Monthly outcomes</h2>

            <div className="mt-7 space-y-5">
              {[
                { label: "Resolved", value: 75, color: "#2A4A3A" },
                { label: "Open", value: 17, color: "#6B1E2D" },
                { label: "Deflected", value: 26, color: "#9E8B7A" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-[#B8A697]">{item.label}</span>
                    <span className="font-semibold">{item.value}%</span>
                  </div>
                  <div className="h-1 bg-[#594438]">
                    <div
                      className="h-full"
                      style={{
                        width: `${item.value}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E8B7A]">
                03 / Queue
              </p>
              <h2 className="mt-2 text-2xl font-bold">Recent tickets</h2>
              <p className="mt-2 text-sm text-[#B8A697]">
                {loading
                  ? "Loading tickets..."
                  : `${filteredTickets.length} of ${tickets.length} tickets`}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-y border-[#594438] py-4 md:grid-cols-[minmax(200px,1fr)_180px_180px]">
            <label className="flex min-w-0 items-center gap-3 border-b border-[#594438] pb-3 md:border-b-0 md:pb-0">
              <span className="text-[#9E8B7A]">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets, subjects, categories..."
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
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#594438] text-[10px] uppercase tracking-[0.15em] text-[#9E8B7A]">
                  <th className="py-4 pr-4 font-medium">Reference</th>
                  <th className="px-4 py-4 font-medium">Subject</th>
                  <th className="px-4 py-4 font-medium">Category</th>
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
                  filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b border-[#453025] transition-colors hover:bg-[#38251B]"
                    >
                      <td className="py-5 pr-4 font-mono text-xs text-[#9E8B7A]">
                        {formatTicketId(ticket.id)}
                      </td>
                      <td className="max-w-[300px] whitespace-normal px-4 py-5 font-medium text-[#F5F0E8]">
                        {ticket.title}
                      </td>
                      <td className="px-4 py-5 text-[#B8A697]">
                        {ticket.category}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={
                            ticket.priority === "Critical" ||
                            ticket.priority === "High"
                              ? "font-semibold text-[#C7838B]"
                              : "text-[#B8A697]"
                          }
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={
                            ticket.status === "Resolved" ||
                            ticket.status === "Closed"
                              ? "text-[#8FB29B]"
                              : ticket.status === "In Progress" ||
                                  ticket.status === "Assigned"
                                ? "text-[#C9AE86]"
                                : "text-[#C7838B]"
                          }
                        >
                          {ticket.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                {!loading && !error && filteredTickets.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-sm text-[#9E8B7A]"
                    >
                      No tickets match your search and filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-[10px] uppercase tracking-[0.12em] text-[#9E8B7A]">
            Ticket records · Live API data
          </p>
        </section>

        <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-[#594438] pt-5 text-[10px] uppercase tracking-[0.12em] text-[#9E8B7A]">
          <span>Resolve · Intelligent Support</span>
          <span>Built for better resolutions</span>
        </footer>
      </section>
    </main>
  );
}
