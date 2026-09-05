// Client for the vote API on api.zoltanh.ca (see handoff.md for the contract).
//
// ?mock=1 (or ?mock=lobby|voting|results) runs a full in-memory simulation so
// the whole flow can be clicked through with no backend. Nothing about mock
// mode ships into the real path — it is chosen once, at module load.

import {
  CATEGORY_IDS,
  EMPTY_BALLOT,
  type AdminStatus,
  type Ballot,
  type CategoryId,
  type DrinkResult,
  type Ingredient,
  type Phase,
  type RecipeBook,
  type VoteState,
} from "./types";
import { DRINKS, ROSTER } from "./seed";

const DEFAULT_API = "https://api.zoltanh.ca";

function qs(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export const API_BASE: string =
  qs("api") ||
  (import.meta.env.PUBLIC_VOTE_API as string | undefined) ||
  DEFAULT_API;

export const MOCK: string | null = qs("mock");

/** ?replay forces the winner reveal to play again on a phone that has seen it. */
export const REPLAY: boolean = qs("replay") !== null;

/** ?rick fires the rickroll a couple of seconds after load, for previewing. */
export const RICK_PREVIEW: boolean = qs("rick") !== null;

const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...init,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError("Can't reach the voting server.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error || "";
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || `Server error (${res.status}).`, res.status);
  }
  return (await res.json()) as T;
}

/* ── scoring ─────────────────────────────────────────────────────────────
   Points = sum of the three category vote counts. Ties break on Best
   Tasting, then Presentation, then Name, then alphabetically. Drinks on
   equal points SHARE a displayed rank. The backend must match this. */

export function computeResults(
  drinks: typeof DRINKS,
  ballots: Record<string, Ballot>,
  bonuses: string[] = []
): DrinkResult[] {
  const bonusSet = new Set(bonuses);
  const counts = new Map<string, Record<CategoryId, number>>();
  for (const d of drinks) counts.set(d.id, { name: 0, taste: 0, presentation: 0 });

  for (const ballot of Object.values(ballots)) {
    for (const cat of CATEGORY_IDS) {
      const pick = ballot[cat];
      if (pick && counts.has(pick)) counts.get(pick)![cat] += 1;
    }
  }

  const rows = drinks.map((d) => {
    const c = counts.get(d.id)!;
    const bonus = bonusSet.has(d.id) ? 1 : 0;
    return {
      drinkId: d.id,
      name: d.name,
      team: d.team,
      counts: c,
      bonus,
      total: c.name + c.taste + c.presentation + bonus,
      rank: 0,
    };
  });

  rows.sort(
    (a, b) =>
      b.total - a.total ||
      b.counts.taste - a.counts.taste ||
      b.counts.presentation - a.counts.presentation ||
      b.counts.name - a.counts.name ||
      a.name.localeCompare(b.name)
  );

  let rank = 0;
  let prevTotal = Number.NaN;
  rows.forEach((row, i) => {
    if (row.total !== prevTotal) {
      rank = i + 1;
      prevTotal = row.total;
    }
    row.rank = rank;
  });

  return rows;
}

/* ── mock backend ────────────────────────────────────────────────────── */

const mock = {
  phase: (["lobby", "voting", "results"].includes(MOCK || "")
    ? MOCK
    : "voting") as Phase,
  ballots: {} as Record<string, Ballot>,
  rickrollAt: null as number | null,
  bonuses: [] as string[],
  recipes: {} as Record<string, { ingredients: Ingredient[]; notes: string; updatedAt: number }>,
};

/** Mirrors the server's list — kept here so ?mock= previews get a real dropdown. */
export const UNITS: string[] = [
  "oz", "ml", "cl", "tsp", "tbsp", "cup",
  "dash", "splash", "barspoon", "drop", "pinch", "part",
  "piece", "slice", "wedge", "leaf", "sprig",
  "to taste", "top up",
];

if (MOCK) {
  // Pre-fill votes from everyone except the first three, so the results screen
  // has a real spread and the admin shows people outstanding.
  //
  // Weighted, not round-robin: real voting CLUSTERS on a few favourites, and an
  // even spread would cap every category at ~3 and make the radar's
  // field-relative scale look broken. Duplicates in each list are the weights.
  const favour: Record<CategoryId, string[]> = {
    name: [
      "pool-water", "pool-water", "pool-water", "pool-water",
      "alligator-uti", "alligator-uti", "alligator-uti",
      "estus-flask", "estus-flask", "zoltans-temple", "butter-me-up", "lai-chi",
    ],
    taste: [
      "portal-fluid", "portal-fluid", "portal-fluid", "portal-fluid", "portal-fluid",
      "butter-me-up", "butter-me-up", "butter-me-up",
      "lai-chi", "lai-chi", "tony-cocktail", "estus-flask",
    ],
    presentation: [
      "zoltans-temple", "zoltans-temple", "zoltans-temple", "zoltans-temple",
      "portal-fluid", "portal-fluid", "portal-fluid",
      "alligator-uti", "alligator-uti", "le-tournevis", "pool-water", "tony-cocktail",
    ],
  };
  ROSTER.slice(3).forEach((person, i) => {
    const pick = (cat: CategoryId, offset: number) => {
      const options = favour[cat].filter((id) => id !== person.drinkId);
      return options[(i * 5 + offset) % options.length];
    };
    mock.ballots[person.id] = {
      name: pick("name", 0),
      taste: pick("taste", 1),
      presentation: pick("presentation", 2),
    };
  });
  if (mock.phase === "lobby") mock.ballots = {};

  // Two recipes filled in and the rest blank, so the browse UI previews both
  // the populated and the "not submitted yet" row.
  mock.recipes["portal-fluid"] = {
    ingredients: [
      { name: "Blue curaçao", amount: "1", unit: "oz" },
      { name: "White rum", amount: "1.5", unit: "oz" },
      { name: "Lime juice", amount: "0.5", unit: "oz" },
      { name: "Soda", amount: "", unit: "top up" },
    ],
    notes: "Build over ice, stir once, garnish with a lime wheel.",
    updatedAt: Date.now(),
  };
  mock.recipes["le-tournevis"] = {
    ingredients: [
      { name: "Vodka", amount: "2", unit: "oz" },
      { name: "Orange juice", amount: "4", unit: "oz" },
    ],
    notes: "",
    updatedAt: Date.now(),
  };
}

function mockRecipeBook(): RecipeBook {
  return {
    units: UNITS,
    recipes: DRINKS.map((d) => {
      const r = mock.recipes[d.id];
      return {
        drinkId: d.id,
        name: d.name,
        ingredients: r ? r.ingredients : [],
        notes: r ? r.notes : "",
        updatedAt: r ? r.updatedAt : null,
      };
    }),
  };
}

function mockState(voterId: string | null): VoteState {
  const state: VoteState = {
    phase: mock.phase,
    drinks: DRINKS,
    roster: ROSTER,
    ballot: voterId ? mock.ballots[voterId] ?? null : null,
    votedCount: Object.keys(mock.ballots).length,
    totalVoters: ROSTER.length,
    votedIds: Object.keys(mock.ballots),
    rickrollAt: mock.rickrollAt,
  };
  if (mock.phase === "results")
    state.results = computeResults(DRINKS, mock.ballots, mock.bonuses);
  return state;
}

/* ── public API ──────────────────────────────────────────────────────── */

export async function getState(voterId: string | null): Promise<VoteState> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    return mockState(voterId);
  }
  const q = voterId ? `?voter=${encodeURIComponent(voterId)}` : "";
  return call<VoteState>(`/state${q}`);
}

export async function submitVote(voterId: string, ballot: Ballot): Promise<VoteState> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    mock.ballots[voterId] = { ...ballot };
    return mockState(voterId);
  }
  return call<VoteState>("/vote", {
    method: "POST",
    body: JSON.stringify({ voterId, picks: ballot }),
  });
}

/* ── admin ───────────────────────────────────────────────────────────── */

function adminHeaders(key: string): HeadersInit {
  return { "x-admin-key": key };
}

export async function adminStatus(key: string, peek = false): Promise<AdminStatus> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    const votedIds = new Set(Object.keys(mock.ballots));
    const status: AdminStatus = {
      phase: mock.phase,
      voted: ROSTER.filter((r) => votedIds.has(r.id)).map((r) => ({ id: r.id, name: r.name })),
      notVoted: ROSTER.filter((r) => !votedIds.has(r.id)).map((r) => ({ id: r.id, name: r.name })),
      drinks: DRINKS,
      bonuses: mock.bonuses,
    };
    if (peek) status.results = computeResults(DRINKS, mock.ballots, mock.bonuses);
    return status;
  }
  return call<AdminStatus>(`/admin/status${peek ? "?peek=1" : ""}`, {
    headers: adminHeaders(key),
  });
}

export async function setPhase(key: string, phase: Phase): Promise<{ phase: Phase }> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 150));
    mock.phase = phase;
    return { phase };
  }
  return call<{ phase: Phase }>("/admin/phase", {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify({ phase }),
  });
}

/**
 * Award or revoke a drink's single bonus point.
 *
 * Explicit `on`, never a flip: the panel polls every 4s and re-rendering
 * mid-tap could otherwise send a second request that silently undid the first.
 */
export async function setBonus(
  key: string,
  drinkId: string,
  on: boolean
): Promise<{ bonuses: string[] }> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    const set = new Set(mock.bonuses);
    if (on) set.add(drinkId);
    else set.delete(drinkId);
    mock.bonuses = DRINKS.filter((d) => set.has(d.id)).map((d) => d.id);
    return { bonuses: mock.bonuses };
  }
  return call<{ bonuses: string[] }>("/admin/bonus", {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify({ drinkId, on }),
  });
}

export async function rickroll(key: string): Promise<{ rickrollAt: number }> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    mock.rickrollAt = Date.now();
    return { rickrollAt: mock.rickrollAt };
  }
  return call<{ rickrollAt: number }>("/admin/rickroll", {
    method: "POST",
    headers: adminHeaders(key),
  });
}

export async function deleteVoter(key: string, voterId: string): Promise<{ ok: true }> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    delete mock.ballots[voterId];
    return { ok: true };
  }
  return call<{ ok: true }>("/admin/voter", {
    method: "DELETE",
    headers: adminHeaders(key),
    body: JSON.stringify({ voterId }),
  });
}

/* ── recipes ─────────────────────────────────────────────────────────────
   Public reads, roster-identified writes. Deliberately independent of phase:
   teams write these down while they're mixing, long before voting opens. */

export async function getRecipes(): Promise<RecipeBook> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    return mockRecipeBook();
  }
  return call<RecipeBook>("/recipes");
}

export async function submitRecipe(
  voterId: string,
  ingredients: Ingredient[],
  notes: string
): Promise<RecipeBook> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    const person = ROSTER.find((p) => p.id === voterId);
    if (person?.drinkId) {
      mock.recipes[person.drinkId] = {
        ingredients: ingredients.filter((i) => i.name.trim()),
        notes,
        updatedAt: Date.now(),
      };
    }
    return mockRecipeBook();
  }
  return call<RecipeBook>("/recipe", {
    method: "POST",
    body: JSON.stringify({ voterId, ingredients, notes }),
  });
}

export { EMPTY_BALLOT };
