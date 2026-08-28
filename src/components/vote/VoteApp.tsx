import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import RadarChart from "./RadarChart";
import {
  CATEGORIES,
  CATEGORY_IDS,
  EMPTY_BALLOT,
  isComplete,
  type Ballot,
  type CategoryId,
  type DrinkResult,
  type RosterEntry,
  type VoteState,
} from "./types";
import { getState, submitVote, MOCK, REPLAY } from "./api";

const LS_VOTER = "vote.voterId";
const LS_REVEAL = "vote.revealSeen";
const POLL_MS = 4000;

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
    /* private mode — the session just won't be remembered */
  }
}

/* ── masthead ────────────────────────────────────────────────────────── */

function Masthead({ sub }: { sub?: string }) {
  return (
    <header className="masthead">
      <div className="kicker">Zoltan&rsquo;s 25th</div>
      <h1 className="cmyk-head" style={{ fontSize: 38, margin: 0 }}>
        <span className="paper">Mixology Night</span>
        <span className="plate plate-c" aria-hidden="true">Mixology Night</span>
        <span className="plate plate-m" aria-hidden="true">Mixology Night</span>
        <span className="plate plate-y" aria-hidden="true">Mixology Night</span>
      </h1>
      {sub && <div className="dateline">{sub}</div>}
    </header>
  );
}

/* ── roster picker (shared by the lobby and the voting-phase sign-in) ────
   Names only. Which team made which cocktail stays secret until the results,
   so nothing here hints at it — the surname initials are what separate
   Julien B. from Julian T. */

function RosterPicker({
  state,
  onPick,
}: {
  state: VoteState;
  onPick: (voterId: string) => void;
}) {
  const people = useMemo(
    () => [...state.roster].sort((a, b) => a.name.localeCompare(b.name)),
    [state.roster]
  );

  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      {people.map((person) => (
        <button
          key={person.id}
          className="btn btn-secondary btn-block"
          style={{ minHeight: 60, fontSize: 19 }}
          onClick={() => onPick(person.id)}
        >
          {person.name}
        </button>
      ))}
    </div>
  );
}

/* ── sign-in (voting is open but this phone hasn't identified itself) ─── */

function SignIn({
  state,
  onPick,
}: {
  state: VoteState;
  onPick: (voterId: string) => void;
}) {
  return (
    <>
      <Masthead sub="Who are you?" />
      <p className="text-muted" style={{ fontSize: 14, textAlign: "center" }}>
        Tap your name. Your own drink gets greyed out — no voting for yourself.
      </p>
      <RosterPicker state={state} onPick={onPick} />
    </>
  );
}

/* ── lobby ───────────────────────────────────────────────────────────────
   Doubles as the check-in desk: someone who scans the QR before the drinks
   are made can pick their name now, so voting is three taps later. Anyone
   who skips it still gets the picker when voting opens. */

function Lobby({
  state,
  voterId,
  displayName,
  onPick,
  onSignOut,
}: {
  state: VoteState;
  voterId: string | null;
  displayName: string;
  onPick: (voterId: string) => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <Masthead sub={voterId ? `Hi, ${displayName}` : "Waiting to start"} />

      <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            marginBottom: "var(--space-4)",
          }}
        >
          {CATEGORIES.map((c, i) => (
            <span
              key={c.id}
              style={{
                width: 44,
                height: 8,
                background: c.ink,
                animation: `pressPulse 1.8s ease-in-out ${i * 0.22}s infinite`,
              }}
            />
          ))}
        </div>
        <h2>Hold tight</h2>
        {/* No maxWidth: a fixed cap pins the wrap point regardless of window
            size, which stranded "made." on its own line at every width.
            balance evens the lines out when it does wrap. */}
        <p className="text-muted" style={{ margin: 0, textWrap: "balance" }}>
          Voting opens once all nine cocktails have been made.
        </p>
      </div>

      <hr className="hr" />

      {voterId ? (
        <div style={{ textAlign: "center" }}>
          <span className="tag tag-accent">Checked in</span>
          <h3 style={{ margin: "var(--space-3) 0 var(--space-1)" }}>{displayName}</h3>
          <p className="text-muted" style={{ fontSize: 14 }}>
            You&rsquo;re all set — nothing else to do until voting opens.
          </p>
          <button className="btn btn-ghost btn-block" onClick={onSignOut}>
            Not you?
          </button>
        </div>
      ) : (
        <>
          <h4 style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
            Check in while you wait
          </h4>
          <RosterPicker state={state} onPick={onPick} />
        </>
      )}

      <hr className="hr" />
      <p className="text-muted text-tiny" style={{ textAlign: "center" }}>
        Best Name · Best Tasting · Best Presentation
      </p>
    </>
  );
}

/* ── ballot ──────────────────────────────────────────────────────────── */

function Ballot({
  state,
  ownDrinkId,
  draft,
  setDraft,
  onSubmit,
  submitting,
  error,
}: {
  state: VoteState;
  ownDrinkId: string | null;
  draft: Ballot;
  setDraft: (b: Ballot) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const chosen = CATEGORY_IDS.filter((c) => draft[c]).length;
  const done = isComplete(draft);

  return (
    <>
      <Masthead sub="Cast your votes" />

      {CATEGORIES.map((cat) => (
        <section key={cat.id} style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ height: 6, background: cat.ink, marginBottom: "var(--space-2)" }} />
          <h3 style={{ color: cat.inkText, marginBottom: "var(--space-3)" }}>{cat.label}</h3>

          <div style={{ display: "grid", gap: 8 }}>
            {state.drinks.map((drink) => {
              const own = drink.id === ownDrinkId;
              const picked = draft[cat.id] === drink.id;
              return (
                <button
                  key={drink.id}
                  disabled={own}
                  aria-pressed={picked}
                  onClick={() => setDraft({ ...draft, [cat.id]: drink.id })}
                  className="btn"
                  style={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    minHeight: 58,
                    paddingLeft: 14,
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${picked ? cat.ink : "var(--color-divider)"}`,
                    borderLeft: `6px solid ${picked ? cat.ink : "transparent"}`,
                    background: picked
                      ? `color-mix(in srgb, ${cat.ink} 14%, transparent)`
                      : "transparent",
                    fontWeight: picked ? 600 : 400,
                    opacity: own ? 0.4 : 1,
                  }}
                >
                  <span style={{ flex: 1 }}>{drink.name}</span>
                  {own && (
                    <span className="text-muted" style={{ fontSize: 11, fontWeight: 400 }}>
                      your drink
                    </span>
                  )}
                  {picked && (
                    <span aria-hidden="true" style={{ color: cat.inkText, fontSize: 20 }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {error && (
        <p style={{ color: "var(--color-accent-2-700)", textAlign: "center" }}>{error}</p>
      )}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          padding: "var(--space-3) 0",
          background:
            "linear-gradient(to top, var(--color-bg) 70%, color-mix(in srgb, var(--color-bg) 0%, transparent))",
        }}
      >
        <button
          className="btn btn-primary btn-block"
          disabled={!done || submitting}
          onClick={onSubmit}
        >
          {submitting ? "Sending…" : done ? "Submit my votes" : `${chosen} of 3 chosen`}
        </button>
      </div>
    </>
  );
}

/* ── ballots-received roll ────────────────────────────────────────────────
   Who has voted, not what they voted. Set as a printed subscription list:
   names in ink once their ballot lands, ghosted until then. The colour
   transition is slow on purpose — a name should settle in, not pop. */

function BallotRoll({
  roster,
  votedIds,
}: {
  roster: RosterEntry[];
  votedIds: string[];
}) {
  const voted = useMemo(() => new Set(votedIds), [votedIds]);
  const people = useMemo(
    () => [...roster].sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  );

  return (
    // Uncontrolled <details>: the browser owns the open state, so the 4s poll
    // re-rendering the list never snaps it shut under the reader.
    <details className="disclosure" style={{ marginTop: "var(--space-4)" }}>
      <summary>
        <h6 style={{ margin: 0 }}>Ballots received</h6>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 17 }}>
            {voted.size}
            <span className="text-muted"> / {roster.length}</span>
          </span>
          <svg
            className="chev"
            width="12"
            height="8"
            viewBox="0 0 12 8"
            aria-hidden="true"
            style={{ color: "var(--color-accent)" }}
          >
            <path
              d="M1 1.75 L6 6.25 L11 1.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "var(--space-2) 0 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
          columnGap: "var(--space-4)",
        }}
      >
        {people.map((person) => {
          const done = voted.has(person.id);
          return (
            <li
              key={person.id}
              aria-label={`${person.name} — ${done ? "ballot received" : "not yet"}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 0",
                borderBottom: "1px solid var(--color-divider)",
                color: done
                  ? "var(--color-text)"
                  : "color-mix(in srgb, var(--color-text) 34%, transparent)",
                fontWeight: done ? 600 : 400,
                transition: "color 600ms ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  flex: "none",
                  background: done ? "var(--color-accent)" : "transparent",
                  border: done
                    ? "1px solid var(--color-accent)"
                    : "1px solid color-mix(in srgb, var(--color-text) 28%, transparent)",
                  transition: "background 600ms ease, border-color 600ms ease",
                }}
              />
              <span style={{ fontSize: 15 }}>{person.name}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/* ── submitted ───────────────────────────────────────────────────────── */

function Submitted({
  state,
  ballot,
  onEdit,
}: {
  state: VoteState;
  ballot: Ballot;
  onEdit: () => void;
}) {
  const drinkName = useMemo(() => {
    const m = new Map(state.drinks.map((d) => [d.id, d.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [state.drinks]);

  return (
    <>
      <Masthead sub="Votes received" />
      <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
        <h2 style={{ marginBottom: 0 }}>Thanks — you&rsquo;re in.</h2>
        {/* The roll below carries the count when the server sends identities;
            without it, fall back to the bare tally. */}
        {!state.votedIds && (
          <p className="text-muted" style={{ marginTop: "var(--space-2)" }}>
            {state.votedCount} of {state.totalVoters} have voted.
          </p>
        )}
      </div>

      {CATEGORIES.map((cat) => (
        <div
          key={cat.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) 0",
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <span style={{ width: 6, alignSelf: "stretch", background: cat.ink }} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: cat.inkText,
              }}
            >
              {cat.label}
            </div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600 }}>
              {drinkName(ballot[cat.id])}
            </div>
          </div>
        </div>
      ))}

      {state.votedIds && (
        <BallotRoll roster={state.roster} votedIds={state.votedIds} />
      )}

      <hr className="hr" />
      <button className="btn btn-secondary btn-block" onClick={onEdit}>
        Change my votes
      </button>
      <p className="text-muted text-tiny" style={{ textAlign: "center", marginTop: "var(--space-3)" }}>
        Results will appear automatically when voting closes.
      </p>
    </>
  );
}

/* ── reveal ──────────────────────────────────────────────────────────── */

function Reveal({ winner, onDone }: { winner: DrinkResult; onDone: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStage(1), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-accent-900)",
        color: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "var(--space-4)",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-6)" }}>
        {CATEGORIES.map((c, i) => (
          <span
            key={c.id}
            style={{
              width: 54,
              height: 10,
              background: c.ink,
              animation: `pressPulse 1.1s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>

      {stage === 0 ? (
        <h2 style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 20 }}>
          The votes are in
        </h2>
      ) : (
        <div style={{ animation: "riseIn 600ms ease-out both" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              opacity: 0.7,
              marginBottom: "var(--space-3)",
            }}
          >
            Cocktail of the night
          </div>
          <h1 style={{ fontSize: 46, marginBottom: "var(--space-2)", lineHeight: 1.05 }}>
            {winner.name}
          </h1>
          <div style={{ fontSize: 18, opacity: 0.85 }}>{winner.team.join(" & ")}</div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 30,
              marginTop: "var(--space-4)",
            }}
          >
            {winner.total} points
          </div>
          <button
            className="btn btn-block"
            style={{
              marginTop: "var(--space-6)",
              background: "var(--color-bg)",
              color: "var(--color-accent-900)",
              maxWidth: 300,
            }}
            onClick={onDone}
          >
            See all the results
          </button>
        </div>
      )}
    </div>
  );
}

/* ── results ─────────────────────────────────────────────────────────── */

function Results({ results }: { results: DrinkResult[] }) {
  const [index, setIndex] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const touchX = useRef<number | null>(null);

  const { average, max } = useMemo(() => {
    const avg = { name: 0, taste: 0, presentation: 0 } as Record<CategoryId, number>;
    let m = 0;
    for (const r of results) {
      for (const c of CATEGORY_IDS) {
        avg[c] += r.counts[c];
        m = Math.max(m, r.counts[c]);
      }
    }
    const n = Math.max(results.length, 1);
    for (const c of CATEGORY_IDS) avg[c] /= n;
    return { average: avg, max: m };
  }, [results]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(Math.max(i + delta, 0), results.length - 1));
    },
    [results.length]
  );

  if (!results.length) return <p className="text-muted">No results yet.</p>;
  const drink = results[index];

  return (
    <>
      <Masthead sub="Final standings" />

      <div
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: "var(--space-2)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 44,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            #{drink.rank}
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 26, fontWeight: 600 }}>
            {drink.total} pts
          </span>
        </div>

        <hr className="rule-heavy" style={{ margin: "0 0 var(--space-3)" }} />

        <h2 style={{ marginBottom: 2 }}>{drink.name}</h2>
        <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
          {drink.team.join(" & ")}
        </p>

        <RadarChart
          counts={drink.counts}
          average={average}
          max={max}
          drinkName={drink.name}
        />

        <p
          className="text-muted text-tiny"
          style={{ textAlign: "center", marginTop: "var(--space-2)" }}
        >
          Dashed outline = average across all nine drinks.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: "var(--space-4)" }}>
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "var(--space-2) 4px",
                background: `color-mix(in srgb, ${c.ink} 12%, transparent)`,
                borderTop: `4px solid ${c.ink}`,
              }}
            >
              <div style={{ fontSize: 26, fontFamily: "var(--font-heading)", fontWeight: 600 }}>
                {drink.counts[c.id]}
              </div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: c.inkText,
                }}
              >
                {c.label.replace("Best ", "")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          marginTop: "var(--space-4)",
        }}
      >
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          disabled={index === 0}
          onClick={() => go(-1)}
        >
          ‹ Prev
        </button>
        <span className="text-muted text-tiny" style={{ minWidth: 52, textAlign: "center" }}>
          {index + 1} / {results.length}
        </span>
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          disabled={index === results.length - 1}
          onClick={() => go(1)}
        >
          Next ›
        </button>
      </div>

      <hr className="hr" />

      <button className="btn btn-ghost btn-block" onClick={() => setShowTable((v) => !v)}>
        {showTable ? "Hide" : "Show"} full standings
      </button>

      {showTable && (
        <div style={{ marginTop: "var(--space-3)" }}>
          {results.map((r, i) => (
            <button
              key={r.drinkId}
              onClick={() => {
                setIndex(i);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="btn"
              style={{
                width: "100%",
                justifyContent: "flex-start",
                gap: "var(--space-3)",
                minHeight: 48,
                borderTop: "1px solid var(--color-divider)",
                borderRadius: 0,
                fontWeight: i === index ? 600 : 400,
              }}
            >
              <span style={{ width: 28, textAlign: "right" }}>#{r.rank}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{r.name}</span>
              <span>{r.total}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ── shell ───────────────────────────────────────────────────────────── */

export default function VoteApp() {
  const [state, setState] = useState<VoteState | null>(null);
  const [voterId, setVoterId] = useState<string | null>(() => ls(LS_VOTER));
  const [draft, setDraft] = useState<Ballot>(EMPTY_BALLOT);
  const [seeded, setSeeded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  // Real phones see the drumroll once — a locked screen mid-reveal shouldn't
  // replay it. Preview and ?replay always play it, since watching it IS the
  // point there.
  const [revealSeen, setRevealSeen] = useState(
    () => !MOCK && !REPLAY && ls(LS_REVEAL) === "1"
  );

  const refresh = useCallback(async () => {
    try {
      const next = await getState(voterId);
      setState(next);
      setFatal(null);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [voterId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Seed the local draft from the server's saved ballot exactly once, so
  // polling never clobbers picks in progress.
  useEffect(() => {
    if (!seeded && state?.ballot) {
      setDraft(state.ballot);
      setSeeded(true);
    }
  }, [state, seeded]);

  const ownDrinkId = useMemo(() => {
    if (!state || !voterId) return null;
    return state.roster.find((r) => r.id === voterId)?.drinkId ?? null;
  }, [state, voterId]);

  const displayName = useMemo(() => {
    if (!state || !voterId) return "";
    return state.roster.find((r) => r.id === voterId)?.name ?? voterId;
  }, [state, voterId]);

  function pickVoter(id: string) {
    lsSet(LS_VOTER, id);
    setVoterId(id);
    setSeeded(false);
    setDraft(EMPTY_BALLOT);
  }

  async function send() {
    if (!voterId) return;
    setSubmitting(true);
    setVoteError(null);
    try {
      const next = await submitVote(voterId, draft);
      setState(next);
      setEditing(false);
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : "Couldn't save your votes.");
    } finally {
      setSubmitting(false);
    }
  }

  function signOut() {
    lsSet(LS_VOTER, "");
    setVoterId(null);
    setSeeded(false);
    setEditing(false);
    setDraft(EMPTY_BALLOT);
  }

  function finishReveal() {
    if (!MOCK) lsSet(LS_REVEAL, "1");
    setRevealSeen(true);
  }

  /* — render — */

  if (!state) {
    return (
      <div className="sheet">
        <Masthead />
        <p className="text-muted" style={{ textAlign: "center" }}>
          {fatal ?? "Loading…"}
        </p>
        {fatal && (
          <button className="btn btn-secondary btn-block" onClick={refresh}>
            Try again
          </button>
        )}
      </div>
    );
  }

  let body: ReactNode;

  // Order matters. Results are public — someone who never checked in must still
  // be able to watch the reveal. The lobby carries its own check-in desk, so
  // only the voting phase gates on identity.
  if (state.phase === "results") {
    const results = state.results ?? [];
    if (!revealSeen && results.length) {
      return <Reveal winner={results[0]} onDone={finishReveal} />;
    }
    body = <Results results={results} />;
  } else if (state.phase === "lobby") {
    body = (
      <Lobby
        state={state}
        voterId={voterId}
        displayName={displayName}
        onPick={pickVoter}
        onSignOut={signOut}
      />
    );
  } else if (!voterId) {
    body = <SignIn state={state} onPick={pickVoter} />;
  } else {
    body =
      state.ballot && !editing ? (
        <Submitted state={state} ballot={state.ballot} onEdit={() => setEditing(true)} />
      ) : (
        <Ballot
          state={state}
          ownDrinkId={ownDrinkId}
          draft={draft}
          setDraft={setDraft}
          onSubmit={send}
          submitting={submitting}
          error={voteError}
        />
      );
  }

  return (
    <div className="sheet">
      {body}
      <footer style={{ marginTop: "var(--space-8)", textAlign: "center" }}>
        {fatal && (
          <p className="text-tiny" style={{ color: "var(--color-accent-2-700)" }}>
            {fatal} Retrying…
          </p>
        )}
        {voterId && (
          <p className="text-muted text-tiny">
            Signed in as {displayName}
            {" · "}
            <button
              className="btn btn-ghost"
              style={{ minHeight: 0, padding: 0, fontSize: 12 }}
              onClick={signOut}
            >
              not you?
            </button>
          </p>
        )}
        {MOCK && (
          <p className="text-tiny" style={{ color: "var(--color-accent-2-700)" }}>
            mock mode — no server, nothing saved
          </p>
        )}
      </footer>
    </div>
  );
}
