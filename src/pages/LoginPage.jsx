import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./LoginPage.css";

const ACCESS_PASSWORD =
  import.meta.env.VITE_APP_ACCESS_PASSWORD || "Engineering1807";

export default function LoginPage() {
  const { theme } = useAppTheme();
  const { unlock } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(() => {
    const p = password.trim();
    if (!p) {
      setError("Enter your access password.");
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      return;
    }
    if (p !== ACCESS_PASSWORD) {
      setError("That password doesn’t match. Try again.");
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      return;
    }
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      unlock();
    }, 380);
  }, [password, unlock]);

  return (
    <div
      className="login-page"
      data-theme={theme === "light" ? "light" : "dark"}
    >
      <div className="login-page-bg" aria-hidden />
      <div className="login-page-grid" aria-hidden />
      <motion.div
        className="login-page-orb login-page-orb--a"
        aria-hidden
        animate={{ opacity: [0.35, 0.5, 0.35], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="login-page-orb login-page-orb--b"
        aria-hidden
        animate={{ opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="login-page-card"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: busy ? 0.98 : 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <motion.div
          className="login-page-brand"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 24 }}
        >
          <span className="alloc8-wordmark" aria-label="Alloc8">
            Alloc<span className="alloc8-wordmark-eight">8</span>
          </span>
        </motion.div>
        <h1 className="login-page-title">Welcome back</h1>
        <p className="login-page-sub">
          Enter the workspace password to continue to allocation and directory.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="login-page-field">
            <Lock size={18} strokeWidth={2} aria-hidden />
            <input
              type="password"
              className={`login-page-input${shake && error ? " login-page-input--error" : ""}`}
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
                setShake(false);
              }}
              onAnimationEnd={() => setShake(false)}
              autoComplete="current-password"
              autoFocus
              disabled={busy}
            />
          </div>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.p
                key="err"
                className="login-page-error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            ) : (
              <div className="login-page-error" aria-hidden />
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            className="login-page-submit"
            disabled={busy}
            whileHover={busy ? {} : { scale: 1.01 }}
            whileTap={busy ? {} : { scale: 0.99 }}
          >
            {busy ? (
              "Opening…"
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                Continue <ArrowRight size={18} strokeWidth={2.25} />
              </span>
            )}
          </motion.button>
        </form>

        <p className="login-page-footer">
          Alloc8
          <span className="login-page-tagline">Every person. Every project. In place.</span>
        </p>
      </motion.div>
    </div>
  );
}
