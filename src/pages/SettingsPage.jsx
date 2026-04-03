import { useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Bell, LogOut, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useSlapAnimation } from "../context/SlapAnimationContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { SettingsItem } from "../components/ui/SettingsItem.jsx";
import { ThemePreferenceControl } from "../components/ui/ThemePreferenceControl.jsx";
import "./SettingsPage.css";

export default function SettingsPage() {
  const { theme, themePreference, setThemePreference } = useAppTheme();
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
    toast.success("Signed out", {
      description: "See you next time.",
      duration: 2800,
    });
    navigate("/");
  }, [navigate]);

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
            Workspace
          </div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-lede">Appearance, help, and account.</p>
        </motion.header>

        <section className="settings-section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="settings-h2">
            Appearance
          </h2>
          <p className="settings-section-desc">
            Theme follows your device by default. Your choice is saved on this browser.
          </p>
          <div className="settings-card settings-card--glow">
            <SettingsItem label="Theme" subtext="Dark, light, or match system" showChevron={false}>
              <ThemePreferenceControl value={themePreference} onChange={setThemePreference} />
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
