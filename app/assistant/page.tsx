import Link from "next/link";
import AssistantChat from "./assistant-chat";

export default function AssistantPage() {
  return (
    <div className="min-h-screen bg-[#0b1120] text-white md:flex">
      <aside className="w-full border-b border-slate-800 bg-[#111827] p-6 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <Link href="/" className="text-2xl font-bold text-blue-400">
          BrainBox
        </Link>
        <p className="mt-2 text-sm text-slate-500">Intelligent Workspace</p>

        <nav aria-label="Main navigation" className="mt-10 space-y-3">
          <Link
            href="/"
            className="block rounded-xl p-3 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            Dashboard
          </Link>
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
            aria-current="page"
            className="block rounded-xl bg-blue-600/20 p-3 text-blue-400"
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

      <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
        <AssistantChat />
      </main>
    </div>
  );
}
