import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Send,
  X,
  Trash2,
  Check,
  Ban,
  Copy,
  CheckCheck,
  Square,
  ChevronDown,
  Tag,
  LayoutGrid,
  Users,
  HelpCircle,
  Zap,
  Minimize2,
  ListChecks,
  Play,
  MousePointer2,
  Navigation,
  Calendar,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { useAssistant } from "../../context/AssistantContext.jsx";
import { useAssistantWorkflow } from "../../context/AssistantWorkflowContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ASSISTANT_ADMIN_ONLY_MESSAGE } from "../../lib/assistant/assistantAccess.js";
import { pageIdFromPathname, PAGE_LABELS } from "../../lib/assistant/alloc8Context.js";
import { isStaticUi } from "../../config/uiMode.js";
import AgentAvatar, { AgentBetaBadge } from "./AgentAvatar.jsx";
import AssistantPanelChrome from "./AssistantPanelChrome.jsx";
import "./Alloc8Assistant.css";

const STARTER_PROMPTS = [
  {
    text: "What do tags do?",
    chip: "Tags",
    icon: Tag,
    tone: "blue",
    desc: "Person & project labels",
  },
  {
    text: "Show Fire Nation department",
    chip: "Fire Nation",
    icon: LayoutGrid,
    tone: "violet",
    desc: "Filter schedule by dept",
  },
  {
    text: "Why can't I see any results?",
    chip: "Empty view",
    icon: HelpCircle,
    tone: "amber",
    desc: "Troubleshoot empty views",
  },
  {
    text: "Go to the people directory",
    chip: "People",
    icon: Users,
    tone: "green",
    desc: "Navigate instantly",
  },
];

/** Lightweight formatting: paragraphs + simple bullet lines starting with • or - */
function renderMessageText(text) {
  const blocks = String(text || "").split(/\n\n+/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^[\s]*[-•*]\s/.test(l) || l.trim() === "");
    if (isList && lines.some((l) => l.trim())) {
      return (
        <ul key={i} className="a8a-md-list">
          {lines
            .filter((l) => l.trim())
            .map((l, j) => (
              <li key={j}>{l.replace(/^[\s]*[-•*]\s*/, "")}</li>
            ))}
        </ul>
      );
    }
    return (
      <p key={i} className="a8a-md-p">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    );
  });
}

function ThinkingIndicator() {
  return (
    <div className="a8a-thinking" aria-label="Agent is thinking">
      <AgentAvatar size="sm" pulse active />
      <div className="a8a-thinking-bars" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="a8a-thinking-bar" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}

function MessageRow({ message, index, skipAnim }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const showThinking = message.streaming && !message.text;
  const isResult = message.kind === "action_result";
  const isError = Boolean(message.error);

  const onCopy = useCallback(async () => {
    if (!message.text) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }, [message.text]);

  return (
    <motion.div
      className={`a8a-row ${isUser ? "a8a-row--user" : "a8a-row--assistant"}`}
      initial={skipAnim ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: skipAnim ? 0 : Math.min(index * 0.03, 0.15), duration: 0.22 }}
    >
      {!isUser && (
        <div className="a8a-avatar a8a-avatar--bot" aria-hidden>
          <AgentAvatar size="sm" pulse={message.streaming} />
        </div>
      )}

      <div className="a8a-bubble-wrap">
        <div
          className={[
            "a8a-bubble",
            isUser ? "a8a-bubble--user" : "a8a-bubble--assistant",
            isResult && message.ok ? "a8a-bubble--success" : "",
            isResult && !message.ok ? "a8a-bubble--warn" : "",
            isError ? "a8a-bubble--error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showThinking ? (
            <ThinkingIndicator />
          ) : (
            <div className="a8a-bubble-content">
              {renderMessageText(message.text)}
              {message.streaming && message.text && <span className="a8a-stream-cursor" aria-hidden />}
            </div>
          )}
        </div>

        {!isUser && message.text && !message.streaming && (
          <button type="button" className="a8a-copy" onClick={onCopy} aria-label="Copy message">
            {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ProposalCard({ proposal, onConfirm, onDismiss, skipAnim }) {
  return (
    <motion.div
      className="a8a-proposal"
      role="group"
      aria-label="Suggested action"
      initial={skipAnim ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
    >
      <div className="a8a-proposal-glow" aria-hidden />
      <div className="a8a-proposal-top">
        <span className="a8a-proposal-badge">
          <Zap size={12} strokeWidth={2.5} /> Suggested action
        </span>
      </div>
      <p className="a8a-proposal-summary">{proposal.summary}</p>
      {proposal.warnings?.length > 0 && (
        <ul className="a8a-proposal-warnings">
          {proposal.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <div className="a8a-proposal-actions">
        <button type="button" className="a8a-btn a8a-btn--primary" onClick={onConfirm}>
          <Check size={14} strokeWidth={2.5} /> Apply change
        </button>
        <button type="button" className="a8a-btn a8a-btn--ghost" onClick={onDismiss}>
          <Ban size={14} strokeWidth={2.5} /> Dismiss
        </button>
      </div>
    </motion.div>
  );
}

function AdminOnlyScreen({ skipAnim }) {
  return (
    <motion.div
      className="a8a-welcome a8a-admin-only"
      initial={skipAnim ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="a8a-admin-only-icon" aria-hidden>
        <Shield size={22} strokeWidth={2} />
      </div>
      <p className="a8a-welcome-eyebrow">Alloc8 Agent</p>
      <p className="a8a-admin-only-message">{ASSISTANT_ADMIN_ONLY_MESSAGE}</p>
    </motion.div>
  );
}

function WelcomeScreen({ onPick, displayName, skipAnim }) {
  return (
    <motion.div
      className="a8a-welcome"
      initial={skipAnim ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <p className="a8a-welcome-eyebrow">Alloc8 Agent · Beta</p>
      <h2 className="a8a-welcome-title">
        {displayName ? `Hi ${displayName.split(" ")[0]}` : "Hi there"}
      </h2>
      <p className="a8a-welcome-sub">Pick a shortcut or type below.</p>
      <div className="a8a-quick-grid">
        {STARTER_PROMPTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.button
              key={p.text}
              type="button"
              className="a8a-quick-chip"
              onClick={() => onPick(p.text)}
              title={p.text}
              initial={skipAnim ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: skipAnim ? 0 : 0.04 + i * 0.03 }}
              whileTap={skipAnim ? undefined : { scale: 0.97 }}
            >
              <Icon size={13} strokeWidth={2.1} />
              <span>{p.chip}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function stepIcon(type) {
  if (type === "navigate") return Navigation;
  if (type === "ghost_click" || type === "open_allocation_modal") return MousePointer2;
  if (type === "verify_allocation") return CheckCircle2;
  if (type === "ghost_highlight") return Calendar;
  return ListChecks;
}

function WorkflowPlanCard({
  plan,
  onApproveGuided,
  onApproveQuick,
  onCancel,
  running,
  stepProgress,
  currentStep,
  completedStepIds,
  skipAnim,
}) {
  const preview = plan.preview;
  const steps = (plan.steps || []).filter((s) => s.type !== "create_allocation");

  return (
    <motion.div
      className="a8a-plan"
      initial={skipAnim ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="a8a-plan-head">
        <AgentAvatar size="sm" />
        <span>Agent action plan</span>
        <AgentBetaBadge />
        {plan.risk === "medium" && <span className="a8a-plan-risk">Review carefully</span>}
      </div>
      <p className="a8a-plan-summary">{plan.summary}</p>

      {preview && (
        <div className="a8a-plan-preview">
          <div className="a8a-plan-preview-row">
            <span>Person</span>
            <strong>{preview.personName}</strong>
          </div>
          <div className="a8a-plan-preview-row">
            <span>Project</span>
            <strong>{preview.project}</strong>
          </div>
          <div className="a8a-plan-preview-row">
            <span>Dates</span>
            <strong>
              {preview.startDate} → {preview.endDate}
            </strong>
          </div>
          <div className="a8a-plan-preview-row">
            <span>Hours</span>
            <strong>{preview.hoursPerDay}h / day</strong>
          </div>
          {preview.count > 1 && (
            <div className="a8a-plan-preview-row">
              <span>Count</span>
              <strong>{preview.count} allocations</strong>
            </div>
          )}
        </div>
      )}

      <ol className="a8a-plan-timeline">
        {steps.slice(0, 10).map((s, i) => {
          const Icon = stepIcon(s.type);
          const done = completedStepIds?.includes(s.id);
          const active = currentStep?.id === s.id;
          return (
            <li
              key={s.id || i}
              className={[
                "a8a-plan-timeline-item",
                done ? "a8a-plan-timeline-item--done" : "",
                active ? "a8a-plan-timeline-item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="a8a-plan-timeline-icon">
                {done ? <Check size={12} /> : <Icon size={12} />}
              </span>
              <span className="a8a-plan-timeline-label">{s.label}</span>
            </li>
          );
        })}
      </ol>
      {running && (
        <div className="a8a-plan-progress">
          Step {stepProgress.index} of {stepProgress.total} — {currentStep?.label || "…"}
        </div>
      )}
      {!running && (
        <div className="a8a-plan-actions">
          <button type="button" className="a8a-btn a8a-btn--primary" onClick={onApproveGuided}>
            <MousePointer2 size={14} /> Guide me
          </button>
          <button type="button" className="a8a-btn a8a-btn--ghost" onClick={onApproveQuick}>
            <Play size={14} /> Quick apply
          </button>
          <button type="button" className="a8a-btn a8a-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
}

function ClarificationCard({ items, onPick, skipAnim }) {
  return (
    <motion.div className="a8a-clarify" initial={skipAnim ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {items.map((c) => (
        <div key={c.id} className="a8a-clarify-block">
          <p className="a8a-clarify-q">{c.question}</p>
          {c.options?.length > 0 && (
            <div className="a8a-clarify-options">
              {c.options.map((opt) => (
                <button key={opt} type="button" className="a8a-starter" onClick={() => onPick(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
}

export default function Alloc8Assistant() {
  const location = useLocation();
  const { sessionDisplayName } = useAuth();
  const {
    assistantEnabled,
    open,
    openAssistant,
    closeAssistant,
    messages,
    busy,
    sendQuestion,
    stopGeneration,
    pendingProposal,
    confirmProposal,
    dismissProposal,
    clearConversation,
    suggestion,
    appendAssistantNote,
    appendUserMessage,
  } = useAssistant();

  const {
    pendingPlan,
    activePlan,
    clarifications,
    running: workflowRunning,
    currentStep,
    stepProgress,
    completedStepIds,
    pendingStepConfirm,
    tryParsePlan,
    dismissPlan,
    executePlan,
    answerStepConfirm,
  } = useAssistantWorkflow();

  const reduceMotion = useReducedMotion();
  const skipAnim = reduceMotion || isStaticUi();
  const [draft, setDraft] = useState("");
  const [showScrollFab, setShowScrollFab] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottomRef = useRef(true);

  const pageLabel = useMemo(
    () => PAGE_LABELS[pageIdFromPathname(location.pathname)] || "Alloc8",
    [location.pathname]
  );

  const statusLabel = !assistantEnabled
    ? "Admin only"
    : workflowRunning
      ? "Guiding…"
      : busy
        ? "Thinking…"
        : "Ready";

  const [clickTeaserSeen, setClickTeaserSeen] = useState(() => {
    try {
      return localStorage.getItem("a8a-click-teaser-seen") === "1";
    } catch {
      return false;
    }
  });

  const showClickTeaser = !open && !clickTeaserSeen;

  const handleOpenAgent = useCallback(() => {
    setClickTeaserSeen(true);
    try {
      localStorage.setItem("a8a-click-teaser-seen", "1");
    } catch {
      /* ignore */
    }
    openAssistant();
  }, [openAssistant]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !skipAnim ? "smooth" : "auto" });
    stickToBottomRef.current = true;
    setShowScrollFab(false);
  }, [skipAnim]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(false);
  }, [messages, pendingProposal, pendingPlan, clarifications, busy, scrollToBottom]);

  useEffect(() => {
    const onKey = (e) => {
      if (open && e.key === "Escape") {
        e.preventDefault();
        closeAssistant();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeAssistant]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist < 48;
    stickToBottomRef.current = atBottom;
    setShowScrollFab(!atBottom && messages.length > 0);
  }, [messages.length]);

  const submit = useCallback(
    async (text) => {
      const q = (text ?? draft).trim();
      if (!q || busy || workflowRunning) return;
      setDraft("");
      stickToBottomRef.current = true;

      const parsed = tryParsePlan(q);
      if (parsed?.type === "plan") {
        appendUserMessage(q);
        appendAssistantNote(
          "I've prepared a step-by-step plan. Review it below, then choose **Guide me** to watch it happen, or **Quick apply** to run it silently.",
          { kind: "note" }
        );
        return;
      }
      if (parsed?.type === "clarifications") {
        appendUserMessage(q);
        appendAssistantNote("I need a bit more detail before I can build a safe plan:");
        return;
      }
      if (parsed?.type === "error") {
        appendUserMessage(q);
        appendAssistantNote(parsed.message, { ok: false, error: true });
        return;
      }

      sendQuestion(q);
    },
    [draft, busy, workflowRunning, tryParsePlan, appendAssistantNote, appendUserMessage, sendQuestion]
  );

  const runPlan = useCallback(
    async (mode) => {
      if (!pendingPlan) return;
      appendAssistantNote(
        mode === "guided"
          ? "Starting guided mode — watch the cursor. You can stop anytime from the bar at the top."
          : "Applying changes quickly…"
      );
      const result = await executePlan(pendingPlan, mode);
      appendAssistantNote(result.message, { ok: result.ok, kind: "action_result" });
    },
    [pendingPlan, executePlan, appendAssistantNote]
  );

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            className="a8a-backdrop"
            aria-label="Close agent"
            onClick={closeAssistant}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: skipAnim ? 0 : 0.2 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <div className="a8a-launcher-stack">
            <motion.button
              type="button"
              className={`a8a-launcher ${showClickTeaser ? "a8a-launcher--intro" : ""}`}
              aria-label="Open Alloc8 Agent"
              onClick={handleOpenAgent}
              initial={skipAnim ? false : { opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={skipAnim ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
              whileHover={skipAnim ? undefined : { y: -2 }}
              whileTap={skipAnim ? undefined : { scale: 0.96 }}
            >
              <AgentAvatar
                size="lg"
                blink={showClickTeaser}
                pulse={Boolean(suggestion)}
                active={showClickTeaser || Boolean(suggestion)}
              />
              {showClickTeaser && (
                <span className="a8a-launcher-hint">Click me</span>
              )}
              {suggestion && !showClickTeaser && <span className="a8a-launcher-dot" aria-hidden />}
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {suggestion && !open && (
        <motion.div
          className="a8a-nudge"
          role="status"
          initial={skipAnim ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {suggestion.message}
        </motion.div>
      )}

      <AnimatePresence>
        {open && (
          <motion.section
            className="a8a-panel a8a-panel--float"
            role="dialog"
            aria-label="Alloc8 Agent"
            initial={skipAnim ? false : { opacity: 0, y: 16, scale: 0.92, transformOrigin: "bottom right" }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={skipAnim ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.94 }}
            transition={skipAnim ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
          >
            <span className="a8a-panel-tail" aria-hidden />
            <AssistantPanelChrome />
            <div className="a8a-panel-glow" aria-hidden />

            <header className="a8a-head">
              <div className="a8a-head-left">
                <div className="a8a-head-avatar">
                  <AgentAvatar size="md" pulse={busy || workflowRunning} active={busy || workflowRunning} />
                </div>
                <div className="a8a-head-copy">
                  <div className="a8a-head-title-row">
                    <span className="a8a-head-name">Alloc8 Agent</span>
                    <AgentBetaBadge />
                    <span className={`a8a-status ${busy || workflowRunning ? "a8a-status--busy" : ""}`}>
                      <span className="a8a-status-dot" />
                      {statusLabel}
                    </span>
                  </div>
                  <span className="a8a-context-pill">{pageLabel}</span>
                </div>
              </div>
              <div className="a8a-head-actions">
                {messages.length > 0 && (
                  <button
                    type="button"
                    className="a8a-icon-btn"
                    aria-label="New conversation"
                    title="New conversation"
                    onClick={clearConversation}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className="a8a-icon-btn"
                  aria-label="Minimize"
                  title="Minimize"
                  onClick={closeAssistant}
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  type="button"
                  className="a8a-icon-btn a8a-icon-btn--close"
                  aria-label="Close assistant"
                  onClick={closeAssistant}
                >
                  <X size={17} />
                </button>
              </div>
            </header>

            <div className="a8a-body" ref={listRef} onScroll={onScroll}>
              {!assistantEnabled ? (
                <AdminOnlyScreen skipAnim={skipAnim} />
              ) : messages.length === 0 ? (
                <WelcomeScreen
                  onPick={submit}
                  displayName={sessionDisplayName}
                  skipAnim={skipAnim}
                />
              ) : (
                <div className="a8a-thread">
                  {messages.map((m, i) => (
                    <MessageRow key={m.id} message={m} index={i} skipAnim={skipAnim} />
                  ))}
                </div>
              )}

              {assistantEnabled && pendingProposal && (
                <ProposalCard
                  proposal={pendingProposal}
                  onConfirm={confirmProposal}
                  onDismiss={dismissProposal}
                  skipAnim={skipAnim}
                />
              )}

              {assistantEnabled && (pendingPlan || (workflowRunning && activePlan)) && (
                <WorkflowPlanCard
                  plan={pendingPlan || activePlan}
                  onApproveGuided={() => runPlan("guided")}
                  onApproveQuick={() => runPlan("quick")}
                  onCancel={dismissPlan}
                  running={workflowRunning}
                  stepProgress={stepProgress}
                  currentStep={currentStep}
                  completedStepIds={completedStepIds}
                  skipAnim={skipAnim}
                />
              )}

              {assistantEnabled && clarifications?.length > 0 && !pendingPlan && (
                <ClarificationCard
                  items={clarifications}
                  onPick={(opt) => submit(`Use ${opt} for the previous request`)}
                  skipAnim={skipAnim}
                />
              )}

              {assistantEnabled && pendingStepConfirm && (
                <div className="a8a-step-confirm" role="group">
                  <p>Confirm: {pendingStepConfirm.label}</p>
                  <div className="a8a-proposal-actions">
                    <button type="button" className="a8a-btn a8a-btn--primary" onClick={() => answerStepConfirm(true)}>
                      Continue
                    </button>
                    <button type="button" className="a8a-btn a8a-btn--ghost" onClick={() => answerStepConfirm(false)}>
                      Stop
                    </button>
                  </div>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showScrollFab && (
                <motion.button
                  type="button"
                  className="a8a-scroll-fab"
                  aria-label="Scroll to latest"
                  onClick={() => scrollToBottom(true)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <ChevronDown size={16} />
                </motion.button>
              )}
            </AnimatePresence>

            {assistantEnabled && (
            <footer className="a8a-composer">
              {messages.length === 0 && !busy && (
                <div className="a8a-composer-suggestions">
                  {STARTER_PROMPTS.slice(0, 4).map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.text}
                        type="button"
                        className="a8a-composer-chip"
                        onClick={() => submit(p.text)}
                        title={p.text}
                      >
                        <Icon size={11} strokeWidth={2.2} />
                        {p.chip}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className={`a8a-composer-box ${busy ? "a8a-composer-box--busy" : ""} ${draft.trim() ? "a8a-composer-box--ready" : ""}`}>
                <textarea
                  ref={inputRef}
                  className="a8a-input"
                  placeholder="Tell the agent what to do…"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={busy || workflowRunning}
                  aria-label="Message"
                />
                <div className="a8a-composer-bar">
                  <span className="a8a-kbd-hint">
                    <kbd>↵</kbd> send · <kbd>⇧↵</kbd> new line
                  </span>
                  {busy ? (
                    <button
                      type="button"
                      className="a8a-stop"
                      aria-label="Stop generating"
                      onClick={stopGeneration}
                    >
                      <Square size={12} fill="currentColor" strokeWidth={0} />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`a8a-send ${draft.trim() ? "a8a-send--ready" : ""}`}
                      aria-label="Send message"
                      onClick={() => submit()}
                      disabled={!draft.trim() || workflowRunning}
                    >
                      <Send size={16} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            </footer>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
