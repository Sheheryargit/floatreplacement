import { useCallback, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HelpCircle,
  Bell,
  LogOut,
  Sparkles,
  Eclipse,
  SunMedium,
  MoonStar,
  Hexagon,
  Wand2,
  Rows3,
  Send,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSlapAnimation } from "../context/SlapAnimationContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import {
  PEAK_LOAD_LABELS_CHANGED_EVENT,
  readPeakLoadLabelsVisible,
  writePeakLoadLabelsVisible,
} from "../config/scheduleUiPrefs.js";
import { SettingsItem } from "../components/ui/SettingsItem.jsx";
import { ThemePreferenceControl } from "../components/ui/ThemePreferenceControl.jsx";
import { PalettePreferenceControl } from "../components/ui/PalettePreferenceControl.jsx";
import { CanvasTintPreferenceControl } from "../components/ui/CanvasTintPreferenceControl.jsx";
import { InviteMemberDialog } from "../components/InviteMemberDialog.jsx";
import "./SettingsPage.css";

const APPEARANCE_ICONS = [
  { Icon: Eclipse, delay: 0 },
  { Icon: SunMedium, delay: 0.12 },
  { Icon: MoonStar, delay: 0.24 },
  { Icon: Hexagon, delay: 0.36 },
  { Icon: Wand2, delay: 0.48 },
];

export default function SettingsPage() {
  const reduceMotion = useReducedMotion();
  const {
    theme,
    themePreference,
    setThemePreference,
    palette,
    setPalettePreference,
    canvasTintHex,
    setCanvasTintHex,
  } = useAppTheme();
  const { lock } = useAuth();
  const { triggerSlap } = useSlapAnimation();
  const { openDialog } = useAppDialog();
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const [peakLoadLabels, setPeakLoadLabels] = useState(() => readPeakLoadLabelsVisible());
  const [inviteOpen, setInviteOpen] = useState(false);

  const setPeakLoadLabelsPreference = useCallback((next) => {
    setPeakLoadLabels(next);
    writePeakLoadLabelsVisible(next);
  }, []);

  useEffect(() => {
    const sync = () => setPeakLoadLabels(readPeakLoadLabelsVisible());
    window.addEventListener(PEAK_LOAD_LABELS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PEAK_LOAD_LABELS_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (window.location.hash === "#profile" && profileRef.current) {
      profileRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const slapThen = useCallback(
    async (fn) => {
      await triggerSlap();
      fn();
    },
    [triggerSlap]
  );

  const onHelp = useCallback(() => {
    void slapThen(() =>
      openDialog({
        title: "😂 Need help?",
        message: "Contact Sheher on Slack.",
      })
    );
  }, [slapThen, openDialog]);

  const onNotifications = useCallback(() => {
    void slapThen(() =>
      openDialog({
        title: "🚧 Notifications are part of Version 2.",
        message: "Contact Sheher on Slack.",
      })
    );
  }, [slapThen, openDialog]);

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

      <main className="settings-main">
        <motion.header
          className="settings-hero"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="settings-hero-badge">
            <Sparkles size={14} strokeWidth={2} aria-hidden />
            Alloc8
          </div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-lede">Appearance, help, and workspace access.</p>
        </motion.header>

        <section className="settings-section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="settings-h2">
            Appearance
          </h2>
          <p className="settings-section-desc">
            Theme follows your device by default. Your choice is saved on this browser.
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
                    y: [0, -4, 0],
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
          <div className="settings-card settings-card--glow">
            <SettingsItem label="Theme" subtext="Dark, light, or match system" showChevron={false}>
              <ThemePreferenceControl value={themePreference} onChange={setThemePreference} />
            </SettingsItem>
            <SettingsItem
              label="Visual style"
              subtext="Studio uses Inter & Plus Jakarta Sans with higher-contrast surfaces"
              showChevron={false}
            >
              <PalettePreferenceControl value={palette} onChange={setPalettePreference} />
            </SettingsItem>
            <SettingsItem
              label="Canvas tint"
              subtext="Blends into the slide nav, schedule calendar, grids, reporting shell, and page backgrounds. Saved on this browser only."
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
            Schedule
          </h2>
          <p className="settings-section-desc">
            Saved in this browser only. Turn off to hide Underallocated, On target, and Overallocated on each
            person row.
          </p>
          <div className="settings-card settings-card--glow">
            <SettingsItem
              icon={Rows3}
              label="Peak load labels"
              subtext="Underallocated, On target, and Overallocated under each person when daily load is not on target."
              showChevron={false}
            >
              <div className="settings-peak-labels-toggle" role="group" aria-label="Peak load labels">
                <button
                  type="button"
                  className={
                    "settings-peak-labels-btn" + (!peakLoadLabels ? " settings-peak-labels-btn--active" : "")
                  }
                  aria-pressed={!peakLoadLabels}
                  onClick={() => setPeakLoadLabelsPreference(false)}
                >
                  Off
                </button>
                <button
                  type="button"
                  className={
                    "settings-peak-labels-btn" + (peakLoadLabels ? " settings-peak-labels-btn--active" : "")
                  }
                  aria-pressed={peakLoadLabels}
                  onClick={() => setPeakLoadLabelsPreference(true)}
                >
                  On
                </button>
              </div>
            </SettingsItem>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-team">
          <h2 id="settings-team" className="settings-h2">
            Team
          </h2>
          <p className="settings-section-desc">
            Super-admin only. Add people by email and set their role before they sign in. Delivery is still a
            placeholder.
          </p>
          <div className="settings-card settings-card--glow">
            <SettingsItem
              icon={Send}
              label="Invite team members"
              subtext="Opens a centered invite dialog — email, role, then send."
              showChevron
              onClick={() => setInviteOpen(true)}
            />
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-support">
          <h2 id="settings-support" className="settings-h2">
            Support
          </h2>
          <div className="settings-stack">
            <SettingsItem
              icon={HelpCircle}
              label="Need Help?"
              showChevron
              onClick={onHelp}
            />
            <SettingsItem
              icon={Bell}
              label="Notifications"
              subtext="Coming in V2"
              dim
              showChevron
              onClick={onNotifications}
            />
          </div>
        </section>

        <section
          className="settings-section"
          id="profile"
          ref={profileRef}
          aria-labelledby="settings-profile"
        >
          <h2 id="settings-profile" className="settings-h2">
            Profile
          </h2>
          <div className="settings-stack">
            <SettingsItem
              icon={LogOut}
              label="Logout"
              subtext="End this session on this device"
              showChevron
              onClick={onLogout}
            />
          </div>
        </section>
      </main>

      <InviteMemberDialog layout="full" open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
