import { Square, Pause, Play, SkipForward } from "lucide-react";
import { useAssistantWorkflow } from "../../context/AssistantWorkflowContext.jsx";
import AgentAvatar, { AgentBetaBadge } from "./AgentAvatar.jsx";
import "./AssistantTakeoverBar.css";

export default function AssistantTakeoverBar() {
  const {
    takeoverActive,
    running,
    paused,
    currentStep,
    stepProgress,
    stopWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    skipCurrentStep,
  } = useAssistantWorkflow();

  if (!takeoverActive && !running) return null;

  return (
    <div className="a8a-takeover-bar" role="status">
      <div className="a8a-takeover-bar-inner">
        <span className="a8a-takeover-icon">
          <AgentAvatar size="sm" pulse={running && !paused} />
        </span>
        <div className="a8a-takeover-copy">
          <div className="a8a-takeover-title-row">
            <strong>Alloc8 Agent</strong>
            <AgentBetaBadge />
          </div>
          <span>
            {paused ? "Paused" : currentStep?.label || "Working…"}
            {stepProgress.total > 0 &&
              ` · Step ${stepProgress.index} of ${stepProgress.total}`}
          </span>
        </div>
        <div className="a8a-takeover-controls">
          {running && (
            <button
              type="button"
              className="a8a-takeover-ctrl"
              onClick={paused ? resumeWorkflow : pauseWorkflow}
              title={paused ? "Resume" : "Pause"}
            >
              {paused ? <Play size={12} /> : <Pause size={12} />}
            </button>
          )}
          {running && (
            <button
              type="button"
              className="a8a-takeover-ctrl"
              onClick={skipCurrentStep}
              title="Skip step"
            >
              <SkipForward size={12} />
            </button>
          )}
          <button type="button" className="a8a-takeover-stop" onClick={stopWorkflow}>
            <Square size={11} fill="currentColor" strokeWidth={0} /> Stop
          </button>
        </div>
      </div>
    </div>
  );
}
