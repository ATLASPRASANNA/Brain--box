import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b1120] text-white md:flex">

      {/* Sidebar */}
      <aside className="w-full border-b border-slate-800 bg-[#111827] p-6 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <h1 className="text-2xl font-bold text-blue-400">
          BrainBox
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Intelligent Workspace
        </p>

        <nav className="mt-10 space-y-3">
          <div className="rounded-xl bg-blue-600/20 p-3 text-blue-400">
            Dashboard
          </div>

          <Link
            href="/tasks"
            className="block rounded-xl p-3 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            My Tasks
          </Link>

          <Link
            href="/knowledge"
            className="block rounded-xl p-3 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            Knowledge Vault
          </Link>

          <Link
            href="/assistant"
            className="block rounded-xl p-3 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            AI Assistant
          </Link>

          <Link
            href="/analytics"
            className="block rounded-xl p-3 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            Productivity &amp; Analytics
          </Link>

          <Link
            href="/settings"
            className="block rounded-xl p-3 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main Dashboard */}
      <main className="flex-1 p-6 md:p-10">

        <header className="mb-10">
          <p className="text-sm text-slate-400">
            YOUR WORKSPACE
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Welcome to BrainBox
          </h2>

          <p className="mt-2 text-slate-400">
            Organize your work. Capture your ideas. Think smarter.
          </p>
        </header>

        {/* Overview Cards */}
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Tasks</p>
            <h3 className="mt-3 text-3xl font-bold">0</h3>
            <p className="mt-2 text-sm text-slate-500">
              Tasks to organize
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Knowledge</p>
            <h3 className="mt-3 text-3xl font-bold">0</h3>
            <p className="mt-2 text-sm text-slate-500">
              Notes saved
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Productivity</p>
            <h3 className="mt-3 text-3xl font-bold">Ready</h3>
            <p className="mt-2 text-sm text-slate-500">
              Your workspace is ready
            </p>
          </div>

        </section>

        {/* Quick Actions */}
        <section className="mt-10">
          <h3 className="text-xl font-semibold">
            Quick Actions
          </h3>

          <div className="mt-5 grid gap-5 md:grid-cols-3">

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h4 className="font-semibold">Create a Task</h4>
              <p className="mt-2 text-sm text-slate-400">
                Plan your next activity.
              </p>
            </div>

            <Link
              href="/knowledge"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/50"
            >
              <h4 className="font-semibold">Save Knowledge</h4>
              <p className="mt-2 text-sm text-slate-400">
                Capture ideas and useful information.
              </p>
            </Link>

            <Link
              href="/assistant"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/50"
            >
              <h4 className="font-semibold">Ask AI</h4>
              <p className="mt-2 text-sm text-slate-400">
                Explore ideas and solve problems.
              </p>
            </Link>

          </div>
        </section>

        {/* Activity */}
        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-xl font-semibold">Recent Activity</h3>

          <p className="mt-4 text-sm text-slate-500">
            Your activities will appear here as you start using BrainBox.
          </p>
        </section>

      </main>
    </div>
  );
}