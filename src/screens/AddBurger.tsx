import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field } from "@/components/Field";
import { RatingRow } from "@/components/RatingRow";
import { ScoreBadge } from "@/components/ScoreBadge";
import { useAppStore, type VisitDraft } from "@/store/AppStore";
import { compressImage } from "@/lib/photos";
import { newId } from "@/lib/id";
import { repository } from "@/lib/repository";
import { formatHundred, parsePrice, todayIso } from "@/lib/format";
import {
  CATEGORIES,
  emptyCategoryScores,
  weightedScore,
  type CategoryScores,
} from "@/lib/scoring";
import type { RatingValue } from "@/types";

type Step = "details" | "reviewers" | "rate";

export function AddBurger() {
  const navigate = useNavigate();
  const { reviewers, addReviewer, addVisit } = useAppStore();

  const [step, setStep] = useState<Step>("details");

  // Step 1 — the burger itself.
  const [restaurantName, setRestaurantName] = useState("");
  const [burgerName, setBurgerName] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(todayIso);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  // Blob and its preview URL are kept together so the two can never drift.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Step 2 — who ate it.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickName, setQuickName] = useState("");

  // Step 3 — the scorecards, keyed by reviewer id.
  const [scorecards, setScorecards] = useState<Record<string, CategoryScores>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  /**
   * Every object URL pins its blob in memory until revoked. The URL is created
   * and revoked in the event handlers below — the places where the photo
   * actually changes — rather than in an effect keyed on the blob, which would
   * revoke and recreate on StrictMode's development remount and leave the
   * preview pointing at a dead URL. This ref covers the one case the handlers
   * cannot: abandoning the draft while a photo is selected.
   */
  const liveObjectUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (liveObjectUrl.current) URL.revokeObjectURL(liveObjectUrl.current);
    },
    [],
  );

  const selectedReviewers = useMemo(
    () => selectedIds.map((id) => reviewers.find((r) => r.id === id)).filter((r) => r !== undefined),
    [selectedIds, reviewers],
  );

  const canContinueDetails = restaurantName.trim().length > 0;

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const blob = await compressImage(file);
    if (photo) URL.revokeObjectURL(photo.url);
    const url = URL.createObjectURL(blob);
    liveObjectUrl.current = url;
    setPhoto({ blob, url });
    // Clear the input so picking the same file twice still fires a change.
    event.target.value = "";
  };

  const removePhoto = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    liveObjectUrl.current = null;
    setPhoto(null);
  };

  const toggleReviewer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleQuickAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const name = quickName.trim();
    if (!name) return;
    const reviewer = addReviewer(name);
    setSelectedIds((prev) => [...prev, reviewer.id]);
    setQuickName("");
  };

  const startRating = () => {
    // Seed a blank scorecard per selected reviewer, preserving any already
    // entered if the user steps back and forth.
    setScorecards((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) next[id] ??= emptyCategoryScores();
      return next;
    });
    setActiveIndex(0);
    setStep("rate");
  };

  const setScore = (reviewerId: string, key: keyof CategoryScores, value: RatingValue) => {
    setScorecards((prev) => ({
      ...prev,
      [reviewerId]: { ...prev[reviewerId], [key]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let photoId: string | null = null;
      if (photo) {
        // Written only now, on save, so an abandoned draft never leaves an
        // orphaned blob behind in storage.
        photoId = newId();
        await repository.putPhoto(photoId, photo.blob);
      }

      const draft: VisitDraft = {
        restaurantName: restaurantName.trim(),
        burgerName: burgerName.trim(),
        location: location.trim(),
        date,
        price: parsePrice(price),
        notes: notes.trim(),
        photoId,
      };

      const visitId = await addVisit(
        draft,
        selectedIds.map((reviewerId) => ({ reviewerId, scores: scorecards[reviewerId] })),
      );
      navigate(`/burger/${visitId}`, { replace: true });
    } catch (error) {
      console.error("Failed to save burger", error);
      window.alert("Something went wrong saving this burger. Please try again.");
      setSaving(false);
    }
  };

  const stepIndex = step === "details" ? 0 : step === "reviewers" ? 1 : 2;

  return (
    <div className="page">
      <div className="topbar">
        <button
          className="topbar__back"
          onClick={() => {
            if (step === "rate") setStep("reviewers");
            else if (step === "reviewers") setStep("details");
            else navigate("/");
          }}
        >
          ‹ {step === "details" ? "Cancel" : "Back"}
        </button>
      </div>

      <div className="steps" aria-label={`Step ${stepIndex + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`steps__dot${i <= stepIndex ? " steps__dot--done" : ""}`} />
        ))}
      </div>

      {step === "details" && (
        <>
          <h1 className="page__title" style={{ marginBottom: "var(--space-5)" }}>
            New burger
          </h1>

          <div className="stack--loose stack">
            <Field label="Restaurant">
              {(id) => (
                <input
                  id={id}
                  className="field__control"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Burger Shop"
                  autoComplete="off"
                  enterKeyHint="next"
                />
              )}
            </Field>

            <Field label="Burger">
              {(id) => (
                <input
                  id={id}
                  className="field__control"
                  value={burgerName}
                  onChange={(e) => setBurgerName(e.target.value)}
                  placeholder="Double Smash"
                  autoComplete="off"
                  enterKeyHint="next"
                />
              )}
            </Field>

            <Field label="Location">
              {(id) => (
                <input
                  id={id}
                  className="field__control"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Costa Mesa, CA"
                  autoComplete="off"
                />
              )}
            </Field>

            <div className="field-row">
              <Field label="Date">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    className="field__control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                )}
              </Field>

              <Field label="Price">
                {(id) => (
                  <input
                    id={id}
                    className="field__control"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="$12.50"
                    // Numeric keypad without the spinner arrows and locale
                    // parsing headaches of type="number".
                    inputMode="decimal"
                    autoComplete="off"
                  />
                )}
              </Field>
            </div>

            <div className="field">
              <span className="field__label">Photo</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                hidden
              />
              {photo ? (
                <div className="photo-wrap">
                  <img className="photo" src={photo.url} alt="The burger" />
                  <button
                    className="photo-wrap__remove"
                    onClick={removePhoto}
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button className="photo-picker" onClick={() => fileInput.current?.click()}>
                  <span style={{ fontSize: 28 }} aria-hidden="true">
                    📷
                  </span>
                  <span>Add a photo</span>
                </button>
              )}
            </div>

            <Field label="Notes">
              {(id) => (
                <textarea
                  id={id}
                  className="field__control"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Crispy edges, great crust. Bun a little dry."
                />
              )}
            </Field>
          </div>

          <div className="action-bar">
            <button
              className="btn btn--primary btn--block"
              disabled={!canContinueDetails}
              onClick={() => setStep("reviewers")}
            >
              Continue
            </button>
          </div>
        </>
      )}

      {step === "reviewers" && (
        <>
          <h1 className="page__title">Who's rating?</h1>
          <p className="page__subtitle" style={{ marginBottom: "var(--space-5)" }}>
            Each person gets their own scorecard.
          </p>

          <div className="stack--tight stack">
            {reviewers.map((reviewer) => {
              const selected = selectedIds.includes(reviewer.id);
              return (
                <button
                  key={reviewer.id}
                  className="reviewer-pick"
                  aria-pressed={selected}
                  onClick={() => toggleReviewer(reviewer.id)}
                >
                  <span className="reviewer-pick__name">{reviewer.name}</span>
                  <span className="reviewer-pick__check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              );
            })}
          </div>

          <form className="row" onSubmit={handleQuickAdd} style={{ marginTop: "var(--space-4)" }}>
            <input
              className="field__control"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="Add someone new"
              aria-label="Add a new reviewer"
              autoComplete="off"
              enterKeyHint="done"
            />
            <button type="submit" className="btn btn--secondary" disabled={!quickName.trim()}>
              Add
            </button>
          </form>

          <div className="action-bar">
            <button
              className="btn btn--primary btn--block"
              disabled={selectedIds.length === 0}
              onClick={startRating}
            >
              {selectedIds.length === 0
                ? "Pick at least one reviewer"
                : `Rate with ${selectedIds.length}`}
            </button>
          </div>
        </>
      )}

      {step === "rate" && selectedReviewers.length > 0 && (
        <RateStep
          reviewers={selectedReviewers}
          scorecards={scorecards}
          activeIndex={activeIndex}
          saving={saving}
          onSetScore={setScore}
          onActiveIndexChange={setActiveIndex}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function RateStep({
  reviewers,
  scorecards,
  activeIndex,
  saving,
  onSetScore,
  onActiveIndexChange,
  onSave,
}: {
  reviewers: { id: string; name: string }[];
  scorecards: Record<string, CategoryScores>;
  activeIndex: number;
  saving: boolean;
  onSetScore: (reviewerId: string, key: keyof CategoryScores, value: RatingValue) => void;
  onActiveIndexChange: (index: number) => void;
  onSave: () => void;
}) {
  const reviewer = reviewers[activeIndex];
  const scores = scorecards[reviewer.id] ?? emptyCategoryScores();
  const score = weightedScore(scores);
  const isLast = activeIndex === reviewers.length - 1;

  return (
    <>
      {/* Sticky so the running score stays visible while the categories are
          tapped through — the spec's "show the calculated score live". */}
      <div className="live-score">
        <div className="live-score__who">
          <div className="live-score__name">{reviewer.name}</div>
          <div className="live-score__step">
            Reviewer {activeIndex + 1} of {reviewers.length}
          </div>
        </div>
        <div>
          <ScoreBadge score={score} size="sm" />
          <div className="live-score__out-of-100">{formatHundred(score)} / 100</div>
        </div>
      </div>

      <div style={{ marginTop: "var(--space-2)" }}>
        {CATEGORIES.map(({ key, label, weight }) => (
          <RatingRow
            key={key}
            categoryKey={key}
            label={label}
            weight={weight}
            value={scores[key]}
            onChange={(category, value) => onSetScore(reviewer.id, category, value)}
          />
        ))}
      </div>

      {reviewers.length > 1 && (
        <div className="chips" style={{ marginTop: "var(--space-4)" }}>
          {reviewers.map((r, index) => (
            <button
              key={r.id}
              className="chip"
              aria-pressed={index === activeIndex}
              onClick={() => onActiveIndexChange(index)}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      <div className="action-bar">
        {isLast ? (
          <button className="btn btn--primary btn--block" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save burger"}
          </button>
        ) : (
          <button
            className="btn btn--primary btn--block"
            onClick={() => onActiveIndexChange(activeIndex + 1)}
          >
            Next: {reviewers[activeIndex + 1].name}
          </button>
        )}
      </div>
    </>
  );
}
