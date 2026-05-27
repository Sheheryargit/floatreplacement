import { useCallback, useId, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Copy, ExternalLink, LifeBuoy, X } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { isStaticUi } from "../../config/uiMode.js";
import "./SupportSlackModal.css";

export function SupportSlackModal({
  open,
  onOpenChange,
  slackUrl,
  title = "Contact Alloc8 Support",
  subtitle = "Open our Slack support channel and drop a message. Include a screenshot if you can.",
  variant = "default",
}) {
  const reduceMotion = useReducedMotion();
  const skipEntranceFade = reduceMotion || isStaticUi();
  const titleId = useId();
  const descId = useId();
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const safeSlackUrl = useMemo(() => String(slackUrl || "").trim(), [slackUrl]);
  const canOpen = Boolean(safeSlackUrl);
  const isLoginVariant = variant === "login";
  const panelClass = isLoginVariant
    ? "support-slack-panel support-slack-panel--login"
    : "support-slack-panel";
  const backdropClass = isLoginVariant
    ? "support-slack-backdrop support-slack-backdrop--login"
    : "support-slack-backdrop";

  const onCopy = useCallback(async () => {
    if (!safeSlackUrl) return;
    try {
      await navigator.clipboard.writeText(safeSlackUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, [safeSlackUrl]);

  return (
    <Dialog.Root open={open} modal onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className={backdropClass}
            initial={skipEntranceFade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={skipEntranceFade ? { duration: 0 } : { duration: 0.18 }}
          />
        </Dialog.Overlay>

        <div className="support-slack-center">
          <Dialog.Content asChild>
            <motion.div
              className={panelClass}
              initial={skipEntranceFade ? false : { opacity: 0, scale: 0.92, y: 26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={
                skipEntranceFade
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 340, damping: 28, mass: 0.82 }
              }
              aria-labelledby={titleId}
              aria-describedby={descId}
            >
              <div className="support-slack-glow" aria-hidden />

              <Dialog.Close asChild>
                <button type="button" className="support-slack-close" aria-label="Close">
                  <X size={18} strokeWidth={2} />
                </button>
              </Dialog.Close>

              <div className="support-slack-head">
                <span className="support-slack-ic" aria-hidden>
                  <LifeBuoy size={18} strokeWidth={2.15} />
                </span>
                <div className="support-slack-head-copy">
                  <Dialog.Title asChild>
                    <h2 id={titleId} className="support-slack-title">
                      {title}
                    </h2>
                  </Dialog.Title>
                  <Dialog.Description asChild>
                    <p id={descId} className="support-slack-subtitle">
                      {subtitle}
                    </p>
                  </Dialog.Description>
                </div>
              </div>

              <div className="support-slack-actions">
                <Button
                  variant="primary"
                  size="lg"
                  className="support-slack-primary"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!safeSlackUrl) return;
                    window.open(safeSlackUrl, "_blank", "noopener,noreferrer");
                    onOpenChange?.(false);
                  }}
                >
                  <ExternalLink size={16} strokeWidth={2.1} aria-hidden />
                  Open Alloc8 Support (Slack)
                </Button>

                <div className="support-slack-secondary-row">
                  <Button
                    variant="secondary"
                    size="md"
                    className="support-slack-copy"
                    disabled={!canOpen}
                    onClick={onCopy}
                  >
                    <Copy size={15} strokeWidth={2.1} aria-hidden />
                    {copied ? "Copied" : "Copy Slack link"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    className="support-slack-close-btn"
                    onClick={() => onOpenChange?.(false)}
                  >
                    Not now
                  </Button>
                </div>
              </div>

              {canOpen ? (
                <div className="support-slack-fallback">
                  <button
                    type="button"
                    className="support-slack-fallback-toggle"
                    onClick={() => setShowFallback((s) => !s)}
                    aria-expanded={showFallback}
                  >
                    Trouble opening Slack?
                    <ChevronDown
                      size={16}
                      strokeWidth={2.25}
                      className={"support-slack-fallback-chevron" + (showFallback ? " is-open" : "")}
                      aria-hidden
                    />
                  </button>
                  <motion.div
                    className="support-slack-fallback-body"
                    initial={false}
                    animate={{ height: showFallback ? "auto" : 0, opacity: showFallback ? 1 : 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="support-slack-fallback-inner">
                      <p className="support-slack-footnote">
                        Copy/paste this link into your browser:
                      </p>
                      <span className="support-slack-url">{safeSlackUrl}</span>
                    </div>
                  </motion.div>
                </div>
              ) : (
                <p className="support-slack-footnote">Slack link isn’t configured.</p>
              )}
            </motion.div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

