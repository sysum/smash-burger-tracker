import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "@/App";
import { AppStoreProvider } from "@/store/AppStore";
import "@/styles/global.css";

/**
 * HashRouter rather than BrowserRouter.
 *
 * Deep links like /burger/abc need the host to rewrite unknown paths back to
 * index.html. That works on a configured web host but not from Capacitor's
 * local file origin when this is wrapped as a native app — the same build has
 * to work in both. Hash routing needs no server cooperation anywhere.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppStoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppStoreProvider>
  </StrictMode>,
);
