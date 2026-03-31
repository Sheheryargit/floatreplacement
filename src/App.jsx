import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import PeoplePage from "./pages/PeoplePage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-viewport">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
