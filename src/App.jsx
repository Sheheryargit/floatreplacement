import { lazy, Suspense, cloneElement } from "react";
import { BrowserRouter, useLocation, useRoutes, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider, useAppTheme } from "./context/ThemeContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { AppDialogProvider } from "./context/AppDialogContext.jsx";
import { SlapAnimationProvider } from "./context/SlapAnimationContext.jsx";
import { AppDataProvider, useAppStore } from "./context/AppDataContext.jsx";
import AnimatedAppLoader from "./components/ui/AnimatedAppLoader.jsx";
import RouteSkeleton from "./components/ui/RouteSkeleton.jsx";
import PageTransition from "./components/ui/PageTransition.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import GlobalBackground from "./components/ui/GlobalBackground.jsx";
import { Toaster } from "sonner";

const CommandPalette = lazy(() => import("./components/command/CommandPalette.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const PeoplePage = lazy(() => import("./pages/PeoplePage.jsx"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));

function WorkspaceReady({ children }) {
  const ready = useAppStore((s) => s.workspaceReady);
  if (!ready) return <AnimatedAppLoader />;
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  const routes = [
    {
      path: "/",
      element: (
        <PageTransition>
          <LandingPage />
        </PageTransition>
      ),
    },
    {
      path: "/people",
      element: (
        <PageTransition>
          <PeoplePage />
        </PageTransition>
      ),
    },
    {
      path: "/projects",
      element: (
        <PageTransition>
          <ProjectsPage />
        </PageTransition>
      ),
    },
    {
      path: "/settings",
      element: (
        <PageTransition>
          <SettingsPage />
        </PageTransition>
      ),
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ];
  const element = useRoutes(routes, location);

  return (
    <Suspense fallback={<RouteSkeleton />}>
      <AnimatePresence mode="wait">
        {element && cloneElement(element, { key: location.pathname })}
      </AnimatePresence>
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
          borderRadius: "14px",
          fontSize: "13.5px",
          fontWeight: 600,
          fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
          backdropFilter: "blur(20px) saturate(1.2)",
          WebkitBackdropFilter: "blur(20px) saturate(1.2)",
          boxShadow:
            theme === "light"
              ? "0 12px 40px rgba(15,23,42,0.12), 0 0 0 1px rgba(0,0,0,0.04), 0 4px 16px rgba(0,194,168,0.06)"
              : "0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06), 0 0 40px rgba(0,194,168,0.08)",
          border:
            theme === "light"
              ? "1px solid rgba(0,0,0,0.06)"
              : "1px solid rgba(255,255,255,0.1)",
          padding: "14px 18px",
        },
      }}
    />
  );
}

export default function App() {
  return (
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
  );
}
