/**
 * Collision-resistant id generation.
 *
 * `crypto.randomUUID` needs a secure context. That covers https and localhost
 * on the web, and Capacitor's native origin, but not plain-http LAN testing
 * (e.g. opening the dev server on your phone via http://192.168.x.x), so fall
 * back to `getRandomValues` and finally to Math.random.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
