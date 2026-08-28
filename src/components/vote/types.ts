// Shared vocabulary between /vote and the API on api.zoltanh.ca.
// Keep in step with handoff.md — the backend mirrors these shapes.

export type Phase = "lobby" | "voting" | "results";

export type CategoryId = "name" | "taste" | "presentation";

export interface Category {
  id: CategoryId;
  /** Heading shown above the ballot section. */
  label: string;
  /** Process ink — fills, rules, radar marks. */
  ink: string;
  /** Darkened plate for text on the paper ground (yellow is illegible raw). */
  inkText: string;
  /** Radar vertex angle in degrees, 0 = east, clockwise (SVG y is flipped). */
  angle: number;
}

/** Name top, taste bottom-left, presentation bottom-right. */
export const CATEGORIES: Category[] = [
  {
    id: "name",
    label: "Best Name",
    ink: "#0088b0",
    inkText: "#006786",
    angle: -90,
  },
  {
    id: "taste",
    label: "Best Tasting",
    ink: "#d6006c",
    inkText: "#aa0b56",
    angle: 150,
  },
  {
    id: "presentation",
    label: "Best Presentation",
    ink: "#edbb00",
    inkText: "#6f5500",
    angle: 30,
  },
];

export const CATEGORY_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

export interface Drink {
  id: string;
  name: string;
  /** Display names of the people who made it. */
  team: string[];
}

export interface RosterEntry {
  id: string;
  name: string;
  /** Drink this person made — their ballot greys it out. null = no team. */
  drinkId: string | null;
}

/** One person's three picks. A category is null until they choose. */
export type Ballot = Record<CategoryId, string | null>;

export interface DrinkResult {
  drinkId: string;
  name: string;
  team: string[];
  counts: Record<CategoryId, number>;
  total: number;
  /** 1-based. Ties share a rank. */
  rank: number;
}

export interface VoteState {
  phase: Phase;
  drinks: Drink[];
  roster: RosterEntry[];
  /** This voter's saved ballot, echoed back by the server. */
  ballot: Ballot | null;
  votedCount: number;
  totalVoters: number;
  /** Present only when phase === "results". Sorted winner-first. */
  results?: DrinkResult[];
}

export interface AdminStatus {
  phase: Phase;
  voted: { id: string; name: string }[];
  notVoted: { id: string; name: string }[];
  /** Only fetched when the admin explicitly peeks. */
  results?: DrinkResult[];
}

export const EMPTY_BALLOT: Ballot = { name: null, taste: null, presentation: null };

export function isComplete(ballot: Ballot): boolean {
  return CATEGORY_IDS.every((c) => !!ballot[c]);
}
