import { useId, type ReactNode } from "react";

/**
 * Label + control pairing.
 *
 * The id comes from `useId` so it is stable across renders and unique across
 * concurrent instances — a module-level counter would hand the same control a
 * new id on every render and break the label association.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  /** Receives the generated id so the control and its label stay associated. */
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
