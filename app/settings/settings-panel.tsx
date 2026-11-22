"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type ProviderChoice = "auto" | "gemini" | "openai" | "offline";
type Profile = {
  displayName: string;
  roleGoal: string;
  email: string;
};
type Task = {
  id: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High";
  dueDate: string;
  status: "Pending" | "In Progress" | "Completed";
};
type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
};
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type BackupData = {
  tasks: Task[];
  knowledge: KnowledgeItem[];
  profile: Profile;
  provider: ProviderChoice;
  assistantConversation: ChatMessage[];
};
type BackupFile = {
  app: "BrainBox";
  schemaVersion: 1;
  exportedAt: string;
  data: BackupData;
};

const STORAGE_KEYS = {
  tasks: "brainbox.tasks.v1",
  knowledge: "brainbox.knowledge.v1",
  profile: "brainbox.settings.profile.v1",
  provider: "brainbox.assistant.provider.v1",
  conversation: "brainbox.assistant.conversation.v1",
};

const DEFAULT_PROFILE: Profile = {
  displayName: "",
  roleGoal: "",
  email: "",
};

const PROVIDERS: { value: ProviderChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "gemini", label: "Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "offline", label: "Offline" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProviderChoice(value: unknown): value is ProviderChoice {
  return (
    value === "auto" ||
    value === "gemini" ||
    value === "openai" ||
    value === "offline"
  );
}

function isProfile(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.displayName === "string" &&
    typeof value.roleGoal === "string" &&
    typeof value.email === "string"
  );
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

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"
  );
}

function parseArray<T>(
  value: unknown,
  validate: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(validate);
}

function parseBackup(value: unknown): BackupFile {
  if (
    !isRecord(value) ||
    value.app !== "BrainBox" ||
    value.schemaVersion !== 1 ||
    !isRecord(value.data)
  ) {
    throw new Error("This is not a supported BrainBox backup.");
  }

  const data = value.data;
  if (
    !parseArray(data.tasks, isTask) ||
    !parseArray(data.knowledge, isKnowledgeItem) ||
    !isProfile(data.profile) ||
    !isProviderChoice(data.provider) ||
    !parseArray(data.assistantConversation, isChatMessage)
  ) {
    throw new Error("The backup contains invalid or incomplete data.");
  }

  return {
    app: "BrainBox",
    schemaVersion: 1,
    exportedAt:
      typeof value.exportedAt === "string" ? value.exportedAt : "",
    data: {
      tasks: data.tasks,
      knowledge: data.knowledge,
      profile: data.profile,
      provider: data.provider,
      assistantConversation: data.assistantConversation,
    },
  };
}

function writeStorageEntries(entries: Array<[string, string | null]>) {
  const previous = entries.map(([key]) => [
    key,
    window.localStorage.getItem(key),
  ] as const);

  try {
    entries.forEach(([key, value]) => {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    });
  } catch (writeError) {
    let rollbackFailed = false;
    for (const [key, value] of previous.reverse()) {
      try {
        if (value === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, value);
        }
      } catch {
        rollbackFailed = true;
      }
    }

    if (rollbackFailed) {
      throw new Error(
        "The storage update failed, and some previous values could not be restored.",
      );
    }
    throw writeError;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function SettingsPanel() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [provider, setProvider] = useState<ProviderChoice>("auto");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [resetPromptOpen, setResetPromptOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      let loadedProfile = DEFAULT_PROFILE;
      let loadedProvider: ProviderChoice = "auto";
      let loadedTasks: Task[] = [];
      let loadedKnowledge: KnowledgeItem[] = [];
      let loadedConversation: ChatMessage[] = [];
      const errors: string[] = [];
      let canAccessStorage = true;

      try {
        const savedProfile = window.localStorage.getItem(STORAGE_KEYS.profile);
        if (savedProfile) {
          const parsed: unknown = JSON.parse(savedProfile);
          if (!isProfile(parsed)) {
            throw new Error("Saved profile has an invalid format.");
          }
          loadedProfile = parsed;
        }
      } catch (error) {
        canAccessStorage = false;
        errors.push(`Profile settings could not be loaded: ${errorMessage(error)}`);
      }

      try {
        const savedProvider = window.localStorage.getItem(STORAGE_KEYS.provider);
        if (savedProvider !== null) {
          if (!isProviderChoice(savedProvider)) {
            throw new Error("Saved provider preference is invalid.");
          }
          loadedProvider = savedProvider;
        }
      } catch (error) {
        canAccessStorage = false;
        errors.push(`AI preference could not be loaded: ${errorMessage(error)}`);
      }

      try {
        const savedTasks = window.localStorage.getItem(STORAGE_KEYS.tasks);
        const parsed: unknown = savedTasks ? JSON.parse(savedTasks) : [];
        if (!parseArray(parsed, isTask)) {
          throw new Error("Saved tasks have an invalid format.");
        }
        loadedTasks = parsed;
      } catch (error) {
        canAccessStorage = false;
        errors.push(`Tasks could not be loaded: ${errorMessage(error)}`);
      }

      try {
        const savedKnowledge = window.localStorage.getItem(STORAGE_KEYS.knowledge);
        const parsed: unknown = savedKnowledge ? JSON.parse(savedKnowledge) : [];
        if (!parseArray(parsed, isKnowledgeItem)) {
          throw new Error("Saved Knowledge Vault data has an invalid format.");
        }
        loadedKnowledge = parsed;
      } catch (error) {
        canAccessStorage = false;
        errors.push(
          `Knowledge Vault items could not be loaded: ${errorMessage(error)}`,
        );
      }

      try {
        const savedConversation = window.localStorage.getItem(
          STORAGE_KEYS.conversation,
        );
        const parsed: unknown = savedConversation
          ? JSON.parse(savedConversation)
          : [];
        if (!parseArray(parsed, isChatMessage)) {
          throw new Error("Saved assistant conversation is invalid.");
        }
        loadedConversation = parsed;
      } catch (error) {
        canAccessStorage = false;
        errors.push(`Assistant conversation could not be loaded: ${errorMessage(error)}`);
      }

      if (!cancelled) {
        setProfile(loadedProfile);
        setProvider(loadedProvider);
        setTasks(loadedTasks);
        setKnowledge(loadedKnowledge);
        setConversation(loadedConversation);
        setStorageAvailable(canAccessStorage);
        setNotice(errors.join(" "));
        setNoticeIsError(errors.length > 0);
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function showNotice(message: string, isError = false) {
    setNotice(message);
    setNoticeIsError(isError);
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updatedProfile = {
      displayName: profile.displayName.trim(),
      roleGoal: profile.roleGoal.trim(),
      email: profile.email.trim(),
    };

    try {
      writeStorageEntries([
        [STORAGE_KEYS.profile, JSON.stringify(updatedProfile)],
        [STORAGE_KEYS.provider, provider],
      ]);
      setProfile(updatedProfile);
      showNotice("Your profile and assistant preferences are saved.");
    } catch (error) {
      showNotice(`Settings could not be saved: ${errorMessage(error)}`, true);
    }
  }

  function exportBackup() {
    const backup: BackupFile = {
      app: "BrainBox",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        tasks,
        knowledge,
        profile,
        provider,
        assistantConversation: conversation,
      },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `brainbox-backup-${backup.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    showNotice("Your BrainBox backup has been exported.");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Backup files must be 10 MB or smaller.");
      }
      const parsed: unknown = JSON.parse(await file.text());
      const backup = parseBackup(parsed);
      const { data } = backup;
      writeStorageEntries([
        [STORAGE_KEYS.tasks, JSON.stringify(data.tasks)],
        [STORAGE_KEYS.knowledge, JSON.stringify(data.knowledge)],
        [STORAGE_KEYS.profile, JSON.stringify(data.profile)],
        [STORAGE_KEYS.provider, data.provider],
        [
          STORAGE_KEYS.conversation,
          JSON.stringify(data.assistantConversation),
        ],
      ]);
      setTasks(data.tasks);
      setKnowledge(data.knowledge);
      setProfile(data.profile);
      setProvider(data.provider);
      setConversation(data.assistantConversation);
      setStorageAvailable(true);
      showNotice(
        `Backup imported: ${data.tasks.length} tasks and ${data.knowledge.length} knowledge items restored.`,
      );
    } catch (error) {
      showNotice(`Backup could not be imported: ${errorMessage(error)}`, true);
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function resetWorkspace() {
    setResetting(true);
    try {
      writeStorageEntries([
        [STORAGE_KEYS.tasks, JSON.stringify([])],
        [STORAGE_KEYS.knowledge, JSON.stringify([])],
        [STORAGE_KEYS.profile, JSON.stringify(DEFAULT_PROFILE)],
        [STORAGE_KEYS.provider, "auto"],
        [STORAGE_KEYS.conversation, JSON.stringify([])],
      ]);
      setTasks([]);
      setKnowledge([]);
      setProfile(DEFAULT_PROFILE);
      setProvider("auto");
      setConversation([]);
      setStorageAvailable(true);
      setResetPromptOpen(false);
      showNotice("Local workspace data has been reset.");
    } catch (error) {
      showNotice(`Workspace could not be reset: ${errorMessage(error)}`, true);
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">
          06 · WORKSPACE PREFERENCES
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Personalize BrainBox and manage your local workspace data.
        </p>
      </header>

      {notice && (
        <p
          role={noticeIsError ? "alert" : "status"}
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            noticeIsError
              ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {notice}
        </p>
      )}

      <form onSubmit={saveSettings} className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-wide text-blue-400">
              PROFILE
            </p>
            <h2 className="mt-1 text-xl font-semibold">User profile</h2>
            <p className="mt-1 text-sm text-slate-400">
              Keep your personal details on this browser.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">
                Display name
              </span>
              <input
                type="text"
                maxLength={80}
                value={profile.displayName}
                onChange={(event) =>
                  setProfile({ ...profile, displayName: event.target.value })
                }
                placeholder="How should BrainBox address you?"
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">
                Email
              </span>
              <input
                type="email"
                maxLength={254}
                value={profile.email}
                onChange={(event) =>
                  setProfile({ ...profile, email: event.target.value })
                }
                placeholder="you@example.com"
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">
                Role or student goal
              </span>
              <input
                type="text"
                maxLength={160}
                value={profile.roleGoal}
                onChange={(event) =>
                  setProfile({ ...profile, roleGoal: event.target.value })
                }
                placeholder="e.g. Student preparing for exams, Product designer"
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-wide text-violet-300">
              ASSISTANT
            </p>
            <h2 className="mt-1 text-xl font-semibold">AI preferences</h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose the default response mode used by the AI Assistant.
            </p>
          </div>

          <label className="block max-w-sm">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">
              Default provider
            </span>
            <select
              value={provider}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "auto" ||
                  value === "gemini" ||
                  value === "openai" ||
                  value === "offline"
                ) {
                  setProvider(value);
                }
              }}
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 rounded-xl border border-slate-800 bg-[#0b1120] p-4">
            <h3 className="text-sm font-semibold text-slate-200">
              Add a provider key
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Add keys to the project root&apos;s <code>.env.local</code>. Keep
              them server-side—never prefix them with{" "}
              <code>NEXT_PUBLIC_</code> or commit them to source control.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-[#080e18] p-3 text-xs leading-5 text-blue-200">
              <code>{`# Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key

# Or replace the two lines above with:
# AI_PROVIDER=openai
# OPENAI_API_KEY=your-openai-api-key`}</code>
            </pre>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Restart the development server after editing .env.local. Auto
              falls back to another configured provider or Offline. Cloud
              providers receive your chat and saved context; Offline stays in
              this browser.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-wide text-amber-300">
              WORKSPACE
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Workspace &amp; data management
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Export or restore your local BrainBox workspace.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#0e1626] p-4">
              <h3 className="font-medium text-slate-200">Export backup</h3>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
                Download tasks, notes, profile, assistant preferences, and chat.
              </p>
              <button
                type="button"
                disabled={!loaded}
                onClick={exportBackup}
                className="mt-4 min-h-10 w-full rounded-lg border border-blue-400/30 px-3 text-sm font-medium text-blue-200 transition hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export JSON
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0e1626] p-4">
              <h3 className="font-medium text-slate-200">Import backup</h3>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
                Restore a BrainBox JSON backup. Current local data is replaced.
              </p>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => void importBackup(event)}
                disabled={!loaded}
                aria-label="Choose a BrainBox JSON backup"
                className="mt-4 block w-full cursor-pointer text-xs text-slate-400 file:mr-3 file:min-h-9 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-600 disabled:opacity-50"
              />
            </div>

            <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.03] p-4">
              <h3 className="font-medium text-rose-200">Reset demo data</h3>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
                Clear local tasks, notes, profile settings, and assistant chat.
              </p>
              <button
                type="button"
                disabled={!loaded}
                onClick={() => setResetPromptOpen(true)}
                className="mt-4 min-h-10 w-full rounded-lg border border-rose-400/30 px-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset workspace
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            API keys in .env.local are server configuration and are never
            exported or changed by workspace tools.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-7">
          <div className="mb-5">
            <p className="text-xs font-semibold tracking-wide text-emerald-300">
              STORAGE
            </p>
            <h2 className="mt-1 text-xl font-semibold">Storage status</h2>
            <p className="mt-1 text-sm text-slate-400">
              BrainBox storage roadmap and current workspace location.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-emerald-300">
                    STAGE 1
                  </p>
                  <h3 className="mt-1 font-semibold text-slate-100">
                    Local Browser Storage
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    storageAvailable
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-rose-400/10 text-rose-300"
                  }`}
                >
                  {loaded
                    ? storageAvailable
                      ? "Active"
                      : "Needs attention"
                    : "Checking"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-400">
                Tasks, notes, profile, and assistant preferences are stored in
                this browser on this device.
              </p>
            </article>

            <article className="rounded-xl border border-blue-400/20 bg-blue-400/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-blue-300">
                    STAGE 2
                  </p>
                  <h3 className="mt-1 font-semibold text-slate-100">
                    Supabase Cloud Sync
                  </h3>
                </div>
                <span className="rounded-full bg-blue-400/10 px-2.5 py-1 text-xs font-medium text-blue-200">
                  Ready to connect
                </span>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-400">
                Cloud sync is the next stage. Your workspace currently remains
                local; no Supabase connection is active.
              </p>
            </article>
          </div>
        </section>
      </form>

      {resetPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-description"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#111827] p-6 shadow-2xl"
          >
            <p className="text-xs font-semibold tracking-wide text-rose-300">
              CONFIRM RESET
            </p>
            <h2 id="reset-dialog-title" className="mt-2 text-xl font-semibold">
              Reset local workspace?
            </h2>
            <p
              id="reset-dialog-description"
              className="mt-3 text-sm leading-6 text-slate-400"
            >
              This permanently clears all tasks, Knowledge Vault items, profile
              settings, provider preference, and saved assistant conversation
              from this browser. Export a backup first if you may need this
              data. Server-side API keys are not affected.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setResetPromptOpen(false)}
                className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={resetWorkspace}
                className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {resetting ? "Resetting..." : "Yes, reset data"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default SettingsPanel;
