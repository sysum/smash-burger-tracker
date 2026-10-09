/**
 * Shown instead of the app when a deployed build has no backend configured.
 *
 * The alternative — which is what actually happened — is that the app falls
 * back to local storage and looks fine: no sign-in, a working add button, and
 * burgers saved into whichever browser typed them. Nobody can tell that from a
 * working deployment until they notice nothing is shared. A blank refusal is
 * much kinder than a convincing fake.
 *
 * Deliberately plain: it uses no store, no router, and no data, so it still
 * renders when the thing it is reporting on is exactly what is missing.
 */
export function ConfigError() {
  return (
    <div className="page">
      <div className="empty">
        <div className="empty__emoji" aria-hidden="true">
          ⚙️
        </div>
        <h1 className="empty__title">Not configured</h1>
        <p className="empty__body">
          This deployment has no database connected, so there is nothing to show
          and nothing you enter would be saved.
        </p>
        <p className="empty__body">
          Whoever deployed it needs to set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then redeploy — the values
          are read at build time, so an existing build will not pick them up.
        </p>
      </div>
    </div>
  );
}
