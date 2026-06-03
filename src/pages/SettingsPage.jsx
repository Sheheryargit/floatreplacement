import { useCallback, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Sparkles,
  Eclipse,
  SunMedium,
  MoonStar,
  LayoutGrid,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import {
  ALLOCATION_BOX_STYLE_CHANGED_EVENT,
  ALLOCATION_BOX_STYLE_IDS,
  ALLOCATION_BOX_STYLE_LABELS,
  readAllocationBoxStyle,
  writeAllocationBoxStyle,
} from "../config/scheduleUiPrefs.js";
import { SettingsItem } from "../components/ui/SettingsItem.jsx";
import { ThemePreferenceControl } from "../components/ui/ThemePreferenceControl.jsx";
import { CanvasTintPreferenceControl } from "../components/ui/CanvasTintPreferenceControl.jsx";
import { SurfaceFinishPreferenceControl } from "../components/ui/SurfaceFinishPreferenceControl.jsx";
import "./SettingsPage.css";

const APPEARANCE_ICONS = [
  { Icon: Eclipse, delay: 0 },
  { Icon: SunMedium, delay: 0.12 },
  { Icon: MoonStar, delay: 0.24 },
];

export default function SettingsPage() {
  const reduceMotion = useReducedMotion();
  const {
    theme,
    themePreference,
    setThemePreference,
    canvasTintHex,
    setCanvasTintHex,
    surfaceFinish,
    setSurfaceFinish,
  } = useAppTheme();
  const { lock } = useAuth();
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const [allocationBoxStyle, setAllocationBoxStyle] = useState(() => readAllocationBoxStyle());

  const setAllocationBoxStylePreference = useCallback((next) => {
    setAllocationBoxStyle(next);
    writeAllocationBoxStyle(next);
  }, []);

  useEffect(() => {
    const sync = () => setAllocationBoxStyle(readAllocationBoxStyle());
    window.addEventListener(ALLOCATION_BOX_STYLE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ALLOCATION_BOX_STYLE_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (window.location.hash === "#profile" && profileRef.current) {
      profileRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const onLogout = useCallback(() => {
    lock();
    toast.success("Signed out", {
      description: "See you next time.",
      duration: 2800,
    });
    navigate("/", { replace: true });
  }, [lock, navigate]);

  return (
    <div className="settings-root" data-theme={theme === "light" ? "light" : "dark"}>
      <AppSideNav />

      <div className="settings-body">
        <main id="main-content" className="settings-main">
          <motion.header
            className="settings-hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="settings-hero-badge">
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              Workspace
            </div>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-lede">
              Personal display preferences for this browser—theme, surface finish, canvas tint, and how allocation tiles
              look on the schedule.
            </p>
          </motion.header>

          <section className="settings-section" aria-labelledby="settings-appearance">
            <h2 id="settings-appearance" className="settings-h2">
              Appearance
            </h2>
            <p className="settings-section-desc">
              Light, dark, or system theme, satin chrome across the app, and an optional canvas tint.
            </p>
            <p className="settings-local-privacy-note" role="note">
              Stored locally on this device—not shared with your team.
            </p>
            {!reduceMotion ? (
              <div className="settings-appearance-orbit" aria-hidden>
                {APPEARANCE_ICONS.map(({ Icon, delay }) => (
                  <motion.span
                    key={delay}
                    className="settings-appearance-orbit-node"
                    initial={{ opacity: 0.4, scale: 0.92 }}
                    animate={{
                      opacity: [0.45, 1, 0.45],
                      scale: [0.94, 1.05, 0.94],
                    }}
                    transition={{
                      duration: 2.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay,
                    }}
                  >
                    <Icon size={15} strokeWidth={2} />
                  </motion.span>
                ))}
              </div>
            ) : null}
            <div className="settings-card settings-card--glow settings-card--interactive">
              <SettingsItem label="Theme" subtext="Dark, light, or match system" showChevron={false}>
                <ThemePreferenceControl value={themePreference} onChange={setThemePreference} />
              </SettingsItem>
              <SettingsItem
                label="Surface finish"
                subtext="Satin lifts nav, schedule tray, people rows, modals, and tables with soft sheen."
                showChevron={false}
              >
                <SurfaceFinishPreferenceControl value={surfaceFinish} onChange={setSurfaceFinish} />
              </SettingsItem>
              <SettingsItem
                label="Canvas tint"
                subtext="Subtle wash behind navigation and schedule chrome"
                showChevron={false}
              >
                <CanvasTintPreferenceControl
                  value={canvasTintHex}
                  onChange={setCanvasTintHex}
                  theme={theme}
                />
              </SettingsItem>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-schedule">
            <h2 id="settings-schedule" className="settings-h2">
              Schedule tiles
            </h2>
            <p className="settings-section-desc">
              Pick how project blocks render on the schedule—borders, shadows, and layout.
            </p>
            <div className="settings-card settings-card--glow settings-card--interactive">
              <SettingsItem
                icon={LayoutGrid}
                label="Allocation block style"
                trailFullWidth
                subtext="Twelve presets — try Velvet, Luxe, Aurora, or Satin for a premium schedule look."
                showChevron={false}
              >
                <div className="settings-alloc-box-toggle" role="radiogroup" aria-label="Allocation block style">
                  {ALLOCATION_BOX_STYLE_IDS.map((id) => (
                    <motion.button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={allocationBoxStyle === id}
                      className={
                        "settings-alloc-box-btn" +
                        (allocationBoxStyle === id ? " settings-alloc-box-btn--active" : "")
                      }
                      onClick={() => setAllocationBoxStylePreference(id)}
                      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    >
                      {ALLOCATION_BOX_STYLE_LABELS[id] ?? id}
                    </motion.button>
                  ))}
                </div>
              </SettingsItem>
            </div>
          </section>

          <section
            className="settings-section"
            id="profile"
            ref={profileRef}
            aria-labelledby="settings-profile"
          >
            <h2 id="settings-profile" className="settings-h2">
              Account
            </h2>
            <div className="settings-card settings-card--glow settings-card--interactive">
              <SettingsItem
                icon={LogOut}
                label="Sign out"
                subtext="Ends this workspace session on this browser"
                showChevron
                onClick={onLogout}
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
