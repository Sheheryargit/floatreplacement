import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AppDataProvider } from "./context/AppDataContext.jsx";
import RouteSkeleton from "./components/ui/RouteSkeleton.jsx";

const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const PeoplePage = lazy(() => import("./pages/PeoplePage.jsx"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.jsx"));

export default function App() {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <BrowserRouter>
          <div className="app-viewport">
            <Suspense fallback={<RouteSkeleton />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
              </Routes>
            </Suspense>
          </div>
        </BrowserRouter>
      </AppDataProvider>
    </ThemeProvider>
  );
}
