import { useCallback, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import "./AppErrorFallback.css";

export function AppErrorFallback({ error }) {
  const { theme } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const msg = error?.message || String(error);
  const stack = import.meta.env.DEV && error?.stack ? String(error.stack) : "";

  const onReload = useCallback(() => {
    window.location.reload();
  }, []);

  const onCopy = useCallback(async () => {
    const text = stack ? `${msg}\n\n${stack}` : msg;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [msg, stack]);

  return (
    <div
      className="app-error-fallback"
      data-theme={theme === "light" ? "light" : "dark"}
      role="alert"
    >
      <div className="app-error-fallback__card">
        <p className="app-error-fallback__eyebrow">Something went wrong</p>
        <h1 className="app-error-fallback__title">Alloc8 hit an unexpected error</h1>
        <p className="app-error-fallback__lede">
          Your data is safe on the server. Reload the app to continue. If this keeps happening,
          share the details below with your admin.
        </p>
        <p className="app-error-fallback__msg">{msg}</p>
        {stack ? (
          <pre className="app-error-fallback__stack">
            <code>{stack}</code>
          </pre>
        ) : null}
        <div className="app-error-fallback__actions">
          <Button type="button" variant="primary" size="md" onClick={onReload}>
            Reload app
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={onCopy}>
            {copied ? "Copied" : "Copy details"}
          </Button>
        </div>
      </div>
    </div>
  );
}
