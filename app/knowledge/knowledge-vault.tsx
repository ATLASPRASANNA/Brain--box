"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
};

type KnowledgeDraft = Omit<KnowledgeItem, "id"> & {
  tagsText: string;
};

const STORAGE_KEY = "brainbox.knowledge.v1";
const ALL_CATEGORIES = "All categories";
const EMPTY_DRAFT: KnowledgeDraft = {
  title: "",
  content: "",
  category: "",
  tags: [],
  tagsText: "",
  createdAt: "",
};

function todayAsDateInput() {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 10);
}

function isValidDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(`${value}T00:00:00`).getTime())
  );
}

function isKnowledgeItem(value: unknown): value is KnowledgeItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string" &&
    typeof item.category === "string" &&
    Array.isArray(item.tags) &&
    item.tags.every((tag) => typeof tag === "string") &&
    typeof item.createdAt === "string" &&
    isValidDate(item.createdAt)
  );
}

function formatCreatedDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function createEmptyDraft(): KnowledgeDraft {
  return {
    title: "",
    content: "",
    category: "",
    tags: [],
    tagsText: "",
    createdAt: todayAsDateInput(),
  };
}

export default function KnowledgeVault() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [draft, setDraft] = useState<KnowledgeDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      try {
        const savedItems = window.localStorage.getItem(STORAGE_KEY);
        if (savedItems) {
          const parsed: unknown = JSON.parse(savedItems);
          if (!Array.isArray(parsed) || !parsed.every(isKnowledgeItem)) {
            throw new Error("Saved knowledge items have an invalid format.");
          }
          if (!cancelled) setItems(parsed);
        }
        if (!cancelled) setStorageReady(true);
      } catch (error) {
        if (!cancelled) {
          setStorageError(
            error instanceof Error
              ? `Knowledge could not be loaded: ${error.message}`
              : "Knowledge could not be loaded from this browser.",
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      Promise.resolve().then(() =>
        setStorageError(
          error instanceof Error
            ? `Knowledge could not be saved: ${error.message}`
            : "Knowledge could not be saved to this browser.",
        ),
      );
    }
  }, [items, storageError, storageReady]);

  const categories = useMemo(
    () =>
      [...new Set(items.map((item) => item.category).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return items
      .filter(
        (item) =>
          categoryFilter === ALL_CATEGORIES ||
          item.category === categoryFilter,
      )
      .filter(
        (item) =>
          !normalizedQuery ||
          [
            item.title,
            item.content,
            item.category,
            ...item.tags,
          ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [categoryFilter, items, query]);

  function openNewItem() {
    setEditingItem(null);
    setDraft(createEmptyDraft());
    setModalOpen(true);
  }

  function openEditItem(item: KnowledgeItem) {
    setEditingItem(item);
    setDraft({
      title: item.title,
      content: item.content,
      category: item.category,
      tags: item.tags,
      tagsText: item.tags.join(", "),
      createdAt: item.createdAt,
    });
    setModalOpen(true);
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item: KnowledgeItem = {
      id: editingItem?.id ?? crypto.randomUUID(),
      title: draft.title.trim(),
      content: draft.content.trim(),
      category: draft.category.trim(),
      tags: [
        ...new Map(
          draft.tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .map((tag) => [tag.toLocaleLowerCase(), tag]),
        ).values(),
      ],
      createdAt: draft.createdAt,
    };

    setItems((currentItems) =>
      editingItem
        ? currentItems.map((current) =>
            current.id === item.id ? item : current,
          )
        : [item, ...currentItems],
    );
    setModalOpen(false);
  }

  function deleteItem(id: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== id),
    );
  }

  return (
    <>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">
            03 · YOUR KNOWLEDGE
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Knowledge Vault
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Save useful ideas, notes, and things worth remembering.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewItem}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Add knowledge
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
        aria-label="Knowledge search and filters"
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-[#111827] p-4 sm:flex-row sm:items-center"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search knowledge</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          >
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, content, categories, or tags..."
            className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="sm:w-52">
          <span className="sr-only">Filter by category</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
        <p>
          {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
          {query || categoryFilter !== ALL_CATEGORIES ? " found" : " saved"}
        </p>
        {categoryFilter !== ALL_CATEGORIES && (
          <button
            type="button"
            onClick={() => setCategoryFilter(ALL_CATEGORIES)}
            className="text-blue-300 transition hover:text-blue-200"
          >
            Clear category
          </button>
        )}
      </div>

      {filteredItems.length > 0 ? (
        <section
          aria-label="Knowledge items"
          className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
        >
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="flex min-w-0 flex-col rounded-2xl border border-slate-800 bg-[#111827] p-5 transition hover:border-slate-700"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-medium text-blue-300">
                  {item.category}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEditItem(item)}
                    aria-label={`Edit ${item.title}`}
                    className="text-xs font-medium text-slate-400 transition hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="text-xs font-medium text-rose-300 transition hover:text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <h2 className="break-words text-lg font-semibold text-slate-100">
                {item.title}
              </h2>
              <p className="mt-2 line-clamp-5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">
                {item.content}
              </p>

              {item.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-auto border-t border-slate-800 pt-4 text-xs text-slate-500">
                Created {formatCreatedDate(item.createdAt)}
              </p>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-800 bg-[#0e1626] px-5 py-16 text-center">
          <div
            aria-hidden="true"
            className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl text-blue-300"
          >
            ◈
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-200">
            {items.length === 0 ? "Your vault is ready" : "No matching knowledge"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            {items.length === 0
              ? "Save a note, idea, or useful reference to find it here later."
              : "Try a different search or category, or add a new item."}
          </p>
          {items.length === 0 && (
            <button
              type="button"
              onClick={openNewItem}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Create your first item
            </button>
          )}
        </section>
      )}

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
            aria-labelledby="knowledge-dialog-title"
            className="my-auto w-full max-w-xl rounded-2xl border border-slate-700 bg-[#111827] p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="knowledge-dialog-title" className="text-xl font-semibold">
                  {editingItem ? "Edit knowledge" : "Add to your vault"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Keep the details organized so they’re easy to find.
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

            <form onSubmit={saveItem} className="space-y-4">
              <div>
                <label
                  htmlFor="knowledge-title"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Title
                </label>
                <input
                  id="knowledge-title"
                  autoFocus
                  required
                  maxLength={160}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  placeholder="Give this note a clear title"
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="knowledge-content"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Content
                </label>
                <textarea
                  id="knowledge-content"
                  required
                  rows={6}
                  maxLength={10000}
                  value={draft.content}
                  onChange={(event) =>
                    setDraft({ ...draft, content: event.target.value })
                  }
                  placeholder="Write down the details you want to remember..."
                  className="w-full resize-y rounded-xl border border-slate-700 bg-[#0b1120] px-3 py-2.5 text-sm leading-6 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="knowledge-category"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Category
                  </label>
                  <input
                    id="knowledge-category"
                    required
                    maxLength={60}
                    list="knowledge-categories"
                    value={draft.category}
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value })
                    }
                    placeholder="e.g. Work, Ideas"
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                  <datalist id="knowledge-categories">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label
                    htmlFor="knowledge-tags"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Tags <span className="font-normal text-slate-500">· comma separated</span>
                  </label>
                  <input
                    id="knowledge-tags"
                    maxLength={300}
                    value={draft.tagsText}
                    onChange={(event) =>
                      setDraft({ ...draft, tagsText: event.target.value })
                    }
                    placeholder="research, reference"
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="knowledge-created-at"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Created date
                </label>
                <input
                  id="knowledge-created-at"
                  type="date"
                  required
                  value={draft.createdAt}
                  onChange={(event) =>
                    setDraft({ ...draft, createdAt: event.target.value })
                  }
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
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
                  {editingItem ? "Save changes" : "Save knowledge"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
