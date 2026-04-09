import { lazy, Suspense } from "react";
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

const workspaceRoutes = [
  { path: "/", element: <LandingPage /> },
  { path: "/people", element: <PeoplePage /> },
  { path: "/projects", element: <ProjectsPage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];

function WorkspaceReady({ children }) {
  const ready = useAppStore((s) => s.workspaceReady);
  if (!ready) return <AnimatedAppLoader />;
  return children;
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
