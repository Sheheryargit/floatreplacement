import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  PREMIUM_V2_CHANGED_EVENT,
  PREMIUM_V2_ENABLED_LS_KEY,
  readPremiumV2Enabled,
} from "../config/premiumV2Prefs.js";
import {
  PREMIUM_V2_TEMPLATES_CHANGED_EVENT,
  PREMIUM_V2_TEMPLATES_LS_KEY,
  readPremiumV2Templates,
  writePremiumV2Templates,
  resetPremiumV2Templates,
} from "../config/premiumV2Templates.js";

const PremiumV2Context = createContext(null);

export function PremiumV2Provider({ children }) {
  const [enabled, setEnabled] = useState(() => readPremiumV2Enabled());
  const [templates, setTemplates] = useState(() => readPremiumV2Templates());

  useEffect(() => {
    const sync = () => setEnabled(readPremiumV2Enabled());
    window.addEventListener(PREMIUM_V2_CHANGED_EVENT, sync);
    const onStorage = (e) => {
      if (e.key === PREMIUM_V2_ENABLED_LS_KEY || e.key == null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PREMIUM_V2_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const sync = () => setTemplates(readPremiumV2Templates());
    window.addEventListener(PREMIUM_V2_TEMPLATES_CHANGED_EVENT, sync);
    const onStorage = (e) => {
      if (e.key === PREMIUM_V2_TEMPLATES_LS_KEY || e.key == null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PREMIUM_V2_TEMPLATES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const resetTemplatesToDefaults = useCallback(() => {
    resetPremiumV2Templates();
    setTemplates(readPremiumV2Templates());
  }, []);

  /** @param {import("../config/premiumV2Templates.js").PremiumV2Template[]} next */
  const saveTemplates = useCallback((next) => {
    writePremiumV2Templates(next);
    setTemplates(readPremiumV2Templates());
  }, []);

  const value = useMemo(
    () => ({
      premiumV2Enabled: enabled,
      premiumV2Templates: templates,
      setPremiumV2Templates: saveTemplates,
      resetPremiumV2Templates: resetTemplatesToDefaults,
    }),
    [enabled, templates, saveTemplates, resetTemplatesToDefaults]
  );

  return <PremiumV2Context.Provider value={value}>{children}</PremiumV2Context.Provider>;
}

export function usePremiumV2() {
  const ctx = useContext(PremiumV2Context);
  if (!ctx) {
    throw new Error("usePremiumV2 must be used within PremiumV2Provider");
  }
  return ctx;
}
