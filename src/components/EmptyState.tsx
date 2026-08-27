import type { ReactNode } from "react";

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__emoji" aria-hidden="true">
        {emoji}
      </span>
      <h2 className="empty__title">{title}</h2>
      <p className="empty__body">{body}</p>
      {action}
    </div>
  );
}
