import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  hasCompletedStandupWalkthrough,
  hasSeenStandupOnboarding,
  markStandupOnboardingSeen,
  markStandupWalkthroughCompleted,
  resetStandupWalkthroughLocal,
  STANDUP_WALKTHROUGH_CHANGED_EVENT,
} from "../config/standupPrefs.js";
import { STANDUP_WALKTHROUGH_STEPS } from "../config/standupWalkthroughSteps.js";
import { StandupWalkthroughLayer } from "../components/schedule/StandupWalkthroughLayer.jsx";

const StandupWalkthroughContext = createContext(null);

export function StandupWalkthroughProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState(() => hasSeenStandupOnboarding());
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [standupActive, setStandupActive] = useState(false);

  const currentStep = STANDUP_WALKTHROUGH_STEPS[stepIndex] ?? null;

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resetStandupWalkthrough") !== "1") return;
    resetStandupWalkthroughLocal();
    setCompleted(false);
    setActive(false);
    setStepIndex(0);
    params.delete("resetStandupWalkthrough");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, []);

  useEffect(() => {
    const sync = () => setCompleted(hasSeenStandupOnboarding());
    window.addEventListener(STANDUP_WALKTHROUGH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(STANDUP_WALKTHROUGH_CHANGED_EVENT, sync);
  }, []);

  const startWalkthrough = useCallback(() => {
    if (hasSeenStandupOnboarding()) return;
    markStandupOnboardingSeen();
    setCompleted(true);
    setActive(true);
    setStepIndex(0);
  }, []);

  const finishWalkthrough = useCallback(() => {
    markStandupWalkthroughCompleted();
    setCompleted(true);
    setActive(false);
    setStepIndex(0);
  }, []);

  const skipWalkthrough = useCallback(() => {
    finishWalkthrough();
  }, [finishWalkthrough]);

  const goToStep = useCallback(
    (index) => {
      const step = STANDUP_WALKTHROUGH_STEPS[index];
      if (!step) {
        finishWalkthrough();
        return;
      }
      if (step.route && step.route !== location.pathname) {
        navigate(step.route, step.id === "start-btn" ? undefined : undefined);
      }
      setStepIndex(index);
    },
    [finishWalkthrough, location.pathname, navigate]
  );

  const nextStep = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= STANDUP_WALKTHROUGH_STEPS.length) {
      finishWalkthrough();
      return;
    }
    goToStep(nextIndex);
  }, [finishWalkthrough, goToStep, stepIndex]);

  const registerStandupActive = useCallback((isActive) => {
    setStandupActive(Boolean(isActive));
  }, []);

  const notifyStandupStarted = useCallback(() => {
    const modeBarIndex = STANDUP_WALKTHROUGH_STEPS.findIndex((s) => s.id === "mode-bar");
    const startIndex = STANDUP_WALKTHROUGH_STEPS.findIndex((s) => s.id === "start-btn");
    if (!active || modeBarIndex < 0 || startIndex < 0) return;
    if (stepIndex === startIndex) {
      setStepIndex(modeBarIndex);
    }
  }, [active, stepIndex]);

  const stepReady = useMemo(() => {
    if (!active || !currentStep) return false;
    if (currentStep.type === "center") return true;
    if (currentStep.route && currentStep.route !== location.pathname) return false;
    if (currentStep.requiresStandupActive && !standupActive) return false;
    return true;
  }, [active, currentStep, location.pathname, standupActive]);

  useEffect(() => {
    if (hasSeenStandupOnboarding() || active) return;
    if (location.pathname !== "/") return;
    const timer = window.setTimeout(() => {
      startWalkthrough();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [active, location.pathname, startWalkthrough]);

  const value = useMemo(
    () => ({
      active,
      completed,
      stepIndex,
      currentStep,
      stepReady,
      stepCount: STANDUP_WALKTHROUGH_STEPS.length,
      standupActive,
      startWalkthrough,
      nextStep,
      skipWalkthrough,
      finishWalkthrough,
      registerStandupActive,
      notifyStandupStarted,
    }),
    [
      active,
      completed,
      currentStep,
      finishWalkthrough,
      nextStep,
      notifyStandupStarted,
      registerStandupActive,
      skipWalkthrough,
      standupActive,
      startWalkthrough,
      stepIndex,
      stepReady,
    ]
  );

  return (
    <StandupWalkthroughContext.Provider value={value}>
      {children}
      {active && stepReady ? <StandupWalkthroughLayer /> : null}
    </StandupWalkthroughContext.Provider>
  );
}

export function useStandupWalkthrough() {
  const ctx = useContext(StandupWalkthroughContext);
  if (!ctx) {
    throw new Error("useStandupWalkthrough must be used within StandupWalkthroughProvider");
  }
  return ctx;
}

/** Safe optional hook for leaf components outside strict provider needs. */
export function useStandupWalkthroughOptional() {
  return useContext(StandupWalkthroughContext);
}
