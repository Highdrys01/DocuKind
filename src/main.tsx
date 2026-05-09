import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const moduleReloadKey = "docukind:module-reload";
const moduleFetchFailure = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

function recoverFromStaleModule(message: unknown): void {
  if (!moduleFetchFailure.test(String(message))) return;
  if (window.sessionStorage.getItem(moduleReloadKey)) return;

  window.sessionStorage.setItem(moduleReloadKey, String(Date.now()));
  window.location.reload();
}

window.addEventListener("error", (event) => recoverFromStaleModule(event.message));
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : event.reason;
  recoverFromStaleModule(reason);
});
window.addEventListener("load", () => {
  window.setTimeout(() => window.sessionStorage.removeItem(moduleReloadKey), 5_000);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
