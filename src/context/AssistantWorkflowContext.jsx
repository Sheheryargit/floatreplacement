import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "./AppDataContext.jsx";
import { runWorkflowPlan } from "../lib/assistant/workflowEngine.js";
import { buildPlanWithStore } from "../lib/assistant/intentParser.js";
import { validateWorkflowPlan } from "../lib/assistant/guardrails.js";

const AssistantWorkflowContext = createContext(null);

export function AssistantWorkflowProvider({ children }) {
  const navigate = useNavigate();
  const stopRef = useRef(false);
  const skipRef = useRef(false);
  const pausedRef = useRef(false);
  const stepConfirmResolver = useRef(null);

  const [pendingPlan, setPendingPlan] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [clarifications, setClarifications] = useState(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [runMode, setRunMode] = useState("guided");
  const [currentStep, setCurrentStep] = useState(null);
  const [stepProgress, setStepProgress] = useState({ index: 0, total: 0 });
  const [completedStepIds, setCompletedStepIds] = useState([]);
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [ghost, setGhost] = useState(null);
  const [guideHighlight, setGuideHighlight] = useState(null);
  const [successPulse, setSuccessPulse] = useState(null);
  const [pendingStepConfirm, setPendingStepConfirm] = useState(null);

  const tryParsePlan = useCallback((question) => {
    const store = useAppStore.getState();
    const result = buildPlanWithStore(question, {
      people: store.people || [],
      projects: store.projects || [],
      extraAllocationLabels: store.extraAllocationLabels || [],
    });
    if (result?.clarifications) {
      setClarifications(result.clarifications);
      setPendingPlan(null);
      return { type: "clarifications", clarifications: result.clarifications };
    }
    if (result?.plan) {
      const v = validateWorkflowPlan(result.plan);
      if (!v.ok) {
        return { type: "error", message: v.errors.join(" ") };
      }
      setClarifications(null);
      setPendingPlan({ ...result.plan, validation: v });
      return { type: "plan", plan: result.plan };
    }
    return null;
  }, []);

  const dismissPlan = useCallback(() => {
    setPendingPlan(null);
    setClarifications(null);
    setPendingStepConfirm(null);
  }, []);

  const ghostMove = useCallback(async (payload) => {
    setGhost({ ...payload, at: Date.now() });
    await new Promise((r) => setTimeout(r, payload.click ? 680 : 520));
    if (payload.click) {
      setGhost((g) => (g ? { ...g, clicking: true } : null));
      await new Promise((r) => setTimeout(r, 280));
    }
    setGhost(null);
  }, []);

  const shouldConfirmStep = useCallback((step) => {
    return new Promise((resolve) => {
      stepConfirmResolver.current = resolve;
      setPendingStepConfirm(step);
    });
  }, []);

  const answerStepConfirm = useCallback((approved) => {
    stepConfirmResolver.current?.(approved);
    stepConfirmResolver.current = null;
    setPendingStepConfirm(null);
  }, []);

  const pauseWorkflow = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resumeWorkflow = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const skipCurrentStep = useCallback(() => {
    skipRef.current = true;
  }, []);

  const stopWorkflow = useCallback(() => {
    stopRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    setTakeoverActive(false);
    setGhost(null);
    setGuideHighlight(null);
    setSuccessPulse(null);
    setRunning(false);
    setActivePlan(null);
    setCurrentStep(null);
    setCompletedStepIds([]);
    answerStepConfirm(false);
  }, [answerStepConfirm]);

  const executePlan = useCallback(
    async (plan, mode = "guided") => {
      if (!plan) return { ok: false, message: "No plan." };
      stopRef.current = false;
      skipRef.current = false;
      pausedRef.current = false;
      setPaused(false);
      setRunning(true);
      setRunMode(mode);
      setTakeoverActive(mode === "guided");
      setActivePlan(plan);
      setPendingPlan(null);
      setCompletedStepIds([]);

      const result = await runWorkflowPlan(
        plan,
        {
          navigate,
          ghostMove,
          shouldStop: () => stopRef.current,
          isPaused: () => pausedRef.current,
          shouldSkipStep: () => skipRef.current,
          clearSkipStep: () => {
            skipRef.current = false;
          },
          shouldConfirmStep: (step) => {
            if (!step.requiresConfirm) return Promise.resolve(true);
            return shouldConfirmStep(step);
          },
          onStepStart: (step, index, total) => {
            setCurrentStep(step);
            setStepProgress({ index: index + 1, total });
          },
          onStepDone: (step, _result, index) => {
            setCompletedStepIds((prev) =>
              prev.includes(step.id) ? prev : [...prev, step.id]
            );
            if (index + 1 >= (plan.steps?.length || 0)) {
              setCurrentStep(null);
            }
          },
          onGuideHighlight: setGuideHighlight,
          onSuccessPulse: setSuccessPulse,
          highlight: () => {},
        },
        mode
      );

      setRunning(false);
      setTakeoverActive(false);
      setGhost(null);
      setGuideHighlight(null);
      setSuccessPulse(null);
      setCurrentStep(null);
      setActivePlan(null);
      setCompletedStepIds([]);
      return result;
    },
    [navigate, ghostMove, shouldConfirmStep]
  );

  const value = useMemo(
    () => ({
      pendingPlan,
      activePlan,
      clarifications,
      running,
      paused,
      runMode,
      currentStep,
      stepProgress,
      completedStepIds,
      takeoverActive,
      ghost,
      guideHighlight,
      successPulse,
      pendingStepConfirm,
      tryParsePlan,
      dismissPlan,
      executePlan,
      stopWorkflow,
      pauseWorkflow,
      resumeWorkflow,
      skipCurrentStep,
      answerStepConfirm,
      setPendingPlan,
    }),
    [
      pendingPlan,
      activePlan,
      clarifications,
      running,
      paused,
      runMode,
      currentStep,
      stepProgress,
      completedStepIds,
      takeoverActive,
      ghost,
      guideHighlight,
      successPulse,
      pendingStepConfirm,
      tryParsePlan,
      dismissPlan,
      executePlan,
      stopWorkflow,
      pauseWorkflow,
      resumeWorkflow,
      skipCurrentStep,
      answerStepConfirm,
    ]
  );

  return (
    <AssistantWorkflowContext.Provider value={value}>{children}</AssistantWorkflowContext.Provider>
  );
}

export function useAssistantWorkflow() {
  const ctx = useContext(AssistantWorkflowContext);
  if (!ctx) throw new Error("useAssistantWorkflow must be used within AssistantWorkflowProvider");
  return ctx;
}
