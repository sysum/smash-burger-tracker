import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/AuthStore";

/**
 * Two-step email sign-in: request a code, then enter it.
 *
 * Only crew members have accounts — sign-ups are disabled in the dashboard —
 * so this screen deliberately offers no way to register. An unknown address
 * gets the same neutral confirmation as a known one, because telling a stranger
 * which addresses have accounts is a free gift to anyone probing.
 */
export function SignIn() {
  const { sendCode, verifyCode } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setStep("code");
    } catch (cause) {
      console.error("Failed to send sign-in code", cause);
      setError("Couldn't send a code. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, code);
      navigate("/", { replace: true });
    } catch (cause) {
      console.error("Failed to verify sign-in code", cause);
      setError("That code didn't work. It may have expired — request a new one.");
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <button className="topbar__back" onClick={() => navigate("/")}>
          ‹ Leaderboard
        </button>
      </div>

      <header className="page__header">
        <div>
          <h1 className="page__title">Sign in</h1>
          <p className="page__subtitle">
            {step === "email"
              ? "Anyone can browse the leaderboard. Signing in lets you add and rate burgers."
              : `Enter the six-digit code sent to ${email}.`}
          </p>
        </div>
      </header>

      {step === "email" ? (
        <form className="stack" onSubmit={handleSendCode}>
          <input
            className="field__control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            autoComplete="email"
            enterKeyHint="send"
            autoFocus
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!email.trim() || busy}
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={handleVerify}>
          <input
            className="field__control"
            // `inputMode` and `one-time-code` are what make a phone offer the
            // code straight from the notification instead of making the user
            // switch apps to read it.
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            aria-label="Six-digit code"
            enterKeyHint="done"
            autoFocus
          />
          <button type="submit" className="btn btn--primary" disabled={!code.trim() || busy}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Use a different address
          </button>
        </form>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--danger)", marginTop: "var(--space-4)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
