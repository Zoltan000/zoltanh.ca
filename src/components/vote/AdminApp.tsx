import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, type AdminStatus, type Phase } from "./types";
import { adminStatus, deleteVoter, rickroll, setBonus, setPhase, MOCK } from "./api";

const LS_KEY = "vote.adminKey";
const POLL_MS = 4000;

const PHASE_LABEL: Record<Phase, string> = {
  lobby: "Lobby — everyone is waiting",
  voting: "Voting is OPEN",
  results: "Results are PUBLIC",
};

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

export default function AdminApp() {
  const [key, setKey] = useState<string | null>(() => ls(LS_KEY));
  const [keyDraft, setKeyDraft] = useState("");
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rickFired, setRickFired] = useState(false);

  const refresh = useCallback(async () => {
    if (!key) return;
    try {
      const next = await adminStatus(key, peek);
      setStatus(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
      // A bad passphrase should drop back to the prompt, not spin forever.
      if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 401) {
        lsSet(LS_KEY, "");
        setKey(null);
        setStatus(null);
      }
    }
  }, [key, peek]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function change(next: Phase, confirmMsg?: string) {
    if (!key || busy) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await setPhase(key, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function fireRickroll() {
    if (!key || busy) return;
    if (!window.confirm("Take over all 19 phones right now?")) return;
    setBusy(true);
    try {
      await rickroll(key);
      setRickFired(true);
      setTimeout(() => setRickFired(false), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBonus(drinkId: string, on: boolean) {
    if (!key || busy) return;
    setBusy(true);
    try {
      await setBonus(key, drinkId, on);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(voterId: string, name: string) {
    if (!key) return;
    if (!window.confirm(`Delete ${name}'s votes? They can vote again.`)) return;
    setBusy(true);
    try {
      await deleteVoter(key, voterId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!key) {
    return (
      <div className="sheet" style={{ maxWidth: 420 }}>
        <header className="masthead">
          <div className="kicker">Mixology Night</div>
          <h1 style={{ fontSize: 30 }}>Admin</h1>
        </header>
        <div className="field">
          <label htmlFor="admin-key">Passphrase</label>
          <input
            id="admin-key"
            className="input"
            type="password"
            autoFocus
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyDraft.trim()) {
                lsSet(LS_KEY, keyDraft.trim());
                setKey(keyDraft.trim());
              }
            }}
          />
        </div>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: "var(--space-3)" }}
          disabled={!keyDraft.trim()}
          onClick={() => {
            lsSet(LS_KEY, keyDraft.trim());
            setKey(keyDraft.trim());
          }}
        >
          Unlock
        </button>
        {error && (
          <p style={{ color: "var(--color-accent-2-700)", marginTop: "var(--space-3)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="sheet">
        <p className="text-muted" style={{ textAlign: "center", paddingTop: "var(--space-8)" }}>
          {error ?? "Loading…"}
        </p>
      </div>
    );
  }

  const total = status.voted.length + status.notVoted.length;
  const drinks = status.drinks ?? [];
  const bonusSet = new Set(status.bonuses ?? []);

  return (
    <div className="sheet" style={{ maxWidth: 480 }}>
      <header className="masthead">
        <div className="kicker">Mixology Night</div>
        <h1 style={{ fontSize: 30 }}>Admin</h1>
      </header>

      <div
        className="card"
        style={{
          textAlign: "center",
          borderLeft: `6px solid ${
            status.phase === "voting"
              ? "var(--color-accent-2)"
              : status.phase === "results"
                ? "var(--color-accent)"
                : "var(--color-neutral-500)"
          }`,
        }}
      >
        <div className="card-kicker">Current phase</div>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 21, fontWeight: 600 }}>
          {PHASE_LABEL[status.phase]}
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 52, fontWeight: 600, lineHeight: 1 }}>
          {status.voted.length}
          <span className="text-muted" style={{ fontSize: 26 }}> / {total}</span>
        </div>
        <div className="text-muted text-tiny" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
          have voted
        </div>
      </div>

      {status.notVoted.length > 0 && (
        <p className="text-muted" style={{ fontSize: 14, textAlign: "center" }}>
          <strong>Waiting on:</strong> {status.notVoted.map((v) => v.name).join(", ")}
        </p>
      )}

      <hr className="hr" />

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        {status.phase !== "voting" && (
          <button className="btn btn-primary btn-block" disabled={busy} onClick={() => change("voting")}>
            {status.phase === "lobby" ? "Open voting" : "Reopen voting"}
          </button>
        )}
        {status.phase === "voting" && (
          <button
            className="btn btn-primary btn-block"
            disabled={busy}
            onClick={() =>
              change(
                "results",
                status.notVoted.length
                  ? `${status.notVoted.length} people haven't voted yet. Close anyway and reveal?`
                  : "Close voting and reveal the results to everyone?"
              )
            }
          >
            Close voting &amp; reveal
          </button>
        )}
        {status.phase !== "lobby" && (
          <button
            className="btn btn-secondary btn-block"
            disabled={busy}
            onClick={() => change("lobby", "Send everyone back to the waiting screen?")}
          >
            Back to lobby
          </button>
        )}
      </div>

      <hr className="hr" />

      <button className="btn btn-ghost btn-block" onClick={() => setPeek((v) => !v)}>
        {peek ? "Hide tallies" : "Peek at tallies (spoils it for you)"}
      </button>

      {peek && status.results && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              paddingBottom: 6,
              borderBottom: "1px solid var(--color-divider)",
            }}
          >
            <span style={{ flex: 1 }}>Drink</span>
            {CATEGORIES.map((c) => (
              <span key={c.id} style={{ width: 26, textAlign: "right", color: c.inkText }}>
                {c.label.replace("Best ", "").slice(0, 4)}
              </span>
            ))}
            <span style={{ width: 30, textAlign: "right" }}>Pts</span>
          </div>
          {status.results.map((r) => (
            <div
              key={r.drinkId}
              style={{
                display: "flex",
                gap: 8,
                padding: "8px 0",
                borderBottom: "1px solid var(--color-divider)",
                fontSize: 14,
              }}
            >
              <span style={{ flex: 1 }}>
                #{r.rank} {r.name}
                {/* Without this the columns visibly fail to sum to Pts. */}
                {(r.bonus ?? 0) > 0 && (
                  <span className="text-tiny" style={{ color: "var(--color-accent-2-700)" }}>
                    {" "}
                    +{r.bonus} bonus
                  </span>
                )}
              </span>
              {CATEGORIES.map((c) => (
                <span key={c.id} style={{ width: 26, textAlign: "right" }}>
                  {r.counts[c.id]}
                </span>
              ))}
              <span style={{ width: 30, textAlign: "right", fontWeight: 600 }}>{r.total}</span>
            </div>
          ))}
        </div>
      )}

      {drinks.length > 0 && (
        <>
          <hr className="hr" />
          <details>
            <summary style={{ cursor: "pointer", fontSize: 14 }} className="text-muted">
              Bonus points ({bonusSet.size} awarded)
            </summary>
            <p className="text-muted text-tiny" style={{ margin: "var(--space-2) 0" }}>
              One extra point each. Counts toward the total and can change the
              ranking — but never touches the category tallies or the radar.
            </p>
            <div>
              {drinks.map((d) => {
                const on = bonusSet.has(d.id);
                return (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "6px 0",
                      borderBottom: "1px solid var(--color-divider)",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 15 }}>{d.name}</span>
                      <span className="text-muted text-tiny" style={{ display: "block" }}>
                        {d.team.join(" & ")}
                      </span>
                    </span>
                    <button
                      className={on ? "btn btn-primary" : "btn btn-ghost"}
                      disabled={busy}
                      onClick={() => toggleBonus(d.id, !on)}
                      aria-pressed={on}
                      style={{ minHeight: 36, minWidth: 62, fontSize: 13 }}
                    >
                      {on ? "+1 ✓" : "+1"}
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        </>
      )}

      <hr className="hr" />

      <details>
        <summary style={{ cursor: "pointer", fontSize: 14 }} className="text-muted">
          Voters ({status.voted.length} submitted)
        </summary>
        <div style={{ marginTop: "var(--space-2)" }}>
          {status.voted.map((v) => (
            <div
              key={v.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "6px 0",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              <span style={{ flex: 1, fontSize: 15 }}>{v.name}</span>
              <button
                className="btn btn-ghost"
                style={{ color: "var(--color-accent-2-700)", fontSize: 13, minHeight: 36 }}
                onClick={() => remove(v.id, v.name)}
              >
                delete
              </button>
            </div>
          ))}
        </div>
      </details>

      {/* Deliberately unremarkable and last on the page — it should read as a
          stray debug control, not as a feature. */}
      <div style={{ textAlign: "center", marginTop: "var(--space-8)", opacity: 0.5 }}>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={fireRickroll}
          style={{
            fontSize: 12,
            minHeight: 32,
            fontWeight: 400,
            color: rickFired ? "var(--color-accent-2-700)" : "var(--color-neutral-700)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {rickFired ? "sent" : "the funny button"}
        </button>
      </div>

      {error && (
        <p className="text-tiny" style={{ color: "var(--color-accent-2-700)", marginTop: "var(--space-3)" }}>
          {error}
        </p>
      )}
      {MOCK && (
        <p className="text-tiny" style={{ color: "var(--color-accent-2-700)", textAlign: "center" }}>
          mock mode — no server, nothing saved
        </p>
      )}
    </div>
  );
}
