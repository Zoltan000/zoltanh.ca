import { useCallback, useEffect, useMemo, useState } from "react";
import { getRecipes, getState, submitRecipe, MOCK } from "./api";
import type { Ingredient, RecipeBook, RecipeEntry, RosterEntry } from "./types";

/* Same key the vote page uses, so someone who already tapped their name to
   vote never has to identify themselves twice. */
const LS_VOTER = "vote.voterId";

/** Rows the editor opens with — enough for a simple drink without scrolling. */
const START_ROWS = 4;

const BLANK: Ingredient = { name: "", amount: "", unit: "" };

function ls(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function Masthead({ sub }: { sub: string }) {
  return (
    <header className="masthead">
      <div className="kicker">Mixology Night</div>
      <h1 style={{ fontSize: 34 }}>Recipes</h1>
      <div className="dateline">{sub}</div>
    </header>
  );
}

/* ── browse ──────────────────────────────────────────────────────────────
   Every drink is listed whether or not its team has written anything down,
   so an empty row reads as "not submitted yet" rather than the drink being
   missing. Teams are deliberately NOT shown — who made what stays secret
   until the results are revealed. */

function Browse({ book }: { book: RecipeBook }) {
  const filled = book.recipes.filter((r) => r.ingredients.length || r.notes).length;

  return (
    <>
      <p className="text-muted" style={{ fontSize: 14, textAlign: "center" }}>
        {filled} of {book.recipes.length} recipes written up. Tap one to open it.
      </p>

      <div style={{ marginTop: "var(--space-4)" }}>
        {book.recipes.map((r) => (
          <RecipeRow key={r.drinkId} recipe={r} />
        ))}
      </div>
    </>
  );
}

function RecipeRow({ recipe }: { recipe: RecipeEntry }) {
  const empty = !recipe.ingredients.length && !recipe.notes;

  return (
    <details className="disclosure">
      <summary>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18 }}>
          {recipe.name}
        </span>
        <span
          className="text-muted text-tiny"
          style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}
        >
          {empty ? "not yet" : `${recipe.ingredients.length} ingredients`}
          <svg className="chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 5.5 L7 9.5 L11 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </summary>

      <div style={{ padding: "var(--space-3) 0" }}>
        {empty ? (
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            This team hasn't written theirs up yet.
          </p>
        ) : (
          <>
            {recipe.ingredients.map((ing, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "var(--space-2)",
                  padding: "5px 0",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <span style={{ flex: 1 }}>{ing.name}</span>
                <span
                  className="text-muted"
                  style={{ flex: "none", fontVariantNumeric: "tabular-nums", fontSize: 14 }}
                >
                  {[ing.amount, ing.unit].filter(Boolean).join(" ")}
                </span>
              </div>
            ))}
            {recipe.notes && (
              <p style={{ fontSize: 15, marginTop: "var(--space-3)", marginBottom: 0 }}>
                {recipe.notes}
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

/* ── editor ──────────────────────────────────────────────────────────── */

function Editor({
  book,
  person,
  drinkName,
  onSaved,
  onSignOut,
}: {
  book: RecipeBook;
  person: RosterEntry;
  drinkName: string;
  onSaved: (next: RecipeBook) => void;
  onSignOut: () => void;
}) {
  const existing = book.recipes.find((r) => r.drinkId === person.drinkId);

  const [rows, setRows] = useState<Ingredient[]>(() => {
    const start = existing?.ingredients.length ? existing.ingredients.map((i) => ({ ...i })) : [];
    while (start.length < START_ROWS) start.push({ ...BLANK });
    return start;
  });
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setRow(index: number, patch: Partial<Ingredient>) {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...BLANK }]);
  }

  function removeRow(index: number) {
    setSaved(false);
    // Never drop to zero rows — an empty form with no fields looks broken.
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ ...BLANK }]));
  }

  const usable = rows.filter((r) => r.name.trim());

  async function save() {
    if (busy) return;
    if (!usable.length) {
      setError("Add at least one ingredient.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await submitRecipe(person.id, usable, notes.trim());
      onSaved(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-kicker">Writing up</div>
        <div className="card-title">{drinkName}</div>
        <div className="card-meta">
          Signed in as {person.name}
          <button
            className="btn btn-ghost"
            style={{ minHeight: 28, fontSize: 12, padding: "0 6px" }}
            onClick={onSignOut}
          >
            not you?
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 58px 88px 32px",
          gap: 6,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-neutral-700)",
          paddingBottom: 4,
        }}
      >
        <span>Ingredient</span>
        <span>Amt</span>
        <span>Unit</span>
        <span />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{ display: "grid", gridTemplateColumns: "1fr 58px 88px 32px", gap: 6 }}
          >
            <input
              className="input"
              style={{ minHeight: 48, fontSize: 16, padding: "var(--space-1) var(--space-2)" }}
              placeholder={i === 0 ? "Gin" : ""}
              value={row.name}
              aria-label={`Ingredient ${i + 1}`}
              onChange={(e) => setRow(i, { name: e.target.value })}
            />
            <input
              className="input"
              style={{
                minHeight: 48,
                fontSize: 16,
                padding: "var(--space-1) 6px",
                textAlign: "center",
              }}
              // Not type="number": people write "1 1/2" and "2-3".
              inputMode="decimal"
              placeholder={i === 0 ? "2" : ""}
              value={row.amount}
              aria-label={`Amount ${i + 1}`}
              onChange={(e) => setRow(i, { amount: e.target.value })}
            />
            <select
              className="input"
              style={{ minHeight: 48, fontSize: 16, padding: "var(--space-1) 4px" }}
              value={row.unit}
              aria-label={`Unit ${i + 1}`}
              onChange={(e) => setRow(i, { unit: e.target.value })}
            >
              <option value="">—</option>
              {book.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              style={{ minHeight: 48, minWidth: 32, padding: 0, fontSize: 18 }}
              aria-label={`Remove ingredient ${i + 1}`}
              onClick={() => removeRow(i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        className="btn btn-secondary btn-block"
        style={{ marginTop: "var(--space-2)", minHeight: 48 }}
        onClick={addRow}
      >
        + Add ingredient
      </button>

      <div className="field" style={{ marginTop: "var(--space-4)" }}>
        <label htmlFor="recipe-notes">Method / notes (optional)</label>
        <textarea
          id="recipe-notes"
          className="input"
          rows={3}
          style={{ resize: "vertical", lineHeight: 1.4, padding: "var(--space-2) var(--space-3)" }}
          placeholder="Shake hard, double strain, express a lemon peel over the top."
          value={notes}
          onChange={(e) => {
            setSaved(false);
            setNotes(e.target.value);
          }}
        />
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: "var(--space-3)" }}
        disabled={busy || !usable.length}
        onClick={save}
      >
        {busy ? "Saving…" : existing?.updatedAt ? "Update recipe" : "Save recipe"}
      </button>

      {saved && (
        <p
          style={{
            color: "var(--color-accent-700)",
            textAlign: "center",
            marginTop: "var(--space-2)",
          }}
        >
          Saved — everyone can see it now.
        </p>
      )}
      {error && (
        <p
          style={{
            color: "var(--color-accent-2-700)",
            textAlign: "center",
            marginTop: "var(--space-2)",
          }}
        >
          {error}
        </p>
      )}
    </>
  );
}

/* ── shell ───────────────────────────────────────────────────────────── */

export default function RecipeApp() {
  const [tab, setTab] = useState<"mine" | "browse">("mine");
  const [voterId, setVoterId] = useState<string | null>(() => ls(LS_VOTER));
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [drinkNames, setDrinkNames] = useState<Record<string, string>>({});
  const [book, setBook] = useState<RecipeBook | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // The roster comes from /state so this page needs no seed of its own —
      // a guest added to data.json mid-party can write up a recipe too.
      const [state, recipes] = await Promise.all([getState(null), getRecipes()]);
      setRoster(state.roster);
      setDrinkNames(Object.fromEntries(state.drinks.map((d) => [d.id, d.name])));
      setBook(recipes);
      setFatal(null);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : "Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the book whenever the browse tab is opened, so a recipe someone
  // else saved shows up without a reload. No poll — this page isn't live.
  useEffect(() => {
    if (tab === "browse") getRecipes().then(setBook).catch(() => {});
  }, [tab]);

  const people = useMemo(
    () => (roster ? [...roster].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [roster]
  );

  const person = roster?.find((p) => p.id === voterId) ?? null;

  if (fatal && !book) {
    return (
      <div className="sheet">
        <Masthead sub="Mixology Night" />
        <p className="text-muted" style={{ textAlign: "center" }}>
          {fatal}
        </p>
        <button className="btn btn-secondary btn-block" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  if (!book || !roster) {
    return (
      <div className="sheet">
        <Masthead sub="Mixology Night" />
        <p className="text-muted" style={{ textAlign: "center" }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="sheet">
      <Masthead sub={tab === "mine" ? "Write yours up" : "The recipe book"} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button
          className={tab === "mine" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ minHeight: 48 }}
          onClick={() => setTab("mine")}
        >
          Your recipe
        </button>
        <button
          className={tab === "browse" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ minHeight: 48 }}
          onClick={() => setTab("browse")}
        >
          Browse all
        </button>
      </div>

      <hr className="hr" />

      {tab === "browse" ? (
        <Browse book={book} />
      ) : !person ? (
        <>
          <p className="text-muted" style={{ fontSize: 14, textAlign: "center" }}>
            Tap your name to write up your team's drink.
          </p>
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {people.map((p) => (
              <button
                key={p.id}
                className="btn btn-secondary btn-block"
                style={{ minHeight: 60, fontSize: 19 }}
                onClick={() => {
                  lsSet(LS_VOTER, p.id);
                  setVoterId(p.id);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      ) : !person.drinkId ? (
        <>
          <p style={{ textAlign: "center" }}>
            You're not on a team, {person.name} — so there's no recipe to write up.
          </p>
          <button className="btn btn-secondary btn-block" onClick={() => setTab("browse")}>
            Browse everyone else's
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              lsSet(LS_VOTER, "");
              setVoterId(null);
            }}
          >
            not you?
          </button>
        </>
      ) : (
        <Editor
          book={book}
          person={person}
          drinkName={drinkNames[person.drinkId] ?? "your drink"}
          onSaved={setBook}
          onSignOut={() => {
            lsSet(LS_VOTER, "");
            setVoterId(null);
          }}
        />
      )}

      {MOCK && (
        <p className="text-tiny" style={{ color: "var(--color-accent-2-700)", textAlign: "center" }}>
          mock mode — no server, nothing saved
        </p>
      )}
    </div>
  );
}
