import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "@/App";
import { ConfigError } from "@/components/ConfigError";
import { isMisconfigured } from "@/lib/supabase";
import { AppStoreProvider } from "@/store/AppStore";
import { AuthStoreProvider } from "@/store/AuthStore";
import "@/styles/global.css";

/**
 * HashRouter rather than BrowserRouter.
 *
 * Deep links like /burger/abc need the host to rewrite unknown paths back to
 * index.html. That works on a configured web host but not from Capacitor's
 * local file origin when this is wrapped as a native app — the same build has
 * to work in both. Hash routing needs no server cooperation anywhere.
 */
const root = createRoot(document.getElementById("root")!);

// Checked before anything mounts. The stores would otherwise come up in
// local-storage mode and the app would render as a convincing, useless copy of
// itself. See lib/supabase.ts for when this is and isn't an error.
if (isMisconfigured) {
  root.render(
    <StrictMode>
      <ConfigError />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <AuthStoreProvider>
        <AppStoreProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </AppStoreProvider>
      </AuthStoreProvider>
    </StrictMode>,
  );
}
