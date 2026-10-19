import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";

// A fast double click or tap on unselectable UI (buttons, dialog footers, disabled buttons that pass clicks
// through) otherwise makes the browser select the nearest text instead.
document.addEventListener("mousedown", (e) => {
  if (e.detail < 2 || !(e.target instanceof Element)) return;
  const style = getComputedStyle(e.target);
  if ((style.userSelect || style.webkitUserSelect) === "none") e.preventDefault();
}, true);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
