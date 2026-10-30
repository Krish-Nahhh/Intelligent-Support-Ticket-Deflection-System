
const stats = [
  { label: "Total Tickets", value: "248", change: "+12 this week" },
  { label: "Open Tickets", value: "42", change: "Needs attention" },
  { label: "Resolved Tickets", value: "186", change: "This month" },
  { label: "Deflected Tickets", value: "64", change: "Solutions found" },
];

const tickets = [
  {
    id: "TKT-0248",
    subject: "Unable to reset account password",
    category: "Account Access",
    priority: "High",
    status: "Open",
  },
  {
    id: "TKT-0247",
    subject: "Payment completed but order not updated",
    category: "Payments",
    priority: "Critical",
    status: "In Progress",
  },
  {
    id: "TKT-0246",
    subject: "How to update registered email address",
    category: "Account Access",
    priority: "Low",
    status: "Resolved",
  },
  {
    id: "TKT-0245",
    subject: "Application keeps logging me out",
    category: "Technical Issue",
    priority: "Medium",
    status: "Open",
  },
];

const navItems = [
  { label: "Overview", icon: "◫", active: true },
  { label: "All Tickets", icon: "▤", active: false },
  { label: "Solutions", icon: "✳", active: false },
  { label: "Analytics", icon: "▥", active: false },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="w-full shrink-0 bg-slate-950 p-5 text-white md:min-h-screen md:w-64">
        <div className="mb-10">
          <div className="text-xl font-bold tracking-tight">
            Resolve<span className="text-cyan-400">IT</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Intelligent Support System
          </p>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Workspace
        </p>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                item.active
                  ? "bg-cyan-500/15 font-semibold text-cyan-300"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold">Smart resolution</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Find relevant solutions from previously resolved tickets.
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-2/3 rounded-full bg-cyan-400" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Preview interface
          </p>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 font-semibold text-cyan-300">
              K
            </div>
            <div>
              <p className="text-sm font-medium">Project Workspace</p>
              <p className="text-xs text-slate-400">Development mode</p>
            </div>
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 p-5 md:p-8 lg:p-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Workspace / Overview</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Support Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Monitor tickets and resolution activity in one place.
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            + New Ticket
          </button>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">
                {stat.label}
              </p>
              <p className="mt-4 text-3xl font-bold tracking-tight">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{stat.change}</p>
            </article>
          ))}
        </div>

        <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Ticket activity</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Illustrative ticket distribution
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                Sample data
              </span>
            </div>

            <div className="mt-8 flex h-36 items-end justify-around gap-4 border-b border-slate-100 pb-3">
              {[
                { day: "Mon", height: "45%" },
                { day: "Tue", height: "70%" },
                { day: "Wed", height: "55%" },
                { day: "Thu", height: "90%" },
                { day: "Fri", height: "65%" },
                { day: "Sat", height: "35%" },
                { day: "Sun", height: "50%" },
              ].map((bar) => (
                <div
                  key={bar.day}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <div
                    className="w-full max-w-10 rounded-t-md bg-cyan-500"
                    style={{ height: bar.height }}
                  />
                  <span className="text-xs text-slate-500">{bar.day}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">Resolution overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sample monthly outcomes
            </p>

            <div className="mt-6 space-y-5">
              {[
                { label: "Resolved", value: 75, color: "bg-emerald-500" },
                { label: "Open", value: 17, color: "bg-amber-500" },
                { label: "Deflected", value: 26, color: "bg-cyan-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-semibold">{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${item.color}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="font-semibold">Recent tickets</h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest support requests
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-slate-700 hover:text-cyan-700"
            >
              View all →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Ticket</th>
                  <th className="px-5 py-4 font-semibold">Subject</th>
                  <th className="px-5 py-4 font-semibold">Category</th>
                  <th className="px-5 py-4 font-semibold">Priority</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {ticket.id}
                    </td>
                    <td className="px-5 py-4 text-slate-900">
                      {ticket.subject}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {ticket.category}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          ticket.status === "Resolved"
                            ? "bg-emerald-50 text-emerald-700"
                            : ticket.status === "In Progress"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Intelligent Support Ticket Deflection System · Development preview
        </p>
      </section>
    </main>
  );
}
