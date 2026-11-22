"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";

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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ProviderChoice = "auto" | "gemini" | "openai" | "offline";

const TASKS_KEY = "brainbox.tasks.v1";
const KNOWLEDGE_KEY = "brainbox.knowledge.v1";
const CHAT_KEY = "brainbox.assistant.conversation.v1";
const PROVIDER_KEY = "brainbox.assistant.provider.v1";

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "# Your BrainBox tutor\n\nAsk about a subject, paste a paragraph to break it down, request a study guide, or ask what to work on. I can use your saved Knowledge Vault items and tasks as context.",
};

const PROVIDERS: { value: ProviderChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "gemini", label: "Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "offline", label: "Offline" },
];

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "any",
  "are",
  "can",
  "could",
  "find",
  "for",
  "from",
  "help",
  "how",
  "into",
  "me",
  "more",
  "note",
  "notes",
  "please",
  "saved",
  "show",
  "some",
  "that",
  "the",
  "them",
  "this",
  "what",
  "when",
  "where",
  "with",
  "you",
  "your",
]);

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
    typeof value.createdAt === "string"
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

function isProviderChoice(value: unknown): value is ProviderChoice {
  return (
    value === "auto" ||
    value === "gemini" ||
    value === "openai" ||
    value === "offline"
  );
}

function parseSavedArray<T>(
  raw: string | null,
  validate: (value: unknown) => value is T,
): T[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(validate)) {
    throw new Error("Saved data has an invalid format.");
  }
  return parsed;
}

function searchTerms(prompt: string) {
  return prompt
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function noteSummary(content: string) {
  const sentences = content.trim().match(/[^.!?]+[.!?]?/g) ?? [];
  return sentences
    .slice(0, 2)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOfflineResponse(
  prompt: string,
  tasks: Task[],
  notes: KnowledgeItem[],
  history: ChatMessage[],
) {
  const normalized = prompt.toLocaleLowerCase();
  const previousUserMessage = [...history]
    .reverse()
    .find((message) => message.role === "user");
  const refersToPrevious =
    /\b(it|that|those|above|previous|more|another|continue|elaborate|example)\b/.test(
      normalized,
    );
  const searchPrompt =
    refersToPrevious && previousUserMessage
      ? `${prompt}\n${previousUserMessage.content}`
      : prompt;
  const asksForSummary =
    /\b(summar(y|ize)|overview|recap)\b/.test(normalized) &&
    /\b(note|knowledge|vault|saved)\b/.test(normalized);

  if (asksForSummary) {
    if (!notes.length) {
      return "## Knowledge Vault\n\nI couldn't find saved notes in this browser yet. Add items in the Knowledge Vault, then ask me to summarize them.";
    }

    return `## Knowledge Vault overview\n\nI found **${notes.length} ${
      notes.length === 1 ? "item" : "items"
    }**. Here are the key details from every saved item:\n\n${notes
      .map((note) => {
        const summary = noteSummary(note.content);
        return `### ${note.title}\n**Category:** ${note.category}  \n**Tags:** ${
          note.tags.join(", ") || "none"
        }  \n${summary || "No content has been added."}`;
      })
      .join("\n\n")}\n\n*Offline overview: these summaries use the opening sentences of your notes.*`;
  }

  if (/\b(study guide|practice questions|quiz|flashcards?)\b/.test(normalized)) {
    if (notes.length) {
      const guide = notes
        .map((note) => {
          const summary = noteSummary(note.content);
          return `- **${note.title}** (${note.category}; tags: ${
            note.tags.join(", ") || "none"
          }): ${summary || "Review the full note."}`;
        })
        .join("\n");
      const questions = notes
        .map(
          (note, index) =>
            `${index + 1}. What are the main ideas in **${note.title}**, and how do its tags connect to the content?`,
        )
        .join("\n");

      return `## Study guide from your Knowledge Vault\n\n${guide}\n\n## Practice questions\n\n${questions}\n\n*These prompts are generated locally from your note titles, tags, and opening sentences.*`;
    }
    return "## Offline study help\n\nI don't see saved notes to build a personalized guide from. Paste a passage here and I can break it into a main idea, key points, and review questions.";
  }

  if (
    /\b(task|tasks|todo|todos|organize|organise|priorit|plan|work on|due)\b/.test(
      normalized,
    )
  ) {
    const openTasks = tasks.filter((task) => task.status !== "Completed");
    const completedCount = tasks.length - openTasks.length;

    if (!openTasks.length) {
      return tasks.length
        ? `## Task check-in\n\nYou're all caught up — all **${completedCount}** saved ${
            completedCount === 1 ? "task is" : "tasks are"
          } completed.`
        : "## Task check-in\n\nI couldn't find saved tasks in this browser. Add tasks in My Tasks and I can help organize them.";
    }

    const priorityRank: Record<TaskPriority, number> = {
      High: 0,
      Medium: 1,
      Low: 2,
    };
    const orderedTasks = [...openTasks].sort((a, b) => {
      const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDifference) return priorityDifference;
      if (!a.dueDate) return b.dueDate ? 1 : 0;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    return `## Task plan\n\nYou have **${openTasks.length} open** and **${completedCount} completed** ${
      tasks.length === 1 ? "task" : "tasks"
    }. Start with high-priority work, then nearer due dates:\n\n${orderedTasks
      .map(
        (task, index) =>
          `${index + 1}. **${task.title}** — ${task.priority} priority, ${
            task.status
          }${task.dueDate ? `, due ${task.dueDate}` : ", no due date"}${
            task.description ? `\n   ${task.description}` : ""
          }`,
      )
      .join("\n")}\n\n*Plan based on the status, priority, due date, and description saved in My Tasks.*`;
  }

  const looksLikeParagraph =
    (prompt.trim().length > 120 &&
      /[.!?]/.test(prompt) &&
      !/\b(task|tasks|todo|todos)\b/.test(normalized)) ||
    (prompt.includes("\n") && prompt.trim().length > 80) ||
    (/\b(explain|break down|simplify|analy[sz]e)\b/.test(normalized) &&
      /[:\n]/.test(prompt));
  if (looksLikeParagraph) {
    const content = prompt
      .replace(
        /^\s*(explain|break down|simplify|analy[sz]e)\s+(this|the following)\s*(paragraph|passage|text)?\s*[:\n-]*/i,
        "",
      )
      .trim();
    const sentences = (content.match(/[^.!?]+[.!?]?/g) ?? [])
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (sentences.length) {
      const keyPoints = sentences
        .slice(1)
        .map((sentence, index) => `${index + 1}. ${sentence}`)
        .join("\n");
      return `## Paragraph breakdown\n\n**Main idea:** ${sentences[0]}\n\n${
        keyPoints
          ? `### Supporting points\n\n${keyPoints}\n\n`
          : ""
      }### Check your understanding\n\n1. What is the central claim or idea?\n2. Which detail best supports it?\n3. How would you explain the passage in your own words?\n\n*Offline breakdown based on the text you provided; it does not add outside facts.*`;
    }
  }

  const terms = searchTerms(searchPrompt);
  const matchesNotes = notes
    .map((note) => ({
      note,
      score: terms.filter((term) =>
        [note.title, note.content, note.category, ...note.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(term),
      ).length,
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
  const matchesTasks = tasks
    .map((task) => ({
      task,
      score: terms.filter((term) =>
        `${task.title} ${task.description} ${task.priority} ${task.status}`
          .toLocaleLowerCase()
          .includes(term),
      ).length,
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matchesNotes.length || matchesTasks.length) {
    const noteResults = matchesNotes.map(
      ({ note }) =>
        `### ${note.title}\n**Category:** ${note.category} · **Tags:** ${
          note.tags.join(", ") || "none"
        }\n\n${note.content || "No content has been added."}`,
    );
    const taskResults = matchesTasks.map(
      ({ task }) =>
        `- **${task.title}** — ${task.status}, ${task.priority} priority${
          task.dueDate ? `, due ${task.dueDate}` : ""
        }${task.description ? `\n  ${task.description}` : ""}`,
    );
    return `## Matches in your BrainBox\n\n${
      noteResults.length
        ? `### Knowledge Vault (${noteResults.length})\n\n${noteResults.join(
            "\n\n",
          )}\n\n`
        : ""
    }${
      taskResults.length
        ? `### My Tasks (${taskResults.length})\n\n${taskResults.join("\n")}`
        : ""
    }\n\n*All matches are based on words in your request and saved item titles, content, tags, categories, and task details.*`;
  }

  if (refersToPrevious && previousUserMessage) {
    return `## Follow-up in Offline mode\n\nI remember your previous question: “${previousUserMessage.content.slice(
      0,
      240,
    )}”. I couldn't find related saved notes or tasks for this follow-up. Offline mode can retrieve your saved data and break down pasted text, but it can't generate new factual explanations. Choose **Auto**, **Gemini**, or **OpenAI** for deeper tutoring.`;
  }

  return `## Offline assistant\n\nI checked all **${notes.length} ${
    notes.length === 1 ? "Knowledge Vault item" : "Knowledge Vault items"
  }** and **${tasks.length} ${
    tasks.length === 1 ? "task" : "tasks"
  }**, but didn't find a matching saved item.\n\nOffline mode can retrieve and break down text locally, but it doesn't have a general-purpose language model or web access. Choose **Auto**, **Gemini**, or **OpenAI** for deeper tutoring and original drafts.`;
}

function buildContext(tasks: Task[], notes: KnowledgeItem[]) {
  return JSON.stringify(
    {
      savedTasks: tasks.map(
        ({ title, description, priority, dueDate, status }) => ({
          title,
          description,
          priority,
          dueDate,
          status,
        }),
      ),
      knowledgeVault: notes.map(
        ({ title, content, category, tags, createdAt }) => ({
          title,
          content,
          category,
          tags,
          createdAt,
        }),
      ),
    },
    null,
    2,
  );
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-[0.9em] text-blue-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return (
        <strong key={index} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeStart = line.match(/^```([\w-]*)\s*$/);
    if (codeStart) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <div
          key={`code-${blocks.length}`}
          className="my-3 overflow-hidden rounded-xl border border-slate-700 bg-[#080e18]"
        >
          {codeStart[1] && (
            <p className="border-b border-slate-800 px-3 py-1.5 font-mono text-xs text-slate-500">
              {codeStart[1]}
            </p>
          )}
          <pre className="overflow-x-auto p-4 text-xs leading-5 text-slate-200 sm:text-sm">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const className =
        level === 1
          ? "text-xl font-bold text-white"
          : level === 2
            ? "text-lg font-semibold text-white"
            : "text-base font-semibold text-slate-100";
      blocks.push(
        <h3 key={`heading-${blocks.length}`} className={`${className} mt-3`}>
          {renderInline(heading[2])}
        </h3>,
      );
      index += 1;
      continue;
    }

    const listMatch = line.match(/^\s*([-*]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const entries: ReactNode[] = [];
      while (index < lines.length) {
        const entry = lines[index].match(/^\s*([-*]|\d+[.)])\s+(.+)$/);
        if (!entry || /^\d/.test(entry[1]) !== ordered) break;
        entries.push(
          <li key={`list-entry-${entries.length}`} className="pl-1">
            {renderInline(entry[2])}
          </li>,
        );
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List
          key={`list-${blocks.length}`}
          className={`my-2 space-y-1.5 pl-5 text-sm leading-6 ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {entries}
        </List>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^#{1,4}\s+/.test(lines[index]) &&
      !/^\s*([-*]|\d+[.)])\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p
        key={`paragraph-${blocks.length}`}
        className="my-1 whitespace-pre-wrap text-sm leading-6"
      >
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  return <div className="space-y-2 break-words">{blocks}</div>;
}

export default function AssistantChat() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<KnowledgeItem[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [conversationReady, setConversationReady] = useState(false);
  const [dataError, setDataError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [provider, setProvider] = useState<ProviderChoice>("auto");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      const errors: string[] = [];
      let savedTasks: Task[] = [];
      let savedNotes: KnowledgeItem[] = [];
      let savedMessages: ChatMessage[] = [INITIAL_MESSAGE];
      let savedProvider: ProviderChoice = "auto";

      try {
        savedTasks = parseSavedArray(
          window.localStorage.getItem(TASKS_KEY),
          isTask,
        );
      } catch {
        errors.push("Saved tasks could not be read.");
      }
      try {
        savedNotes = parseSavedArray(
          window.localStorage.getItem(KNOWLEDGE_KEY),
          isKnowledgeItem,
        );
      } catch {
        errors.push("Knowledge Vault items could not be read.");
      }
      try {
        const parsedMessages = parseSavedArray(
          window.localStorage.getItem(CHAT_KEY),
          isChatMessage,
        );
        if (parsedMessages.length) savedMessages = parsedMessages;
      } catch {
        errors.push("The saved conversation could not be read.");
      }

      try {
        const savedProviderValue = window.localStorage.getItem(PROVIDER_KEY);
        if (isProviderChoice(savedProviderValue)) {
          savedProvider = savedProviderValue;
        }
      } catch {
        errors.push("The provider preference could not be read; using Auto.");
      }

      if (!cancelled) {
        setTasks(savedTasks);
        setNotes(savedNotes);
        setMessages(savedMessages);
        setProvider(savedProvider);
        setDataError(errors.join(" "));
        setDataReady(true);
        setConversationReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!conversationReady) return;
    try {
      window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
      window.localStorage.setItem(PROVIDER_KEY, provider);
    } catch (error) {
      Promise.resolve().then(() =>
        setDataError((current) =>
          [
            current,
            error instanceof Error
              ? `Conversation could not be saved: ${error.message}`
              : "Conversation could not be saved to this browser.",
          ]
            .filter(Boolean)
            .join(" "),
        ),
      );
    }
  }, [conversationReady, messages, provider]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function appendAssistantMessage(content: string) {
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "assistant", content },
    ]);
  }

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text || sending || !dataReady) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    if (provider === "offline") {
      appendAssistantMessage(
        buildOfflineResponse(text, tasks, notes, messages),
      );
      setSending(false);
      return;
    }

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          messages: nextMessages
            .filter((message) => message.id !== "welcome")
            .map(({ role, content: messageContent }) => ({
              role,
              content: messageContent,
            })),
          context: buildContext(tasks, notes),
        }),
      });
      const result: unknown = await response.json();
      if (!isRecord(result)) {
        throw new Error("The assistant returned an invalid response.");
      }

      if (result.offlineFallback === true && provider === "auto") {
        appendAssistantMessage(
          `> No AI provider is configured, so I answered locally.\n\n${buildOfflineResponse(
            text,
            tasks,
            notes,
            messages,
          )}`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "The assistant request failed.",
        );
      }
      if (typeof result.answer !== "string") {
        throw new Error("The assistant returned no answer.");
      }
      appendAssistantMessage(result.answer);
    } catch (error) {
      if (provider === "auto") {
        appendAssistantMessage(
          `> The configured AI provider was unavailable, so I answered locally.\n\n${buildOfflineResponse(
            text,
            tasks,
            notes,
            messages,
          )}`,
        );
      } else {
        appendAssistantMessage(
          error instanceof Error
            ? `## Assistant error\n\n${error.message}`
            : "## Assistant error\n\nThe request failed. Please try again.",
        );
      }
    } finally {
      setSending(false);
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <>
      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">
            04 · YOUR PRODUCTIVITY PARTNER
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            AI Assistant
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            A personal tutor and second brain for your notes, tasks, and ideas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            <span className="mb-1.5 block">Response mode</span>
            <select
              value={provider}
              onChange={(event) => {
                const value = event.target.value;
                if (isProviderChoice(value)) setProvider(value);
              }}
              className="min-h-10 rounded-xl border border-slate-700 bg-[#111827] px-3 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              {PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={sending || !conversationReady}
            onClick={() => setMessages([INITIAL_MESSAGE])}
            className="min-h-10 rounded-xl border border-slate-700 px-3 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            New chat
          </button>
        </div>
      </header>

      {dataError && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
        >
          {dataError} Some saved context may be unavailable.
        </p>
      )}

      {provider !== "offline" && (
        <p className="mb-4 rounded-xl border border-blue-400/20 bg-blue-400/5 px-4 py-3 text-sm leading-6 text-blue-100/80">
          Auto uses an available server-configured provider, or falls back to
          Offline. Auto, Gemini, and OpenAI may send your full conversation and
          all saved task/note context to the configured provider. Configure{" "}
          <code>GEMINI_API_KEY</code> and/or <code>OPENAI_API_KEY</code> on the
          server. Set <code>AI_PROVIDER</code> to choose Auto&apos;s preference.
          Offline mode stays in this browser.
        </p>
      )}

      <section
        aria-label="AI Assistant chat"
        className="flex h-[calc(100vh-13rem)] min-h-[65vh] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1626]"
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#111827] px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-100">BrainBox assistant</h2>
            <p className="mt-1 text-xs text-slate-500">
              {dataReady
                ? `${tasks.length} tasks · ${notes.length} knowledge items loaded · conversation saved locally`
                : "Loading your local workspace..."}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-400" />
            {PROVIDERS.find((option) => option.value === provider)?.label}
          </span>
        </div>

        <div
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <article
                className={`max-w-[95%] rounded-2xl px-4 py-3 sm:max-w-[85%] ${
                  message.role === "user"
                    ? "rounded-br-md bg-blue-600 text-white"
                    : "rounded-bl-md border border-slate-800 bg-[#111827] text-slate-200"
                }`}
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-60">
                  {message.role === "user" ? "You" : "BrainBox"}
                </p>
                <MarkdownMessage content={message.content} />
              </article>
            </div>
          ))}
          {sending && (
            <p className="text-sm text-slate-500" role="status">
              {provider === "offline"
                ? "Reviewing your saved items..."
                : "Thinking..."}
            </p>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="border-t border-slate-800 bg-[#111827] p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              "Summarize my notes",
              "What should I work on?",
              "Make a study guide from my notes",
              "Break down this paragraph: ",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={!dataReady || sending}
                onClick={() => {
                  if (prompt.endsWith(": ")) {
                    setInput(prompt);
                    return;
                  }
                  void sendMessage(prompt);
                }}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-blue-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt.endsWith(": ") ? "Break down a paragraph" : prompt}
              </button>
            ))}
          </div>
          <form onSubmit={submitMessage} className="flex items-end gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message the assistant</span>
              <textarea
                rows={1}
                maxLength={12_000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ask a question, paste a paragraph, or describe a task..."
                disabled={!dataReady || sending}
                className="max-h-48 min-h-11 w-full resize-y rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={!dataReady || sending || !input.trim()}
              className="min-h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-600">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </section>
    </>
  );
}
