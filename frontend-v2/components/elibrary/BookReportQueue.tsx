"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiscussionAuthor = {
  id: string;
  displayName: string;
  role: "owner" | "maintainer" | "member" | "viewer";
};

export type DiscussionAttachment = {
  id: string;
  name: string;
  sizeBytes: number;
  url: string;
};

export type DiscussionMention = {
  id: string;
  displayName: string;
};

export type DiscussionPost = {
  id: string;
  threadId: string;
  parentId: string | null;
  author: DiscussionAuthor;
  body: string;
  mentions: DiscussionMention[];
  attachments: DiscussionAttachment[];
  createdAt: string;
  resolved: boolean;
  hidden: boolean;
  pending?: boolean;
  failed?: boolean;
};

export type DiscussionThread = {
  id: string;
  projectId: string;
  title: string;
  posts: DiscussionPost[];
  resolved: boolean;
  retentionDays: number;
  createdAt: string;
};

export type DiscussionViewer = {
  id: string;
  role: "owner" | "maintainer" | "member" | "viewer";
};

export type DiscussionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; thread: DiscussionThread };

export type PostResult =
  | { ok: true; post: DiscussionPost }
  | { ok: false; kind: "conflict"; message: string }
  | { ok: false; kind: "error"; message: string };

export type ModerationResult =
  | { ok: true }
  | { ok: false; kind: "conflict"; message: string }
  | { ok: false; kind: "error"; message: string };

export type DiscussionApi = {
  loadThread: (projectId: string, threadId: string) => Promise<DiscussionThread>;
  postMessage: (input: {
    projectId: string;
    threadId: string;
    parentId: string | null;
    body: string;
    idempotencyKey: string;
  }) => Promise<PostResult>;
  setResolved: (input: {
    projectId: string;
    threadId: string;
    resolved: boolean;
    idempotencyKey: string;
  }) => Promise<ModerationResult>;
  moderatePost: (input: {
    projectId: string;
    threadId: string;
    postId: string;
    hidden: boolean;
    idempotencyKey: string;
  }) => Promise<ModerationResult>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

function canModerate(role: DiscussionViewer["role"]): boolean {
  return role === "owner" || role === "maintainer";
}

function canPost(role: DiscussionViewer["role"]): boolean {
  return role !== "viewer";
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Stable ordering: oldest first, ties broken by id so pagination is deterministic.
function comparePosts(a: DiscussionPost, b: DiscussionPost): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (ta !== tb) return ta - tb;
  return a.id.localeCompare(b.id);
}

// Render body with mention tokens highlighted. Mentions are matched by
// display name as `@Name`; unknown tokens render as plain text.
function renderBody(body: string, mentions: DiscussionMention[]) {
  if (mentions.length === 0) return body;
  const names = mentions
    .map((m) => m.displayName)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(${names.join("|")})`, "g");
  const parts: Array<string | { mention: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push({ mention: match[1] });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <span key={i}>{part}</span>
    ) : (
      <span key={i} className="rounded bg-blue-100 px-1 font-medium text-blue-800">
        @{part.mention}
      </span>
    ),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectDiscussions({
  projectId,
  threadId,
  viewer,
  api,
}: {
  projectId: string;
  threadId: string;
  viewer: DiscussionViewer;
  api: DiscussionApi;
}) {
  const [state, setState] = useState<DiscussionState>({ status: "loading" });
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<
    { kind: "success" | "error" | "conflict"; message: string } | null
  >(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const thread = await api.loadThread(projectId, threadId);
      if (!mounted.current) return;
      if (thread.posts.length === 0) {
        setState({ status: "empty" });
      } else {
        setState({ status: "ready", thread });
      }
    } catch (err) {
      if (!mounted.current) return;
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load discussion.",
      });
    }
  }, [api, projectId, threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedPosts = useMemo(() => {
    if (state.status !== "ready") return [];
    return [...state.thread.posts].sort(comparePosts);
  }, [state]);

  const pageCount = Math.max(1, Math.ceil(sortedPosts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagePosts = sortedPosts.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const thread = state.status === "ready" ? state.thread : null;
  const canMod = canModerate(viewer.role);
  const canWrite = canPost(viewer.role);

  const handleSubmit = useCallback(async () => {
    const body = draft.trim();
    if (!body || submitting || !canWrite) return;
    const idempotencyKey = newIdempotencyKey();
    const optimisticId = `optimistic-${idempotencyKey}`;
    const optimistic: DiscussionPost = {
      id: optimisticId,
      threadId,
      parentId: replyTo,
      author: { id: viewer.id, displayName: "You", role: viewer.role },
      body,
      mentions: [],
      attachments: [],
      createdAt: new Date().toISOString(),
      resolved: false,
      hidden: false,
      pending: true,
    };

    setSubmitting(true);
    setBanner(null);
    setDraft("");
    setReplyTo(null);

    // Optimistic insert.
    setState((prev) => {
      if (prev.status === "ready") {
        return { status: "ready", thread: { ...prev.thread, posts: [...prev.thread.posts, optimistic] } };
      }
      return {
        status: "ready",
        thread: {
          id: threadId,
          projectId,
          title: "Discussion",
          posts: [optimistic],
          resolved: false,
          retentionDays: 0,
          createdAt: new Date().toISOString(),
        },
      };
    });

    try {
      const result = await api.postMessage({
        projectId,
        threadId,
        parentId: optimistic.parentId,
        body,
        idempotencyKey,
      });
      if (!mounted.current) return;
      if (result.ok) {
        setState((prev) => {
          if (prev.status !== "ready") return prev;
          return {
            status: "ready",
            thread: {
              ...prev.thread,
              posts: prev.thread.posts.map((p) => (p.id === optimisticId ? result.post : p)),
            },
          };
        });
        setBanner({ kind: "success", message: "Message posted." });
      } else {
        // Rollback optimistic post.
        setState((prev) => {
          if (prev.status !== "ready") return prev;
          const remaining = prev.thread.posts.filter((p) => p.id !== optimisticId);
          return remaining.length === 0
            ? { status: "empty" }
            : { status: "ready", thread: { ...prev.thread, posts: remaining } };
        });
        setDraft(body);
        setBanner({
          kind: result.kind === "conflict" ? "conflict" : "error",
          message:
            result.kind === "conflict"
              ? "This conversation changed while you were posting. Your message was not saved — review and retry."
              : result.message || "Failed to post message.",
        });
      }
    } catch (err) {
      if (!mounted.current) return;
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        const remaining = prev.thread.posts.filter((p) => p.id !== optimisticId);
        return remaining.length === 0
          ? { status: "empty" }
          : { status: "ready", thread: { ...prev.thread, posts: remaining } };
      });
      setDraft(body);
      setBanner({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to post message.",
      });
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [api, canWrite, draft, projectId, replyTo, submitting, threadId, viewer]);

  const handleResolve = useCallback(async () => {
    if (!thread || !canMod || resolving) return;
    setResolving(true);
    setBanner(null);
    try {
      const result = await api.setResolved({
        projectId,
        threadId,
        resolved: !thread.resolved,
        idempotencyKey: newIdempotencyKey(),
      });
      if (!mounted.current) return;
      if (result.ok) {
        setState((prev) =>
          prev.status === "ready"
            ? { status: "ready", thread: { ...prev.thread, resolved: !prev.thread.resolved } }
            : prev,
        );
        setBanner({
          kind: "success",
          message: thread.resolved ? "Thread reopened." : "Thread marked resolved.",
        });
      } else {
        setBanner({
          kind: result.kind === "conflict" ? "conflict" : "error",
          message:
            result.kind === "conflict"
              ? "Thread state changed elsewhere. Reload to see the latest status."
              : result.message || "Failed to update thread.",
        });
      }
    } catch (err) {
      if (!mounted.current) return;
      setBanner({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to update thread.",
      });
    } finally {
      if (mounted.current) setResolving(false);
    }
  }, [api, canMod, projectId, resolving, thread, threadId]);

  const handleModerate = useCallback(
    async (post: DiscussionPost) => {
      if (!canMod || busyPostId) return;
      setBusyPostId(post.id);
      setBanner(null);
      try {
        const result = await api.moderatePost({
          projectId,
          threadId,
          postId: post.id,
          hidden: !post.hidden,
          idempotencyKey: newIdempotencyKey(),
        });
        if (!mounted.current) return;
        if (result.ok) {
          setState((prev) =>
            prev.status === "ready"
              ? {
                  status: "ready",
                  thread: {
                    ...prev.thread,
                    posts: prev.thread.posts.map((p) =>
                      p.id === post.id ? { ...p, hidden: !p.hidden } : p,
                    ),
                  },
                }
              : prev,
          );
          setBanner({
            kind: "success",
            message: post.hidden ? "Message restored." : "Message hidden.",
          });
        } else {
          setBanner({
            kind: result.kind === "conflict" ? "conflict" : "error",
            message:
              result.kind === "conflict"
                ? "Message state changed elsewhere. Reload to see the latest."
                : result.message || "Failed to moderate message.",
          });
        }
      } catch (err) {
        if (!mounted.current) return;
        setBanner({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to moderate message.",
        });
      } finally {
        if (mounted.current) setBusyPostId(null);
      }
    },
    [api, busyPostId, canMod, projectId, threadId],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section aria-labelledby="discussion-heading" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="discussion-heading" className="text-lg font-semibold">
          {thread ? thread.title : "Project discussion"}
        </h2>
        <div className="flex items-center gap-2">
          {thread && (
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                thread.resolved ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
              }`}
            >
              {thread.resolved ? "Resolved" : "Open"}
            </span>
          )}
          {canMod && thread && (
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={resolving}
              aria-busy={resolving}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              {resolving ? "Updating…" : thread.resolved ? "Reopen thread" : "Mark resolved"}
            </button>
          )}
        </div>
      </header>

      {thread && thread.retentionDays > 0 && (
        <p role="note" className="rounded bg-amber-50 p-2 text-xs text-amber-800">
          Messages in this thread are retained for {thread.retentionDays} days, then removed.
        </p>
      )}

      {banner && (
        <div
          role={banner.kind === "success" ? "status" : "alert"}
          aria-live={banner.kind === "success" ? "polite" : "assertive"}
          className={`rounded p-2 text-sm ${
            banner.kind === "success"
              ? "bg-green-50 text-green-800"
              : banner.kind === "conflict"
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-800"
          }`}
        >
          {banner.message}
        </div>
      )}

      {state.status === "loading" && (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">Loading discussion…</span>
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
          <p>{state.message}</p>
          <button type="button" onClick={() => void load()} className="mt-2 rounded border px-3 py-1">
            Retry
          </button>
        </div>
      )}

      {state.status === "empty" && (
        <p className="text-sm text-gray-500">
          No messages yet. Start the conversation below.
        </p>
      )}

      {state.status === "ready" && (
        <>
          <ol className="space-y-3" aria-label="Discussion messages">
            {pagePosts.map((post) => (
              <li
                key={post.id}
                className={`rounded border p-3 ${post.pending ? "opacity-60" : ""}`}
                aria-busy={post.pending || undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{post.author.displayName}</span>{" "}
                    <span className="text-xs text-gray-500">({post.author.role})</span>
                    <time className="ml-2 text-xs text-gray-500" dateTime={post.createdAt}>
                      {new Date(post.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <div className="flex items-center gap-2">
                    {post.pending && <span className="text-xs text-gray-500">Sending…</span>}
                    {canMod && !post.pending && (
                      <button
                        type="button"
                        onClick={() => void handleModerate(post)}
                        disabled={busyPostId === post.id}
                        aria-busy={busyPostId === post.id}
                        className="rounded border px-2 py-0.5 text-xs disabled:opacity-50"
                      >
                        {post.hidden ? "Restore" : "Hide"}
                      </button>
                    )}
                  </div>
                </div>

                {post.hidden ? (
                  <p className="mt-1 text-sm italic text-gray-500">
                    This message was hidden by a moderator.
                  </p>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {renderBody(post.body, post.mentions)}
                  </p>
                )}

                {post.attachments.length > 0 && (
                  <ul className="mt-2 space-y-1" aria-label="Attachments">
                    {post.attachments.map((att) => (
                      <li key={att.id} className="text-xs">
                        <a
                          href={att.url}
                          className="text-blue-700 underline"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {att.name}
                        </a>{" "}
                        <span className="text-gray-500">({formatBytes(att.sizeBytes)})</span>
                      </li>
                    ))}
                  </ul>
                )}

                {canWrite && !post.pending && !thread?.resolved && (
                  <button
                    type="button"
                    onClick={() => setReplyTo(post.id)}
                    className="mt-1 text-xs text-blue-700 underline"
                  >
                    Reply
                  </button>
                )}
              </li>
            ))}
          </ol>

          {pageCount > 1 && (
            <nav aria-label="Discussion pagination" className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-gray-600" aria-live="polite">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {canWrite && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="space-y-2"
        >
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Replying to a message</span>
              <button type="button" onClick={() => setReplyTo(null)} className="underline">
                Cancel
              </button>
            </div>
          )}
          <label htmlFor="discussion-draft" className="sr-only">
            Write a message
          </label>
          <textarea
            id="discussion-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Write a message… use @name to mention someone"
            className="w-full rounded border p-2 text-sm"
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {thread?.resolved ? "Thread is resolved; reopen to post." : ""}
            </span>
            <button
              type="submit"
              disabled={submitting || !draft.trim() || Boolean(thread?.resolved)}
              aria-busy={submitting}
              className="rounded bg-blue-600 px-4 py-1 text-sm text-white disabled:opacity-50"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      )}

      {!canWrite && (
        <p className="text-xs text-gray-500">You have read-only access to this discussion.</p>
      )}
    </section>
  );
}
</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>