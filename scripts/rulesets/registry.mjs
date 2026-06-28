/**
 * Ruleset registry.
 *
 * A ruleset converts a resolved party + a list of monster entries into a
 * normalised "verdict" that the app template renders. Keeping the contract
 * small lets the UI swap rulesets on the fly without knowing their internals.
 *
 * @typedef {object} MonsterEntry
 * @property {string} uuid
 * @property {string} name
 * @property {number} cr
 * @property {number} xp
 * @property {number} quantity
 *
 * @typedef {object} VerdictGaugeMarker
 * @property {string} label
 * @property {number} at            Absolute value on the gauge axis.
 * @property {"low"|"moderate"|"high"|"benchmark"} kind
 *
 * @typedef {object} Verdict
 * @property {string} costLabel                     "XP" | "CR"
 * @property {number} spent
 * @property {number|null} remaining
 * @property {{label:string, detail:string, status:"ok"|"warn"|"danger"}} summary
 * @property {{value:number, max:number, markers:VerdictGaugeMarker[]}} gauge
 * @property {Record<string,{badge:string, tooltip:string}>} monsterFlags
 * @property {string[]} notes
 *
 * @typedef {object} Ruleset
 * @property {string} id
 * @property {string} label
 * @property {string} costLabel
 * @property {boolean} supportsTarget
 * @property {{id:string,label:string}[]} targets
 * @property {(party:object, entries:MonsterEntry[], opts:object) => Verdict} evaluate
 */

import dmg2024 from "./dmg2024.mjs";
import lazyBenchmark from "./lazy-benchmark.mjs";

/** @type {Map<string, Ruleset>} */
export const rulesets = new Map();

/**
 * Register a ruleset.
 * @param {Ruleset} ruleset
 */
export function registerRuleset(ruleset) {
  rulesets.set(ruleset.id, ruleset);
}

/**
 * Get a ruleset by id, falling back to the first registered one.
 * @param {string} id
 * @returns {Ruleset}
 */
export function getRuleset(id) {
  return rulesets.get(id) ?? rulesets.values().next().value;
}

/** Register the rulesets that ship with the module. */
export function registerBuiltinRulesets() {
  registerRuleset(dmg2024);
  registerRuleset(lazyBenchmark);
}
