import { useState } from "react";
import { useAppStore } from "@/store/AppStore";
import { EmptyState } from "@/components/EmptyState";
import { initials, pluralize } from "@/lib/format";

export function Reviewers() {
  const { reviewers, ratings, addReviewer, renameReviewer, deleteReviewer } = useAppStore();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addReviewer(name);
    setNewName("");
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const commitEdit = () => {
    if (editingId && editingName.trim()) renameReviewer(editingId, editingName);
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    // Deleting a reviewer removes their scorecards, which changes the average
    // of every burger they rated. That is a big enough consequence to name the
    // count explicitly rather than just asking "are you sure?".
    const affected = ratings.filter((r) => r.reviewerId === id).length;
    const detail =
      affected === 0
        ? ""
        : `\n\nThis also deletes ${pluralize(affected, "scorecard")} and will change the score of the burgers they rated.`;
    if (window.confirm(`Delete ${name}?${detail}`)) deleteReviewer(id);
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Reviewers</h1>
          <p className="page__subtitle">Everyone who rates burgers with you</p>
        </div>
      </header>

      <form className="row" onSubmit={handleAdd} style={{ marginBottom: "var(--space-5)" }}>
        <input
          className="field__control"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a reviewer"
          aria-label="New reviewer name"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit" className="btn btn--primary" disabled={!newName.trim()}>
          Add
        </button>
      </form>

      {reviewers.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="No reviewers yet"
          body="Add yourself first, then anyone you eat burgers with. You'll pick from this list each time you rate."
        />
      ) : (
        <ul className="stack--tight stack">
          {reviewers.map((reviewer) => {
            const count = ratings.filter((r) => r.reviewerId === reviewer.id).length;
            const isEditing = editingId === reviewer.id;
            return (
              <li key={reviewer.id} className="card card--pad row">
                <span className="avatar" aria-hidden="true">
                  {initials(reviewer.name)}
                </span>

                {isEditing ? (
                  <input
                    className="field__control"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    aria-label={`Rename ${reviewer.name}`}
                    autoFocus
                    enterKeyHint="done"
                  />
                ) : (
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="reviewer-pick__name">{reviewer.name}</span>
                    <span className="lb-card__meta">{pluralize(count, "burger")} rated</span>
                  </span>
                )}

                {!isEditing && (
                  <>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => startEdit(reviewer.id, reviewer.name)}
                    >
                      Rename
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      style={{ color: "var(--danger)" }}
                      onClick={() => handleDelete(reviewer.id, reviewer.name)}
                      aria-label={`Delete ${reviewer.name}`}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
