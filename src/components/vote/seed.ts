// Canonical drinks + roster, in the same order as the party list.
//
// NOTE: at runtime these come from the API (GET /state), so the SERVER's
// data.json is the source of truth and can be edited up to party time without
// a redeploy. This copy drives ?mock=1 previews and is the seed handoff.md
// tells the backend to start from. If you change one, change both.

import type { Drink, RosterEntry } from "./types";

export const DRINKS: Drink[] = [
  { id: "lai-chi", name: "Lai Chi", team: ["Jack", "Julien B."] },
  { id: "estus-flask", name: "Estus Flask", team: ["Chris", "Kiara"] },
  { id: "le-tournevis", name: "Le Tournevis", team: ["Felix"] },
  { id: "tony-cocktail", name: "Tony Cocktail", team: ["Zsolt", "Alex"] },
  { id: "portal-fluid", name: "Portal Fluid", team: ["Zoltan", "Jenica"] },
  { id: "zoltans-temple", name: "Zoltan's Temple", team: ["Marcus", "Liam"] },
  { id: "pool-water", name: "Belle Delphine's Pool Water", team: ["Kjell", "Selwyn"] },
  { id: "butter-me-up", name: "Butter Me Up", team: ["Vaish", "Isheeka"] },
  { id: "alligator-uti", name: "Alligator UTI", team: ["Julian T.", "Grace"] },
];

// "Julien B." (Lai Chi) and "Julian T." (Alligator UTI) are DIFFERENT PEOPLE and
// sit one tap apart in the alphabetical sign-in list. The surname initials are
// what keeps them apart — the list deliberately shows names only, since which
// team made which drink stays secret until the results.
export const ROSTER: RosterEntry[] = [
  { id: "zoltan", name: "Zoltan", drinkId: "portal-fluid" },
  { id: "jenica", name: "Jenica", drinkId: "portal-fluid" },
  { id: "felix", name: "Felix", drinkId: "le-tournevis" },
  { id: "jack", name: "Jack", drinkId: "lai-chi" },
  { id: "julien", name: "Julien B.", drinkId: "lai-chi" },
  { id: "marcus", name: "Marcus", drinkId: "zoltans-temple" },
  { id: "liam", name: "Liam", drinkId: "zoltans-temple" },
  { id: "chris", name: "Chris", drinkId: "estus-flask" },
  { id: "kiara", name: "Kiara", drinkId: "estus-flask" },
  { id: "kjell", name: "Kjell", drinkId: "pool-water" },
  { id: "selwyn", name: "Selwyn", drinkId: "pool-water" },
  { id: "zsolt", name: "Zsolt", drinkId: "tony-cocktail" },
  { id: "alex", name: "Alex", drinkId: "tony-cocktail" },
  { id: "vaish", name: "Vaish", drinkId: "butter-me-up" },
  { id: "isheeka", name: "Isheeka", drinkId: "butter-me-up" },
  { id: "julian", name: "Julian T.", drinkId: "alligator-uti" },
  { id: "grace", name: "Grace", drinkId: "alligator-uti" },
  { id: "wasif", name: "Wasif", drinkId: null },
];
