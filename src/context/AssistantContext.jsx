import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import {
  ALLOC8_OPEN_ASSISTANT_EVENT,
} from "../config/appKeyboardEvents.js";
import {
  buildAssistantContext,
  setAssistantAuthSnapshot,
} from "../lib/assistant/alloc8Context.js";
import { ASSISTANT_ADMIN_ONLY_MESSAGE } from "../lib/assistant/assistantAccess.js";
import { prepareActionProposal, matchQuickAction } from "../lib/assistant/assistantActions.js";
import { executeAssistantAction } from "../lib/assistant/executeAssistantAction.js";
import { detectConfusion } from "../lib/assistant/confusionSignals.js";

const AssistantContext = createContext(null);

const SESSION_KEY = "float.assistant.session.v1";
const MAX_HISTORY_FOR_API = 8;
const RECENT_ACTIONS_LIMIT = 24;

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(sessionId, messages) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ sessionId, messages: messages.slice(-40) })
    );
  } catch {
    /* ignore quota errors */
  }
}

/** Parse a Server-Sent-Events stream where each message is `data: <json>`. */
async function* parseSseStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield JSON.parse(payload);
      } catch {
        /* ignore malformed frames */
      }
    }
  }
}

async function getAuthToken() {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export function AssistantProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const assistantEnabled = auth.isWorkspaceAdmin;

  const stored = useRef(loadSession()).current;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(stored?.messages || []);
  const [sessionId] = useState(stored?.sessionId || newId());
  const [busy, setBusy] = useState(false);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  const recentActionsRef = useRef([]);
  const abortRef = useRef(null);

  // Keep the context engine's auth snapshot fresh.
  useEffect(() => {
    setAssistantAuthSnapshot({
      displayName: auth.sessionDisplayName,
      email: auth.workspaceEmail,
      isWorkspaceAdmin: auth.isWorkspaceAdmin,
    });
  }, [auth.sessionDisplayName, auth.workspaceEmail, auth.isWorkspaceAdmin]);

  useEffect(() => {
    persistSession(sessionId, messages);
  }, [sessionId, messages]);

  const recordAction = useCallback((type, meta) => {
    const buf = recentActionsRef.current;
    buf.push({ type, at: Date.now(), meta });
    if (buf.length > RECENT_ACTIONS_LIMIT) buf.splice(0, buf.length - RECENT_ACTIONS_LIMIT);
  }, []);

  // Track navigation for confusion signals.
  useEffect(() => {
    recordAction("navigate", { page: location.pathname });
  }, [location.pathname, recordAction]);

  const highlightControl = useCallback((target, message) => {
    setHighlight({ target, message, at: Date.now() });
    window.setTimeout(() => {
      setHighlight((cur) => (cur && cur.target === target ? null : cur));
    }, 6000);
  }, []);

  const openAssistant = useCallback(() => {
    if (!assistantEnabled) return;
    setSuggestion(null);
    setOpen(true);
  }, [assistantEnabled]);
  const closeAssistant = useCallback(() => setOpen(false), []);
  const toggleAssistant = useCallback(() => {
    if (!assistantEnabled) return;
    setOpen((o) => !o);
  }, [assistantEnabled]);

  useEffect(() => {
    if (!assistantEnabled) {
      setOpen(false);
      setSuggestion(null);
      setPendingProposal(null);
      abortRef.current?.abort();
      setBusy(false);
    }
  }, [assistantEnabled]);

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: newId(), createdAt: Date.now(), ...msg }]);
  }, []);

  const confirmProposal = useCallback(() => {
    if (!pendingProposal) return;
    const result = executeAssistantAction(pendingProposal, {
      navigate,
      highlight: highlightControl,
    });
    recordAction("action", { actionId: pendingProposal.actionId });
    appendMessage({
      role: "assistant",
      kind: "action_result",
      text: result.message,
      ok: result.ok,
    });
    setPendingProposal(null);
  }, [pendingProposal, navigate, highlightControl, appendMessage, recordAction]);

  const dismissProposal = useCallback(() => {
    setPendingProposal(null);
    appendMessage({ role: "assistant", kind: "note", text: "Okay, I won't make that change." });
  }, [appendMessage]);

  const sendQuestion = useCallback(
    async (question) => {
      const trimmed = String(question || "").trim();
      if (!trimmed || busy || !assistantEnabled) return;

      appendMessage({ role: "user", text: trimmed });
      setPendingProposal(null);

      const context = buildAssistantContext({ pathname: location.pathname });
      const quick = matchQuickAction(trimmed, context);
      if (quick?.ok) {
        const result = executeAssistantAction(quick.proposal, {
          navigate,
          highlight: highlightControl,
        });
        recordAction("action", { actionId: quick.proposal.actionId });
        appendMessage({
          role: "assistant",
          kind: "action_result",
          text: result.message || quick.proposal.summary,
          ok: result.ok,
        });
        return;
      }

      setBusy(true);

      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", text: "", streaming: true, createdAt: Date.now() },
      ]);

      const history = messages
        .filter((m) => m.role === "user" || (m.role === "assistant" && m.text && !m.streaming))
        .slice(-MAX_HISTORY_FOR_API)
        .map((m) => ({ role: m.role, content: m.text }));

      const token = await getAuthToken();
      const controller = new AbortController();
      abortRef.current = controller;

      let collectedText = "";
      let rawProposal = null;

      try {
        const res = await fetch("/api/alloc8-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ question: trimmed, context, history, sessionId }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          if (res.status === 403) {
            let detail = ASSISTANT_ADMIN_ONLY_MESSAGE;
            try {
              const payload = await res.json();
              if (payload?.error) detail = String(payload.error);
            } catch {
              /* ignore */
            }
            throw new Error(detail);
          }
          if (res.status === 404) {
            throw new Error(
              "Assistant API not found — restart `npm run dev` so the local /api handler loads."
            );
          }
          throw new Error(`Assistant unavailable (${res.status})`);
        }

        for await (const event of parseSseStream(res)) {
          if (event.type === "token" && typeof event.text === "string") {
            collectedText += event.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: collectedText } : m))
            );
          } else if (event.type === "action_proposal") {
            rawProposal = event;
          } else if (event.type === "error") {
            throw new Error(event.message || "Assistant error");
          }
        }
      } catch (err) {
        const aborted = err?.name === "AbortError";
        if (aborted && collectedText) {
          collectedText += "\n\n*(Stopped)*";
        } else if (!collectedText) {
          collectedText =
            err?.message ||
            "I'm having trouble reaching the assistant service right now. Please try again in a moment.";
        }
        if (aborted && !collectedText) {
          collectedText = "*(Stopped)*";
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: collectedText, error: true } : m
          )
        );
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
        );
        abortRef.current = null;
        setBusy(false);
      }

      // Turn a raw proposal into a validated, confirmable action.
      if (rawProposal) {
        const prepared = prepareActionProposal(rawProposal, context);
        if (prepared.ok) {
          if (prepared.proposal.requiresConfirmation) {
            setPendingProposal(prepared.proposal);
          } else {
            const result = executeAssistantAction(prepared.proposal, {
              navigate,
              highlight: highlightControl,
            });
            recordAction("action", { actionId: prepared.proposal.actionId });
            if (result.message) {
              appendMessage({ role: "assistant", kind: "action_result", text: result.message, ok: result.ok });
            }
          }
        }
      }
    },
    [assistantEnabled, busy, messages, location.pathname, sessionId, appendMessage, navigate, highlightControl, recordAction]
  );

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    setMessages([]);
    setPendingProposal(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Global open hooks: custom event + Cmd/Ctrl+Shift+K.
  useEffect(() => {
    if (!assistantEnabled) return undefined;
    const onOpenEvt = () => openAssistant();
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggleAssistant();
      }
    };
    window.addEventListener(ALLOC8_OPEN_ASSISTANT_EVENT, onOpenEvt);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(ALLOC8_OPEN_ASSISTANT_EVENT, onOpenEvt);
      window.removeEventListener("keydown", onKey);
    };
  }, [assistantEnabled, openAssistant, toggleAssistant]);

  // Periodically evaluate confusion signals while the panel is closed.
  useEffect(() => {
    if (!assistantEnabled || open) return undefined;
    const interval = window.setInterval(() => {
      const ctx = buildAssistantContext({ pathname: location.pathname });
      const pageState = ctx.pageState || {};
      const hit = detectConfusion(recentActionsRef.current, {
        emptyResults: Boolean(pageState.emptyResults),
        activeFilterCount: ctx.schedule?.activeFilterCount || 0,
        page: ctx.page,
      });
      setSuggestion(hit);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [assistantEnabled, open, location.pathname]);

  const appendAssistantNote = useCallback(
    (text, opts = {}) => {
      appendMessage({
        role: "assistant",
        text,
        kind: opts.kind || "note",
        ok: opts.ok,
        error: opts.error,
      });
    },
    [appendMessage]
  );

  const appendUserMessage = useCallback(
    (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      appendMessage({ role: "user", text: trimmed });
    },
    [appendMessage]
  );

  const value = useMemo(
    () => ({
      assistantEnabled,
      open,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      messages,
      busy,
      sendQuestion,
      appendAssistantNote,
      appendUserMessage,
      pendingProposal,
      confirmProposal,
      dismissProposal,
      stopGeneration,
      clearConversation,
      highlight,
      suggestion,
    }),
    [
      assistantEnabled,
      open,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      messages,
      busy,
      sendQuestion,
      appendAssistantNote,
      appendUserMessage,
      pendingProposal,
      confirmProposal,
      dismissProposal,
      stopGeneration,
      clearConversation,
      highlight,
      suggestion,
    ]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
