import { lazy, Suspense, cloneElement } from "react";
import { BrowserRouter, useLocation, useRoutes, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider, useAppTheme } from "./context/ThemeContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { AppDialogProvider } from "./context/AppDialogContext.jsx";
import { SlapAnimationProvider } from "./context/SlapAnimationContext.jsx";
import { AppDataProvider, useAppStore } from "./context/AppDataContext.jsx";
import AnimatedAppLoader from "./components/ui/AnimatedAppLoader.jsx";
import PageTransition from "./components/ui/PageTransition.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import CommandPalette from "./components/command/CommandPalette.jsx";
import { Toaster } from "sonner";

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
    <Suspense fallback={<AnimatedAppLoader />}>
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
          <CommandPalette />
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
      position="bottom-right"
      offset={16}
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
          borderRadius: "12px",
          fontSize: "13.5px",
          fontWeight: 600,
          fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
          backdropFilter: "blur(16px)",
          boxShadow:
            theme === "light"
              ? "0 8px 32px rgba(15,23,42,0.1), 0 2px 8px rgba(0,0,0,0.06)"
              : "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
          border:
            theme === "light"
              ? "1px solid rgba(0,0,0,0.06)"
              : "1px solid rgba(255,255,255,0.08)",
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
            <BrowserRouter>
              <AuthGate />
            </BrowserRouter>
          </AppDataProvider>
        </AppDialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
