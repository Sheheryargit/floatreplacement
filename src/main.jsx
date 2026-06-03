import { createRoot } from "react-dom/client";
import "./index.css";
import { migrateAppearanceDefaultsToV2 } from "./config/appearancePrefsMigration.js";
import App from "./App.jsx";

migrateAppearanceDefaultsToV2();

createRoot(document.getElementById("root")).render(<App />);
