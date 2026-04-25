import React, { lazy, Suspense } from "react";
import { BrowserRouter, useLocation, useRoutes, Navigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ThemeProvider, useAppTheme } from "./context/ThemeContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { AppDialogProvider } from "./context/AppDialogContext.jsx";
import { SlapAnimationProvider } from "./context/SlapAnimationContext.jsx";
import { AppDataProvider, useAppStore } from "./context/AppDataContext.jsx";
import AnimatedAppLoader from "./components/ui/AnimatedAppLoader.jsx";
import RouteSkeleton from "./components/ui/RouteSkeleton.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import GlobalBackground from "./components/ui/GlobalBackground.jsx";
import { Toaster } from "sonner";
import { isStaticUi } from "./config/uiMode.js";

/** Opaque toast shell — detailed fills live in index.css (.alloc8-toast). */
const toastShellStyle = {
  borderRadius: "14px",
  fontSize: "13.5px",
  fontWeight: 600,
  fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
  border: "1px solid var(--color-border)",
  padding: "14px 18px",
  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2)",
};

const CommandPalette = lazy(() => import("./components/command/CommandPalette.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const PeoplePage = lazy(() => import("./pages/PeoplePage.jsx"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const ReportingPage = lazy(() => import("./pages/ReportingPage.jsx"));

const workspaceRoutes = [
  { path: "/", element: <LandingPage /> },
  { path: "/people", element: <PeoplePage /> },
  { path: "/projects", element: <ProjectsPage /> },
  { path: "/report", element: <ReportingPage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];

function WorkspaceReady({ children }) {
  const ready = useAppStore((s) => s.workspaceReady);
  if (!ready) return <AnimatedAppLoader />;
  return children;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    // Keep console signal for debugging in dev.
    console.error("[alloc8] App crashed:", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || String(this.state.error);
    return (
      <div style={{ padding: 24, color: "var(--color-text, #fff)" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>App error</h2>
        <p style={{ opacity: 0.85, marginTop: 8, marginBottom: 0 }}>
          {msg}
        </p>
        {import.meta.env.DEV ? (
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", opacity: 0.75 }}>
            {this.state.error?.stack || ""}
          </pre>
        ) : null}
      </div>
    );
  }
}

function AnimatedRoutes() {
  const location = useLocation();
  const element = useRoutes(workspaceRoutes, location);
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <div
        key={location.pathname}
        className="app-route-shell"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {element}
      </div>
    </Suspense>
  );
}

function AuthGate() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <ThemedToaster />
      </>
    );
  }
  return (
    <>
      <AppErrorBoundary>
        <WorkspaceReady>
          <SlapAnimationProvider>
            <Suspense fallback={null}>
              <CommandPalette />
            </Suspense>
            <div className="app-viewport">
              <AnimatedRoutes />
            </div>
          </SlapAnimationProvider>
        </WorkspaceReady>
      </AppErrorBoundary>
      <ThemedToaster />
    </>
  );
}

function ThemedToaster() {
  const { theme } = useAppTheme();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      offset={{ top: 16, right: 16 }}
      richColors
      closeButton
      expand
      visibleToasts={5}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "alloc8-toast",
        },
        style: {
          ...toastShellStyle,
          boxShadow:
            theme === "light"
              ? "0 12px 36px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06)"
              : toastShellStyle.boxShadow,
        },
      }}
    />
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion={isStaticUi() ? "always" : "user"}>
      <ThemeProvider>
        <AuthProvider>
          <AppDialogProvider>
            <AppDataProvider>
              <GlobalBackground />
              <BrowserRouter>
                <AuthGate />
              </BrowserRouter>
            </AppDataProvider>
          </AppDialogProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
