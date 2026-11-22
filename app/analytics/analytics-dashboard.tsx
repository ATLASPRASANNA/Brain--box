"use client";

import { useEffect, useMemo, useState } from "react";

type TaskStatus = "Pending" | "In Progress" | "Completed";
type TaskPriority = "Low" | "Medium" | "High";

type Task = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
};

type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
};

type WeekActivity = {
  label: string;
  start: Date;
  notesAdded: number;
  tasksDue: number;
};

const TASKS_KEY = "brainbox.tasks.v1";
const KNOWLEDGE_KEY = "brainbox.knowledge.v1";
const STATUS_ORDER: TaskStatus[] = ["Pending", "In Progress", "Completed"];
const STATUS_COLORS: Record<TaskStatus, string> = {
  Pending: "bg-amber-400",
  "In Progress": "bg-blue-400",
  Completed: "bg-emerald-400",
};
const PRIORITY_ORDER: TaskPriority[] = ["High", "Medium", "Low"];
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  High: "bg-rose-400",
  Medium: "bg-violet-400",
  Low: "bg-slate-500",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    (value.priority === "Low" ||
      value.priority === "Medium" ||
      value.priority === "High") &&
    typeof value.dueDate === "string" &&
    (value.status === "Pending" ||
      value.status === "In Progress" ||
      value.status === "Completed")
  );
}

function isKnowledgeItem(value: unknown): value is KnowledgeItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.category === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.createdAt === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.createdAt) &&
    Number.isFinite(new Date(`${value.createdAt}T00:00:00`).getTime())
  );
}

function parseArray<T>(
  raw: string | null,
  validate: (value: unknown) => value is T,
) {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(validate)) {
    throw new Error("Saved data has an invalid format.");
  }
  return parsed;
}

function localDayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

function getWeeklyActivity(
  tasks: Task[],
  knowledge: KnowledgeItem[],
  today: Date,
): WeekActivity[] {
  const currentMonday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
  const firstMonday = new Date(currentMonday);
  firstMonday.setDate(firstMonday.getDate() - 7 * 7);

  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(firstMonday);
    start.setDate(firstMonday.getDate() + index * 7);
    return {
      label: new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
      }).format(start),
      start,
      notesAdded: 0,
      tasksDue: 0,
    };
  });
  const firstDayNumber = localDayNumber(firstMonday);

  function addToWeek(dateValue: string, key: "notesAdded" | "tasksDue") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return;
    const date = new Date(`${dateValue}T00:00:00`);
    if (!Number.isFinite(date.getTime())) return;
    const weekIndex = Math.floor((localDayNumber(date) - firstDayNumber) / 7);
    if (weekIndex >= 0 && weekIndex < weeks.length) {
      weeks[weekIndex][key] += 1;
    }
  }

  knowledge.forEach((item) => addToWeek(item.createdAt, "notesAdded"));
  tasks.forEach((task) => {
    if (task.dueDate) addToWeek(task.dueDate, "tasksDue");
  });

  return weeks;
}

function WeeklyActivityChart({ weeks }: { weeks: WeekActivity[] }) {
  const maxValue = Math.max(
    1,
    ...weeks.map((week) => Math.max(week.notesAdded, week.tasksDue)),
  );
  const axisMax = Math.max(2, Math.ceil(maxValue / 2) * 2);
  const baseline = 194;
  const plotHeight = 150;
  const yFor = (value: number) => baseline - (value / axisMax) * plotHeight;
  const ticks = [...new Set([axisMax, Math.round(axisMax / 2), 0])];

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 760 242"
          role="img"
          aria-label="Weekly knowledge items added and tasks due for the last eight weeks"
          className="h-56 min-w-[640px] w-full"
        >
          <title>Weekly knowledge items added and tasks due</title>
          {ticks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line
                  x1="48"
                  x2="744"
                  y1={y}
                  y2={y}
                  stroke="#263244"
                  strokeDasharray={tick === 0 ? undefined : "3 5"}
                />
                <text
                  x="36"
                  y={y + 4}
                  fill="#64748b"
                  fontSize="11"
                  textAnchor="end"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {weeks.map((week, index) => {
            const groupX = 61 + index * 85;
            const noteHeight = (week.notesAdded / axisMax) * plotHeight;
            const taskHeight = (week.tasksDue / axisMax) * plotHeight;
            return (
              <g key={week.label}>
                <rect
                  x={groupX}
                  y={baseline - noteHeight}
                  width="19"
                  height={noteHeight}
                  rx="4"
                  fill="#60a5fa"
                >
                  <title>{`${week.notesAdded} knowledge items added`}</title>
                </rect>
                <rect
                  x={groupX + 23}
                  y={baseline - taskHeight}
                  width="19"
                  height={taskHeight}
                  rx="4"
                  fill="#a78bfa"
                >
                  <title>{`${week.tasksDue} tasks due`}</title>
                </rect>
                <text
                  x={groupX + 21}
                  y="220"
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {week.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="sr-only">
        {weeks.map((week) => (
          <li key={`activity-${week.label}`}>
            Week of {week.label}: {week.notesAdded} knowledge items added,{" "}
            {week.tasksDue} tasks due.
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-5 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-blue-400" />
          Knowledge items added
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-violet-400" />
          Tasks due
        </span>
      </div>
    </div>
  );
}

function AnalyticsDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [weeks, setWeeks] = useState<WeekActivity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      const errors: string[] = [];
      let savedTasks: Task[] = [];
      let savedKnowledge: KnowledgeItem[] = [];

      try {
        savedTasks = parseArray(
          window.localStorage.getItem(TASKS_KEY),
          isTask,
        );
      } catch {
        errors.push("Saved tasks could not be read.");
      }

      try {
        savedKnowledge = parseArray(
          window.localStorage.getItem(KNOWLEDGE_KEY),
          isKnowledgeItem,
        );
      } catch {
        errors.push("Knowledge Vault items could not be read.");
      }

      if (!cancelled) {
        setTasks(savedTasks);
        setKnowledge(savedKnowledge);
        setWeeks(getWeeklyActivity(savedTasks, savedKnowledge, new Date()));
        setError(errors.join(" "));
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const completedTasks = tasks.filter(
    (task) => task.status === "Completed",
  ).length;
  const completionRate = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;
  const priorityCounts = PRIORITY_ORDER.map((priority) => ({
    priority,
    count: tasks.filter((task) => task.priority === priority).length,
  }));
  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }));
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    knowledge.forEach((item) => {
      const category = item.category.trim() || "Uncategorized";
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  }, [knowledge]);

  return (
    <>
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">
          05 · YOUR WORKSPACE
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Productivity &amp; Analytics
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          A clear snapshot of your tasks, priorities, and growing knowledge base.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
        >
          {error} Some analytics may be incomplete.
        </p>
      )}

      <section
        aria-label="Productivity overview"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
          <p className="text-sm text-slate-400">Total tasks</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {loaded ? tasks.length : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Across all statuses</p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
          <p className="text-sm text-slate-400">Completed</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">
            {loaded ? completedTasks : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tasks marked complete</p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
          <p className="text-sm text-slate-400">Completion rate</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-semibold text-blue-300">
              {loaded ? `${completionRate}%` : "—"}
            </p>
            <p className="pb-1 text-xs text-slate-500">of all tasks</p>
          </div>
          <div
            role="progressbar"
            aria-label="Task completion rate"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionRate}
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-blue-400 transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
          <p className="text-sm text-slate-400">Knowledge items</p>
          <p className="mt-3 text-3xl font-semibold text-violet-300">
            {loaded ? knowledge.length : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {loaded ? `${categoryCounts.length} categories` : "From your vault"}
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Weekly activity</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Knowledge items added and tasks due by week, over the last eight
              weeks. Task records do not include creation or completion dates.
            </p>
          </div>
          {loaded ? (
            <WeeklyActivityChart weeks={weeks} />
          ) : (
            <div className="h-56 animate-pulse rounded-xl bg-slate-800/50" />
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Task progress</h2>
            <p className="mt-1 text-sm text-slate-500">
              Current distribution across your task statuses.
            </p>
          </div>
          <div
            aria-label={statusCounts
              .map(({ status, count }) => `${status}: ${count}`)
              .join(", ")}
            className="flex h-3 overflow-hidden rounded-full bg-slate-800"
          >
            {statusCounts.map(({ status, count }) => (
              <div
                key={status}
                className={`${STATUS_COLORS[status]} transition-all`}
                style={{
                  width: tasks.length
                    ? `${(count / tasks.length) * 100}%`
                    : "0%",
                }}
              />
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {statusCounts.map(({ status, count }) => (
              <div
                key={status}
                className="rounded-xl border border-slate-800 bg-[#0e1626] p-4"
              >
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <span className={`size-2 rounded-full ${STATUS_COLORS[status]}`} />
                  {status}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-100">
                  {loaded ? count : "—"}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Priority breakdown</h2>
            <p className="mt-1 text-sm text-slate-500">
              See how your task load is distributed by priority.
            </p>
          </div>
          <div className="space-y-5">
            {priorityCounts.map(({ priority, count }) => (
              <div key={priority}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span
                      className={`size-2.5 rounded-sm ${PRIORITY_COLORS[priority]}`}
                    />
                    {priority}
                  </span>
                  <span className="text-slate-400">
                    {loaded ? count : "—"}
                    {loaded && tasks.length
                      ? ` · ${Math.round((count / tasks.length) * 100)}%`
                      : ""}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${PRIORITY_COLORS[priority]} transition-all`}
                    style={{
                      width: `${
                        tasks.length ? (count / tasks.length) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Knowledge categories</h2>
            <p className="mt-1 text-sm text-slate-500">
              Distribution of items saved in your Knowledge Vault.
            </p>
          </div>
          {loaded && categoryCounts.length ? (
            <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
              {categoryCounts.map(({ category, count }) => (
                <div key={category}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-slate-300">{category}</span>
                    <span className="shrink-0 text-slate-400">
                      {count} · {Math.round((count / knowledge.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{
                        width: `${(count / knowledge.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
              {loaded
                ? "Save a Knowledge Vault item to see category distribution."
                : "Loading knowledge categories..."}
            </p>
          )}
        </article>
      </section>

      {!loaded && (
        <p className="sr-only" role="status">
          Loading analytics from local storage.
        </p>
      )}
    </>
  );
}

export default AnalyticsDashboard;
