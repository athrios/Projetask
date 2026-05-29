import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSpotlightTracker } from "./lib/spotlightTracker";

initSpotlightTracker();

createRoot(document.getElementById("root")!).render(<App />);
