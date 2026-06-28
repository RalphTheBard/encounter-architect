/**
 * 2024 DMG encounter-building rules (XP budget).
 *
 * Budget for a difficulty = (per-character XP for the party's level, from the
 * 2024 "XP Budget per Character" table) × number of characters. Spend = the sum
 * of each monster's XP. Reuses the system's own table, CONFIG.DND5E.ENCOUNTER_DIFFICULTY.
 */

const TARGETS = [
  { id: "low", label: "ENCOUNTER_ARCHITECT.Difficulty.low", index: 0 },
  { id: "moderate", label: "ENCOUNTER_ARCHITECT.Difficulty.moderate", index: 1 },
  { id: "high", label: "ENCOUNTER_ARCHITECT.Difficulty.high", index: 2 }
];

/**
 * Per-character XP thresholds [low, moderate, high] for a party level, scaled by headcount.
 * @param {number} avgLevel
 * @param {number} headcount
 * @returns {{low:number, moderate:number, high:number}}
 */
function budgets(avgLevel, headcount) {
  const table = CONFIG.DND5E.ENCOUNTER_DIFFICULTY;
  const row = table[Math.clamp(avgLevel, 1, table.length - 1)] ?? [0, 0, 0];
  const [low, moderate, high] = row.map(t => t * headcount);
  return { low, moderate, high };
}

/** @type {import("./registry.mjs").Ruleset} */
export default {
  id: "dmg2024",
  label: "ENCOUNTER_ARCHITECT.Ruleset.dmg2024.Label",
  costLabel: "XP",
  supportsTarget: true,
  targets: TARGETS.map(t => ({ id: t.id, label: t.label })),

  evaluate(party, entries, { target = "moderate" } = {}) {
    const fmt = new Intl.NumberFormat(game.i18n.lang);
    const spent = entries.reduce((acc, e) => acc + (e.xp * e.quantity), 0);
    const b = budgets(party.avgLevel, party.headcount);
    const targetMeta = TARGETS.find(t => t.id === target) ?? TARGETS[1];
    const budget = b[target] ?? 0;
    const remaining = budget - spent;

    // Which band does current spend fall into?
    let band = "ENCOUNTER_ARCHITECT.Difficulty.low";
    if ( spent > b.high ) band = "ENCOUNTER_ARCHITECT.Difficulty.deadly";
    else if ( spent > b.moderate ) band = "ENCOUNTER_ARCHITECT.Difficulty.high";
    else if ( spent > b.low ) band = "ENCOUNTER_ARCHITECT.Difficulty.moderate";

    const overUnder = remaining >= 0
      ? game.i18n.format("ENCOUNTER_ARCHITECT.Verdict.Under", { n: fmt.format(remaining) })
      : game.i18n.format("ENCOUNTER_ARCHITECT.Verdict.Over", { n: fmt.format(-remaining) });

    return {
      costLabel: "XP",
      spent,
      remaining,
      summary: {
        label: game.i18n.localize(band),
        detail: game.i18n.format("ENCOUNTER_ARCHITECT.Verdict.Budget2024", {
          spent: fmt.format(spent),
          budget: fmt.format(budget),
          target: game.i18n.localize(targetMeta.label),
          overUnder
        }),
        status: spent <= budget ? "ok" : (spent <= b.high ? "warn" : "danger")
      },
      gauge: {
        value: spent,
        max: b.high || 1,
        markers: [
          { label: game.i18n.localize("ENCOUNTER_ARCHITECT.Difficulty.low"), at: b.low, kind: "low" },
          { label: game.i18n.localize("ENCOUNTER_ARCHITECT.Difficulty.moderate"), at: b.moderate, kind: "moderate" },
          { label: game.i18n.localize("ENCOUNTER_ARCHITECT.Difficulty.high"), at: b.high, kind: "high" }
        ]
      },
      monsterFlags: {},
      notes: []
    };
  }
};
