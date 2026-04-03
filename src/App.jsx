import { lazy, Suspense, cloneElement } from "react";
import { BrowserRouter, useLocation, useRoutes, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider, useAppTheme } from "./context/ThemeContext.jsx";
import { AppDataProvider, useAppStore } from "./context/AppDataContext.jsx";
import AnimatedAppLoader from "./components/ui/AnimatedAppLoader.jsx";
import PageTransition from "./components/ui/PageTransition.jsx";
import { Toaster } from "sonner";

const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const PeoplePage = lazy(() => import("./pages/PeoplePage.jsx"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.jsx"));

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

function ThemedToaster() {
  const { theme } = useAppTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      expand
      visibleToasts={5}
      toastOptions={{
        style: {
          borderRadius: "14px",
          fontSize: "13.5px",
          fontWeight: 500,
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          backdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
          border: theme === "light"
            ? "1px solid rgba(0,0,0,0.06)"
            : "1px solid rgba(255,255,255,0.08)",
          padding: "14px 18px",
        },
        className: "float-toast",
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <BrowserRouter>
          <WorkspaceReady>
            <div className="app-viewport">
              <AnimatedRoutes />
            </div>
            <ThemedToaster />
          </WorkspaceReady>
        </BrowserRouter>
      </AppDataProvider>
    </ThemeProvider>
  );
}
