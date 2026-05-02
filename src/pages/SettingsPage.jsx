import { useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Bell, LogOut, Sparkles, Eclipse, SunMedium, MoonStar, Hexagon, Wand2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSlapAnimation } from "../context/SlapAnimationContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { SettingsItem } from "../components/ui/SettingsItem.jsx";
import { ThemePreferenceControl } from "../components/ui/ThemePreferenceControl.jsx";
import { PalettePreferenceControl } from "../components/ui/PalettePreferenceControl.jsx";
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
  const { theme, themePreference, setThemePreference, palette, setPalettePreference } = useAppTheme();
  const { lock } = useAuth();
  const { triggerSlap } = useSlapAnimation();
  const { openDialog } = useAppDialog();
  const navigate = useNavigate();
  const profileRef = useRef(null);

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
    </div>
  );
}
