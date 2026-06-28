/**
 * Party resolution.
 *
 * Reads the world's primary party group (`game.actors.party`) and builds a
 * unified "contribution" model used by every ruleset:
 *   - each player character contributes its level
 *   - each allied NPC (e.g. a companion) contributes its CR as a level-equivalent
 *
 * From those contributions we derive sumLevels / headcount / avgLevel, which the
 * 2024 and Lazy Benchmark rulesets consume in their own ways.
 */

/**
 * @typedef {object} PartyMember
 * @property {string} uuid
 * @property {string} name
 * @property {string} img
 * @property {"pc"|"ally"} kind
 * @property {number} contribution   Level (PC) or CR (ally).
 */

/**
 * @typedef {object} ResolvedParty
 * @property {boolean} ok            False when no usable primary party is set.
 * @property {string} [reason]       Localised explanation when !ok.
 * @property {string} [name]         Party group name.
 * @property {PartyMember[]} members
 * @property {number} headcount      PCs + allies.
 * @property {number} sumLevels      Σ(PC level) + Σ(ally CR).
 * @property {number} avgLevel       round(sumLevels / headcount).
 */

/**
 * Resolve the active party into the unified contribution model.
 * @returns {ResolvedParty}
 */
export function resolveParty() {
  const group = game.actors?.party;
  if ( !group ) {
    return { ok: false, reason: game.i18n.localize("ENCOUNTER_ARCHITECT.Party.None"), members: [],
      headcount: 0, sumLevels: 0, avgLevel: 0 };
  }

  const members = [];
  for ( const entry of group.system.members ?? [] ) {
    const actor = entry.actor;
    if ( !actor ) continue;
    if ( actor.type === "character" ) {
      members.push({
        uuid: actor.uuid, name: actor.name, img: actor.img, kind: "pc",
        contribution: actor.system.details.level ?? 0
      });
    } else if ( actor.type === "npc" ) {
      members.push({
        uuid: actor.uuid, name: actor.name, img: actor.img, kind: "ally",
        contribution: actor.system.details.cr ?? 0
      });
    }
  }

  if ( !members.length ) {
    return { ok: false, reason: game.i18n.localize("ENCOUNTER_ARCHITECT.Party.Empty"), name: group.name,
      members: [], headcount: 0, sumLevels: 0, avgLevel: 0 };
  }

  const sumLevels = members.reduce((acc, m) => acc + m.contribution, 0);
  const headcount = members.length;
  const avgLevel = Math.max(1, Math.round(sumLevels / headcount));

  return { ok: true, name: group.name, members, headcount, sumLevels, avgLevel };
}
