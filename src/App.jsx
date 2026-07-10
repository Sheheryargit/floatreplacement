import React, { lazy, Suspense } from "react";
import { AppErrorFallback } from "./components/AppErrorFallback.jsx";
import { BrowserRouter, useLocation, useRoutes, Navigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ThemeProvider, useAppTheme } from "./context/ThemeContext.jsx";
import { CenterActionFeedbackProvider } from "./context/CenterActionFeedbackContext.jsx";
import { AuthProvider, useAuth, isPasswordWorkspaceGate } from "./context/AuthContext.jsx";
import { AppDialogProvider } from "./context/AppDialogContext.jsx";
import { PremiumV2Provider } from "./context/PremiumV2Context.jsx";
import { SlapAnimationProvider } from "./context/SlapAnimationContext.jsx";
import { AssistantProvider } from "./context/AssistantContext.jsx";
import { AssistantWorkflowProvider } from "./context/AssistantWorkflowContext.jsx";
import { AppDataProvider, useAppStore } from "./context/AppDataContext.jsx";
import { useAgentCrudHarnessRegistration } from "./lib/agentCrud/registerAgentCrudHarness.js";
import AnimatedAppLoader from "./components/ui/AnimatedAppLoader.jsx";
import RouteSkeleton from "./components/ui/RouteSkeleton.jsx";
import { isStaticUi } from "./config/uiMode.js";
import LoginPage from "./pages/LoginPage.jsx";
import AccessDeniedPage from "./pages/AccessDeniedPage.jsx";
import { SsoPersonProfileSync } from "./components/auth/SsoPersonProfileSync.jsx";
import { VercelAnalytics } from "./components/analytics/VercelAnalytics.jsx";
import GlobalBackground from "./components/ui/GlobalBackground.jsx";
import { Toaster } from "sonner";
import { AdminAllocationPulseHost } from "./components/admin/AdminAllocationPulse.jsx";
import "./styles/premium-overlays.css";

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
const Alloc8Assistant = lazy(() => import("./components/assistant/Alloc8Assistant.jsx"));
const AssistantHighlightLayer = lazy(() => import("./components/assistant/AssistantHighlightLayer.jsx"));
const AssistantGhostCursor = lazy(() => import("./components/assistant/AssistantGhostCursor.jsx"));
const AssistantTakeoverBar = lazy(() => import("./components/assistant/AssistantTakeoverBar.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const PeoplePage = lazy(() => import("./pages/PeoplePage.jsx"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const ReportingPage = lazy(() => import("./pages/ReportingPage.jsx"));
const DepartmentDashboardPage = lazy(() => import("./pages/DepartmentDashboardPage.jsx"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage.jsx"));
const StandupSetupPage = lazy(() => import("./pages/StandupSetupPage.jsx"));
const AccessPage = lazy(() => import("./pages/AccessPage.jsx"));

const workspaceRoutes = [
  { path: "/", element: <LandingPage /> },
  { path: "/people", element: <PeoplePage /> },
  { path: "/projects", element: <ProjectsPage /> },
  { path: "/departments", element: <DepartmentsPage /> },
  { path: "/standup", element: <StandupSetupPage /> },
  { path: "/report", element: <ReportingPage /> },
  { path: "/dept-dashboard", element: <DepartmentDashboardPage /> },
  { path: "/access", element: <AccessPage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];

function WorkspaceReady({ children }) {
  const ready = useAppStore((s) => s.workspaceReady);
  if (!ready) {
    return isStaticUi() ? <RouteSkeleton /> : <AnimatedAppLoader />;
  }
  return children;
}

/** Dev-only: registers agent CRUD smoke harness when VITE_AGENT_CRUD_TEST=true. */
function AgentCrudHarnessHost() {
  useAgentCrudHarnessRegistration();
  return null;
}

function AppErrorBoundaryShell({ error }) {
  return <AppErrorFallback error={error} />;
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
    return <AppErrorBoundaryShell error={this.state.error} />;
  }
}

function AnimatedRoutes() {
  const location = useLocation();
  const element = useRoutes(workspaceRoutes, location);
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <div
        key={location.pathname}
        className="app-route-shell alloc8-route-shell"
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

function SkipToMainLink() {
  return (
    <a href="#main-content" className="skip-to-main">
      Skip to main content
    </a>
  );
}

function WorkspaceAssistant() {
  const { isWorkspaceAdmin } = useAuth();
  const adminAssistant = isWorkspaceAdmin && !isPasswordWorkspaceGate();

  return (
    <AssistantProvider>
      <AssistantWorkflowProvider>
        <Suspense fallback={null}>
          <Alloc8Assistant />
          {adminAssistant ? (
            <>
              <AssistantHighlightLayer />
              <AssistantGhostCursor />
              <AssistantTakeoverBar />
            </>
          ) : null}
        </Suspense>
      </AssistantWorkflowProvider>
    </AssistantProvider>
  );
}

function AuthGate() {
  const { isAuthenticated, accessDenied } = useAuth();
  if (accessDenied) {
    return (
      <>
        <SkipToMainLink />
        <AccessDeniedPage />
        <ThemedToaster />
      </>
    );
  }
  if (!isAuthenticated) {
    return (
      <>
        <SkipToMainLink />
        <LoginPage />
        <ThemedToaster />
      </>
    );
  }
  return (
    <>
      <SkipToMainLink />
      <AdminAllocationPulseHost />
      <AppErrorBoundary>
        <WorkspaceReady>
          <AgentCrudHarnessHost />
          <SsoPersonProfileSync />
          <PremiumV2Provider>
            <SlapAnimationProvider>
              <Suspense fallback={null}>
                <CommandPalette />
              </Suspense>
              <div className="app-viewport">
                <AnimatedRoutes />
              </div>
              <Suspense fallback={null}>
                <WorkspaceAssistant />
              </Suspense>
            </SlapAnimationProvider>
          </PremiumV2Provider>
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
                <VercelAnalytics />
                <CenterActionFeedbackProvider>
                  <AuthGate />
                </CenterActionFeedbackProvider>
              </BrowserRouter>
            </AppDataProvider>
          </AppDialogProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
