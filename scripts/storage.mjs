/**
 * Persistence for Encounter Architect.
 *
 * Named encounters live in a world setting (shared, GM-managed). The live
 * scratchpad lives in a per-client setting so the tool reopens where you left it.
 * Only minimal state is stored ({uuid, quantity} + ruleset/target); the party and
 * full monster data are always resolved live.
 */

const MODULE_ID = "encounter-architect";

/**
 * @typedef {object} EncounterState
 * @property {string} rulesetId
 * @property {string} target
 * @property {{uuid:string, quantity:number}[]} entries
 */

/* -------------------------------------------- */
/*  Scratchpad (client)                         */
/* -------------------------------------------- */

/** @param {EncounterState} state */
export async function saveScratchpad(state) {
  await game.settings.set(MODULE_ID, "scratchpad", state);
}

/** @returns {EncounterState|null} */
export function loadScratchpad() {
  return game.settings.get(MODULE_ID, "scratchpad") ?? null;
}

/* -------------------------------------------- */
/*  Named encounters (world)                    */
/* -------------------------------------------- */

/** @returns {Array<{id:string, name:string, updated:number, count:number}>} */
export function listSaved() {
  const store = game.settings.get(MODULE_ID, "encounters") ?? {};
  return Object.values(store)
    .map(e => ({ id: e.id, name: e.name, updated: e.updated ?? 0,
      count: (e.entries ?? []).reduce((a, x) => a + (x.quantity ?? 0), 0) }))
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

/**
 * Save (or overwrite) a named encounter.
 * @param {EncounterState} state
 * @param {string} name
 * @param {string} [id]   Existing id to overwrite; a new one is generated otherwise.
 * @returns {Promise<string>} The encounter id.
 */
export async function saveEncounter(state, name, id) {
  const store = foundry.utils.deepClone(game.settings.get(MODULE_ID, "encounters") ?? {});
  id ??= foundry.utils.randomID();
  store[id] = {
    id, name,
    rulesetId: state.rulesetId,
    target: state.target,
    entries: state.entries,
    updated: Date.now()
  };
  await game.settings.set(MODULE_ID, "encounters", store);
  return id;
}

/**
 * @param {string} id
 * @returns {EncounterState|null}
 */
export function loadEncounter(id) {
  const store = game.settings.get(MODULE_ID, "encounters") ?? {};
  const e = store[id];
  if ( !e ) return null;
  return { rulesetId: e.rulesetId, target: e.target, entries: e.entries ?? [] };
}

/** @param {string} id */
export async function deleteEncounter(id) {
  const store = foundry.utils.deepClone(game.settings.get(MODULE_ID, "encounters") ?? {});
  delete store[id];
  await game.settings.set(MODULE_ID, "encounters", store);
}
