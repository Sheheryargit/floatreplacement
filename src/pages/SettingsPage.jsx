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
  LayoutGrid,
  Spline,
  Keyboard,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSlapAnimation } from "../context/SlapAnimationContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import {
  ALLOCATION_BOX_STYLE_CHANGED_EVENT,
  ALLOCATION_BOX_STYLE_IDS,
  ALLOCATION_BOX_STYLE_LABELS,
  ALLOCATION_ENTER_ANIM_CHANGED_EVENT,
  ALLOCATION_ENTER_ANIM_IDS,
  ALLOCATION_ENTER_ANIM_LABELS,
  PEAK_LOAD_LABELS_CHANGED_EVENT,
  readAllocationBoxStyle,
  readAllocationEnterAnimation,
  readPeakLoadLabelsVisible,
  writeAllocationBoxStyle,
  writeAllocationEnterAnimation,
  writePeakLoadLabelsVisible,
} from "../config/scheduleUiPrefs.js";
import {
  PREMIUM_V2_CHANGED_EVENT,
  readPremiumV2Enabled,
  writePremiumV2Enabled,
} from "../config/premiumV2Prefs.js";
import { resetPremiumV2Templates } from "../config/premiumV2Templates.js";
import { SettingsItem } from "../components/ui/SettingsItem.jsx";
import { ThemePreferenceControl } from "../components/ui/ThemePreferenceControl.jsx";
import { PalettePreferenceControl } from "../components/ui/PalettePreferenceControl.jsx";
import { CanvasTintPreferenceControl } from "../components/ui/CanvasTintPreferenceControl.jsx";
import { InviteMemberDialog } from "../components/InviteMemberDialog.jsx";
import { SettingsSchedulePreview } from "../components/settings/SettingsSchedulePreview.jsx";
import { SupportSlackModal } from "../components/support/SupportSlackModal.jsx";
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
  const [allocationBoxStyle, setAllocationBoxStyle] = useState(() => readAllocationBoxStyle());
  const [allocationEnterAnim, setAllocationEnterAnim] = useState(() => readAllocationEnterAnimation());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [premiumV2, setPremiumV2] = useState(() => readPremiumV2Enabled());
  const [supportOpen, setSupportOpen] = useState(false);

  const setPremiumV2Preference = useCallback((next) => {
    setPremiumV2(next);
    writePremiumV2Enabled(next);
  }, []);

  const setPeakLoadLabelsPreference = useCallback((next) => {
    setPeakLoadLabels(next);
    writePeakLoadLabelsVisible(next);
  }, []);

  const setAllocationBoxStylePreference = useCallback((next) => {
    setAllocationBoxStyle(next);
    writeAllocationBoxStyle(next);
  }, []);

  const setAllocationEnterAnimPreference = useCallback((next) => {
    setAllocationEnterAnim(next);
    writeAllocationEnterAnimation(next);
  }, []);

  useEffect(() => {
    const sync = () => setPeakLoadLabels(readPeakLoadLabelsVisible());
    window.addEventListener(PEAK_LOAD_LABELS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PEAK_LOAD_LABELS_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const sync = () => setAllocationBoxStyle(readAllocationBoxStyle());
    window.addEventListener(ALLOCATION_BOX_STYLE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ALLOCATION_BOX_STYLE_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const sync = () => setAllocationEnterAnim(readAllocationEnterAnimation());
    window.addEventListener(ALLOCATION_ENTER_ANIM_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ALLOCATION_ENTER_ANIM_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const sync = () => setPremiumV2(readPremiumV2Enabled());
    window.addEventListener(PREMIUM_V2_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PREMIUM_V2_CHANGED_EVENT, sync);
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
    void slapThen(() => setSupportOpen(true));
  }, [slapThen]);

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
      <SupportSlackModal
        open={supportOpen}
        onOpenChange={setSupportOpen}
        slackUrl="https://app.slack.com/client/T02879QRU/C0B68PYE3EZ"
        title="Need help?"
        subtitle="Jump into Slack support and drop a message — we’ll take it from there."
      />

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
            Alloc8
          </div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-lede">Appearance, help, and workspace preferences.</p>
        </motion.header>

        <section className="settings-section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="settings-h2">
            Appearance
          </h2>
          <p className="settings-section-desc settings-appearance-lede">
            New sign-ins default to light mode, Studio typography, and Pill allocation tiles; you can match your OS, swap palette, light/dark, or tint the canvas—all personal tweaks.
          </p>
          <p className="settings-local-privacy-note" role="note">
            Stored only on this browser—nothing here is synced to teammates or uploaded as workspace preferences.
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
              subtext="Tint behind nav, grids, reporting shell, and page backgrounds—not shared with teammates."
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
            Saved on this browser only. Timeline defaults start at the Pill preset for colored project blocks until
            you pick another; peak-load bands and animations are yours to tune. Teammates don’t inherit these
            display choices—they keep their own.
          </p>
          <div className="settings-card settings-card--glow">
            <SettingsItem
              icon={LayoutGrid}
              label="Allocation blocks"
              trailFullWidth
              subtext={
                <>
                  Choose how colored project tiles look on the schedule. Eight presets: borders, shadows,
                  corners, and one layout (Center hrs) with large centered hours.
                  <span className="settings-subtext-detail">
                    Center hrs scales the hours type with tile height and keeps project name and code above
                    and below.
                  </span>
                </>
              }
              showChevron={false}
            >
              <div className="settings-alloc-box-toggle" role="radiogroup" aria-label="Allocation block style">
                {ALLOCATION_BOX_STYLE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={allocationBoxStyle === id}
                    className={
                      "settings-alloc-box-btn" +
                      (allocationBoxStyle === id ? " settings-alloc-box-btn--active" : "")
                    }
                    onClick={() => setAllocationBoxStylePreference(id)}
                  >
                    {ALLOCATION_BOX_STYLE_LABELS[id] ?? id}
                  </button>
                ))}
              </div>
            </SettingsItem>
            <SettingsItem
              icon={Spline}
              label="New allocation arrival"
              trailFullWidth
              subtext={
                <>
                  Plays once when you save a new project block—not on reload.{" "}
                  <em>Slow drift</em> floats in like availability chips; Ribbon reel grows from the left edge.
                  <span className="settings-subtext-detail">
                    Respects reduced motion & low‑GPU overrides in your browser/OS.
                  </span>
                </>
              }
              showChevron={false}
            >
              <div
                className="settings-alloc-enter-toggle settings-alloc-box-toggle"
                role="radiogroup"
                aria-label="New allocation animation"
              >
                {ALLOCATION_ENTER_ANIM_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={allocationEnterAnim === id}
                    className={
                      "settings-alloc-box-btn settings-alloc-enter-btn" +
                      (allocationEnterAnim === id ? " settings-alloc-box-btn--active" : "")
                    }
                    onClick={() => setAllocationEnterAnimPreference(id)}
                  >
                    {ALLOCATION_ENTER_ANIM_LABELS[id] ?? id}
                  </button>
                ))}
              </div>
            </SettingsItem>
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
            <SettingsItem
              icon={Keyboard}
              label="Schedule v2 (experimental)"
              trailFullWidth
              subtext={
                <>
                  Shortcut help on ?, command palette focus on /. Undo chip after saving new allocations / leave.
                  Suggested hours from recent allocations, template presets in create, richer public-holiday hints,
                  a compact peak-day hint under names when peak labels are off, and a checklist banner when filtered
                  people have no project blocks yet.
                  <span className="settings-subtext-detail">Saved only in this browser.</span>
                </>
              }
              showChevron={false}
            >
              <div className="settings-peak-labels-toggle" role="group" aria-label="Schedule v2 experimental mode">
                <button
                  type="button"
                  className={
                    "settings-peak-labels-btn" + (!premiumV2 ? " settings-peak-labels-btn--active" : "")
                  }
                  aria-pressed={!premiumV2}
                  onClick={() => setPremiumV2Preference(false)}
                >
                  Off
                </button>
                <button
                  type="button"
                  className={
                    "settings-peak-labels-btn" + (premiumV2 ? " settings-peak-labels-btn--active" : "")
                  }
                  aria-pressed={premiumV2}
                  onClick={() => setPremiumV2Preference(true)}
                >
                  On
                </button>
              </div>
            </SettingsItem>
            <SettingsItem
              label="V2 allocation templates"
              trailFullWidth
              subtext="Resets bundled hour and repeat presets (Standard 7.5h, weekly, etc.)."
              showChevron={false}
            >
              <button
                type="button"
                className="settings-alloc-box-btn settings-alloc-box-btn--active"
                style={{ justifySelf: "start" }}
                onClick={() => {
                  resetPremiumV2Templates();
                  toast.success("Templates reset", { description: "Create-allocation quick picks restored." });
                }}
              >
                Reset bundled templates
              </button>
            </SettingsItem>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-team">
          <h2 id="settings-team" className="settings-h2">
            Team
          </h2>
          <p className="settings-section-desc">
            Add people by email before they sign in. Delivery is still a placeholder.
          </p>
          <div className="settings-card settings-card--glow">
            <SettingsItem
              icon={Send}
              label="Invite team members"
              subtext="Opens a centered invite dialog — email, then send."
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
              subtext="Ends this workspace session here. Signing in stays on this browser only—you don’t share a login with teammates."
              showChevron
              onClick={onLogout}
            />
          </div>
        </section>
      </main>

      <aside className="settings-preview-aside" aria-label="Schedule preview">
        <SettingsSchedulePreview
          allocationBoxStyle={allocationBoxStyle}
          peakLoadLabels={peakLoadLabels}
          onAllocationBoxStyleChange={setAllocationBoxStylePreference}
        />
      </aside>
      </div>

      <InviteMemberDialog layout="full" open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
