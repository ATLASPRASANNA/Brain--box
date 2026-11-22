"use client";

import { FormEvent, useEffect, useState } from "react";

const TASK_STATUS = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
} as const;

type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
type TaskPriority = "Low" | "Medium" | "High";

type Task = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
};

type TaskDraft = Omit<Task, "id">;

const STORAGE_KEY = "brainbox.tasks.v1";
const STATUSES: TaskStatus[] = [
  TASK_STATUS.PENDING,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.COMPLETED,
];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

const EMPTY_DRAFT: TaskDraft = {
  title: "",
  description: "",
  priority: "Medium",
  dueDate: "",
  status: TASK_STATUS.PENDING,
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  [TASK_STATUS.PENDING]: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  [TASK_STATUS.IN_PROGRESS]: "border-blue-400/20 bg-blue-400/10 text-blue-300",
  [TASK_STATUS.COMPLETED]: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Low: "text-slate-400",
  Medium: "text-violet-300",
  High: "text-rose-300",
};

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Record<string, unknown>;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.description === "string" &&
    PRIORITIES.includes(task.priority as TaskPriority) &&
    typeof task.dueDate === "string" &&
    (task.dueDate === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) &&
        Number.isFinite(new Date(`${task.dueDate}T00:00:00`).getTime()))) &&
    STATUSES.includes(task.status as TaskStatus)
  );
}

function formatDueDate(date: string) {
  if (!date) return "No due date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      try {
        const savedTasks = window.localStorage.getItem(STORAGE_KEY);
        if (savedTasks) {
          const parsed: unknown = JSON.parse(savedTasks);
          if (!Array.isArray(parsed) || !parsed.every(isTask)) {
            throw new Error("Saved tasks have an invalid format.");
          }
          if (!cancelled) setTasks(parsed);
        }
        if (!cancelled) setStorageReady(true);
      } catch (error) {
        if (!cancelled) {
          setStorageError(
            error instanceof Error
              ? `Tasks could not be loaded: ${error.message}`
              : "Tasks could not be loaded from this browser.",
          );
          setStorageReady(true);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady || storageError) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      Promise.resolve().then(() =>
        setStorageError(
          error instanceof Error
            ? `Tasks could not be saved: ${error.message}`
            : "Tasks could not be saved to this browser.",
        ),
      );
    }
  }, [storageReady, storageError, tasks]);

  function openNewTask() {
    setEditingTask(null);
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setDraft({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      status: task.status,
    });
    setModalOpen(true);
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task: Task = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      id: editingTask?.id ?? crypto.randomUUID(),
    };

    setTasks((currentTasks) =>
      editingTask
        ? currentTasks.map((item) => (item.id === task.id ? task : item))
        : [task, ...currentTasks],
    );
    setModalOpen(false);
  }

  function changeStatus(task: Task, status: TaskStatus) {
    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === task.id ? { ...item, status } : item,
      ),
    );
  }

  function deleteTask(id: string) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
  }

  const inProgressCount = tasks.filter(
    (task) => task.status === TASK_STATUS.IN_PROGRESS,
  ).length;
  const completedCount = tasks.filter(
    (task) => task.status === TASK_STATUS.COMPLETED,
  ).length;

  return (
    <>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">
            YOUR WORKSPACE
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            My Tasks
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Keep your priorities clear and make progress every day.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewTask}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Add task
        </button>
      </header>

      {storageError && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
        >
          {storageError} Changes in this session may not persist.
        </p>
      )}

      <section
        aria-label="Task overview"
        className="mb-8 grid gap-4 sm:grid-cols-3"
      >
        {[
          { label: "Total tasks", count: tasks.length, color: "text-white" },
          {
            label: "In progress",
            count: inProgressCount,
            color: "text-blue-300",
          },
          {
            label: "Completed",
            count: completedCount,
            color: "text-emerald-300",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-800 bg-[#111827] p-5"
          >
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className={`mt-2 text-3xl font-semibold ${item.color}`}>
              {item.count}
            </p>
          </div>
        ))}
      </section>

      <section
        aria-label="Tasks by status"
        className="grid items-start gap-5 lg:grid-cols-3"
      >
        {STATUSES.map((status) => {
          const statusTasks = tasks.filter((task) => task.status === status);

          return (
            <div
              key={status}
              className="min-h-64 rounded-2xl border border-slate-800 bg-[#0e1626] p-4 sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">{status}</h2>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                  {statusTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {statusTasks.map((task) => (
                  <article
                    key={task.id}
                    className="rounded-xl border border-slate-800 bg-[#111827] p-4 transition hover:border-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={task.status === TASK_STATUS.COMPLETED}
                        onChange={(event) =>
                          changeStatus(
                            task,
                            event.target.checked
                              ? TASK_STATUS.COMPLETED
                              : TASK_STATUS.PENDING,
                          )
                        }
                        aria-label={`Mark ${task.title} as ${
                          task.status === TASK_STATUS.COMPLETED
                            ? "incomplete"
                            : "complete"
                        }`}
                        className="mt-1 size-4 shrink-0 accent-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <h3
                          className={`break-words font-medium ${
                            task.status === TASK_STATUS.COMPLETED
                              ? "text-slate-500 line-through"
                              : "text-slate-100"
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5 text-slate-400">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_STYLES[task.status]}`}
                      >
                        {task.status}
                      </span>
                      <span
                        className={`rounded-full bg-slate-800/80 px-2.5 py-1 text-xs ${PRIORITY_STYLES[task.priority]}`}
                      >
                        {task.priority} priority
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-slate-500">
                        Due {formatDueDate(task.dueDate)}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="sr-only" htmlFor={`status-${task.id}`}>
                          Status for {task.title}
                        </label>
                        <select
                          id={`status-${task.id}`}
                          value={task.status}
                          onChange={(event) =>
                            changeStatus(task, event.target.value as TaskStatus)
                          }
                          className="min-h-9 min-w-32 rounded-lg border border-slate-700 bg-[#0b1120] px-2 text-xs text-slate-300 focus-visible:outline-2 focus-visible:outline-blue-400"
                        >
                          {STATUSES.map((option) => (
                            <option key={option} value={option}>
                              Move to {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openEditTask(task)}
                          aria-label={`Edit ${task.title}`}
                          className="text-xs font-medium text-slate-400 transition hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          aria-label={`Delete ${task.title}`}
                          className="text-xs font-medium text-rose-300 transition hover:text-rose-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                {statusTasks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
                    {status === TASK_STATUS.PENDING
                      ? "Nothing waiting. Add a task to get started."
                      : `Tasks moved to ${status.toLowerCase()} will appear here.`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-dialog-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-slate-700 bg-[#111827] p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="task-dialog-title" className="text-xl font-semibold">
                  {editingTask ? "Edit task" : "Create a task"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Add the details you need to stay on track.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
                className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveTask} className="space-y-4">
              <div>
                <label
                  htmlFor="task-title"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Title
                </label>
                <input
                  id="task-title"
                  autoFocus
                  required
                  maxLength={120}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  placeholder="What needs to get done?"
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="task-description"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Description <span className="font-normal text-slate-500">· optional</span>
                </label>
                <textarea
                  id="task-description"
                  rows={3}
                  maxLength={1000}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  placeholder="Add a few helpful details..."
                  className="w-full resize-y rounded-xl border border-slate-700 bg-[#0b1120] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="task-priority"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        priority: event.target.value as TaskPriority,
                      })
                    }
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="task-due-date"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Due date
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) =>
                      setDraft({ ...draft, dueDate: event.target.value })
                    }
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="task-status"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Status
                </label>
                <select
                  id="task-status"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      status: event.target.value as TaskStatus,
                    })
                  }
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  {editingTask ? "Save changes" : "Create task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export default TaskBoard;
