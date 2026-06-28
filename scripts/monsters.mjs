/**
 * Monster discovery & resolution.
 *
 * Lists NPCs from the world and from every visible Actor compendium for the
 * in-tool search (using the pack index — no full-document loads), and resolves a
 * chosen NPC into a cached entry with authoritative XP for the budget math.
 */

const CR_FRACTIONS = { 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" };

/**
 * Convert a Challenge Rating to XP, matching Actor5e#getCRExp.
 * @param {number|null} cr
 * @returns {number}
 */
export function crToXp(cr) {
  if ( cr === null || cr === undefined ) return 0;
  if ( cr < 1 ) return Math.max(200 * cr, 10);
  const table = CONFIG.DND5E.CR_EXP_LEVELS;
  return table[cr] ?? table[table.length - 1];
}

/**
 * Human-readable CR (fractions for 1/8, 1/4, 1/2).
 * @param {number|null} cr
 * @returns {string}
 */
export function crLabel(cr) {
  if ( cr === null || cr === undefined ) return "—";
  return CR_FRACTIONS[cr] ?? String(cr);
}

/**
 * Friendly source label for a compendium pack: the owning package's title
 * (a module's display title, or the system id) rather than the individual pack's
 * label. Mirrors dnd5e's own pack→package resolution (data/shared/source-field.mjs).
 * @param {CompendiumCollection} pack
 * @returns {string}
 */
export function packSource(pack) {
  const meta = pack?.metadata;
  if ( !meta ) return game.i18n.localize("ENCOUNTER_ARCHITECT.Source.World");
  const pkgId = meta.packageName ?? pack.collection?.split(".")[0];
  switch ( meta.packageType ) {
    case "world": return game.world?.title ?? game.i18n.localize("ENCOUNTER_ARCHITECT.Source.World");
    case "system": return pkgId ?? game.system.id;
    case "module": return game.modules.get(pkgId)?.title ?? pkgId;
  }
  return pkgId ?? meta.label;
}

/**
 * @typedef {object} NpcResult
 * @property {string} uuid
 * @property {string} name
 * @property {string} img
 * @property {number} cr
 * @property {number} xp
 * @property {string} source   "World" or the compendium label.
 */

/**
 * List NPCs across the world and visible Actor compendiums, optionally filtered by name.
 * @param {string} [query]
 * @param {object} [options]
 * @param {number} [options.limit=60]
 * @returns {Promise<{results:NpcResult[], total:number}>}
 */
export async function listNpcs(query = "", { limit = 60 } = {}) {
  const needle = query.trim().toLowerCase();
  const match = name => !needle || name.toLowerCase().includes(needle);
  const all = [];

  // World actors.
  for ( const actor of game.actors ) {
    if ( (actor.type !== "npc") || !match(actor.name) ) continue;
    const cr = actor.system.details.cr ?? 0;
    all.push({
      uuid: actor.uuid, name: actor.name, img: actor.img, cr,
      xp: actor.system.details.xp?.value ?? crToXp(cr),
      source: game.i18n.localize("ENCOUNTER_ARCHITECT.Source.World")
    });
  }

  // Compendium packs.
  const packs = game.packs.filter(p => (p.metadata.type === "Actor") && p.visible);
  for ( const pack of packs ) {
    let index;
    try {
      index = await pack.getIndex({ fields: ["system.details.cr"] });
    } catch ( err ) {
      console.warn(`encounter-architect | Failed to index pack ${pack.collection}`, err);
      continue;
    }
    for ( const entry of index ) {
      if ( (entry.type !== "npc") || !match(entry.name) ) continue;
      const cr = foundry.utils.getProperty(entry, "system.details.cr") ?? 0;
      all.push({
        uuid: entry.uuid, name: entry.name, img: entry.img, cr,
        xp: crToXp(cr), source: packSource(pack)
      });
    }
  }

  all.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
  return { results: all.slice(0, limit), total: all.length };
}

/**
 * Resolve a UUID into a cached monster entry (authoritative XP from the actor).
 * @param {string} uuid
 * @returns {Promise<NpcResult|null>}
 */
export async function resolveEntry(uuid) {
  const actor = await fromUuid(uuid);
  if ( !actor || (actor.type !== "npc") ) return null;
  const cr = actor.system.details.cr ?? 0;
  return {
    uuid, name: actor.name, img: actor.img, cr,
    xp: actor.system.details.xp?.value ?? crToXp(cr),
    source: actor.pack ? packSource(game.packs.get(actor.pack))
      : game.i18n.localize("ENCOUNTER_ARCHITECT.Source.World")
  };
}
