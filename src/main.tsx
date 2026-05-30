import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { captureFirstTouch, emitEvent } from "@/lib/attribution";

// Preload critical images immediately on app start
import fractionlIcon from "@/assets/fractionl-icon.png";
import fractionlLogo from "@/assets/fractionl-logo.png";

const preloadImages = [fractionlIcon, fractionlLogo];
preloadImages.forEach((src) => {
  const img = new Image();
  img.src = src;
});

// Capture first-touch attribution (UTM, referrer, landing path) and record the
// landing. Both no-op safely until the OS warehouse ingest is wired.
captureFirstTouch();
void emitEvent("landed");

createRoot(document.getElementById("root")!).render(<App />);
