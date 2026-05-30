import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAssistantWorkflow } from "../../context/AssistantWorkflowContext.jsx";
import AssistantGuidedLayer from "./AssistantGuidedLayer.jsx";
import AgentAvatar from "./AgentAvatar.jsx";
import "./AssistantGhostCursor.css";

export default function AssistantGhostCursor() {
  const { ghost } = useAssistantWorkflow();

  return (
    <>
      <AssistantGuidedLayer />

      {createPortal(
        <>
          <AnimatePresence>
            {ghost && (
              <motion.div
                className="a8a-ghost-wrap"
                initial={{ opacity: 0, left: ghost.x - 20, top: ghost.y - 20 }}
                animate={{
                  opacity: 1,
                  left: ghost.x - 4,
                  top: ghost.y - 4,
                }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                aria-hidden
              >
                <div className="a8a-ghost-agent">
                  <AgentAvatar size="sm" pulse={ghost.clicking} />
                </div>
                {ghost.label && <div className="a8a-ghost-label">{ghost.label}</div>}
                {ghost.stepIndex && (
                  <span className="a8a-ghost-step">{ghost.stepIndex}/{ghost.totalSteps}</span>
                )}
                {ghost.clicking && <span className="a8a-ghost-ripple" />}
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  );
}
