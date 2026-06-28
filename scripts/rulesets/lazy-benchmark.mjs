/**
 * SlyFlourish's Lazy Encounter Benchmark (CR based).
 *
 * Core benchmark = Σ character levels ÷ 4 (levels 1–4) or ÷ 2 (levels 5+).
 * A battle "may be deadly" if the total of monster CRs exceeds the benchmark.
 * Single-monster benchmark = avg level (1–4) or 1.5 × avg level (5+); a single
 * monster above that may be a deadly threat ("boss").
 *
 * Optional high-power scaling (level 11+): deadly threshold rises to ¾ × Σ levels,
 * and at 17+ to 1 × Σ levels. Shown as a second marker when enabled.
 */

const MODULE_ID = "encounter-architect";

/** Round to at most one decimal for display. */
function r1(n) {
  return Math.round(n * 10) / 10;
}

/** @type {import("./registry.mjs").Ruleset} */
export default {
  id: "lazy",
  label: "ENCOUNTER_ARCHITECT.Ruleset.lazy.Label",
  costLabel: "CR",
  supportsTarget: false,
  targets: [],

  evaluate(party, entries, _opts = {}) {
    const fmt = new Intl.NumberFormat(game.i18n.lang, { maximumFractionDigits: 2 });
    const { sumLevels, avgLevel } = party;

    const divisor = avgLevel <= 4 ? 4 : 2;
    const benchmark = r1(sumLevels / divisor);
    const singleMonsterMax = r1(avgLevel <= 4 ? avgLevel : avgLevel * 1.5);

    const useHighPower = game.settings.get(MODULE_ID, "lazyHighPower") && (avgLevel >= 11);
    const highPower = avgLevel >= 17 ? r1(sumLevels) : (avgLevel >= 11 ? r1(sumLevels * 0.75) : null);
    const effective = useHighPower ? highPower : benchmark;

    const spent = r1(entries.reduce((acc, e) => acc + (e.cr * e.quantity), 0));

    // Flag individual monsters that exceed the single-monster benchmark.
    const monsterFlags = {};
    for ( const e of entries ) {
      if ( e.cr > singleMonsterMax ) {
        monsterFlags[e.uuid] = {
          badge: "ENCOUNTER_ARCHITECT.Lazy.BossBadge",
          tooltip: game.i18n.format("ENCOUNTER_ARCHITECT.Lazy.BossTooltip", {
            cr: fmt.format(e.cr), max: fmt.format(singleMonsterMax)
          })
        };
      }
    }

    let status = "ok";
    if ( spent > effective ) status = "danger";
    else if ( spent > benchmark ) status = "warn";

    const label = spent > effective
      ? game.i18n.localize("ENCOUNTER_ARCHITECT.Lazy.MayBeDeadly")
      : game.i18n.localize("ENCOUNTER_ARCHITECT.Lazy.LikelySafe");

    const detail = game.i18n.format("ENCOUNTER_ARCHITECT.Lazy.Detail", {
      spent: fmt.format(spent),
      benchmark: fmt.format(benchmark),
      single: fmt.format(singleMonsterMax)
    });

    const markers = [
      { label: game.i18n.localize("ENCOUNTER_ARCHITECT.Lazy.Benchmark"), at: benchmark, kind: "benchmark" }
    ];
    if ( useHighPower && highPower ) {
      markers.push({ label: game.i18n.localize("ENCOUNTER_ARCHITECT.Lazy.HighPower"), at: highPower, kind: "high" });
    }

    const notes = [game.i18n.localize("ENCOUNTER_ARCHITECT.Lazy.LooseGauge")];
    if ( Object.keys(monsterFlags).length ) {
      notes.push(game.i18n.localize("ENCOUNTER_ARCHITECT.Lazy.BossNote"));
    }

    return {
      costLabel: "CR",
      spent,
      remaining: r1(benchmark - spent),
      summary: { label, detail, status },
      gauge: { value: spent, max: Math.max(effective, benchmark, spent) || 1, markers },
      monsterFlags,
      notes
    };
  }
};
