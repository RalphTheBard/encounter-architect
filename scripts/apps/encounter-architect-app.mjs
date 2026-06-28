/**
 * Encounter Architect — the interactive designer application.
 *
 * Resolves the party live, lets the GM add monsters (drag-drop, search, or the
 * compendium browser), and recomputes difficulty instantly through the active
 * ruleset. Re-renders automatically when the primary party changes — fixing the
 * stale-difficulty problem in the system's native encounter sheet.
 */
import { resolveParty } from "../party.mjs";
import { listNpcs, resolveEntry, crLabel } from "../monsters.mjs";
import { getRuleset, rulesets } from "../rulesets/registry.mjs";
import * as storage from "../storage.mjs";

const MODULE_ID = "encounter-architect";
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export default class EncounterArchitectApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @type {EncounterArchitectApp|null} */
  static #instance = null;

  /** Open (or focus) the singleton app, restoring the last scratchpad. */
  static async show() {
    if ( EncounterArchitectApp.#instance ) {
      EncounterArchitectApp.#instance.render({ force: true });
      return EncounterArchitectApp.#instance;
    }
    const app = new EncounterArchitectApp();
    EncounterArchitectApp.#instance = app;
    await app.#restore();
    app.render({ force: true });
    return app;
  }

  /* -------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "encounter-architect",
    classes: ["encounter-architect"],
    tag: "div",
    window: {
      title: "ENCOUNTER_ARCHITECT.Title",
      icon: "fa-solid fa-skull-crossbones",
      resizable: true
    },
    position: { width: 760, height: 720 },
    actions: {
      setRuleset: EncounterArchitectApp.#onSetRuleset,
      setTarget: EncounterArchitectApp.#onSetTarget,
      increase: EncounterArchitectApp.#onIncrease,
      decrease: EncounterArchitectApp.#onDecrease,
      remove: EncounterArchitectApp.#onRemove,
      addResult: EncounterArchitectApp.#onAddResult,
      browse: EncounterArchitectApp.#onBrowse,
      clear: EncounterArchitectApp.#onClear,
      save: EncounterArchitectApp.#onSave,
      loadSaved: EncounterArchitectApp.#onLoadSaved,
      deleteSaved: EncounterArchitectApp.#onDeleteSaved
    }
  };

  /** @override */
  static PARTS = {
    body: { template: "modules/encounter-architect/templates/encounter-architect.hbs" }
  };

  /* -------------------------------------------- */
  /*  Instance state                              */
  /* -------------------------------------------- */

  /** Active ruleset id. @type {string} */
  rulesetId = game.settings.get(MODULE_ID, "defaultRuleset") ?? "dmg2024";

  /** Selected difficulty target (2024). @type {string} */
  target = "moderate";

  /** Monster entries keyed by uuid → { quantity, cache:NpcResult }. @type {Map<string,object>} */
  entries = new Map();

  /** Current search query. @type {string} */
  query = "";

  /** Id of the currently-loaded saved encounter (for overwrite-on-save). @type {string|null} */
  savedId = null;

  /* -------------------------------------------- */
  /*  Lifecycle                                   */
  /* -------------------------------------------- */

  /** Restore the last scratchpad from client settings. */
  async #restore() {
    const state = storage.loadScratchpad();
    if ( !state ) return;
    if ( state.rulesetId && rulesets.has(state.rulesetId) ) this.rulesetId = state.rulesetId;
    if ( state.target ) this.target = state.target;
    for ( const { uuid, quantity } of state.entries ?? [] ) {
      const cache = await resolveEntry(uuid);
      if ( cache ) this.entries.set(uuid, { quantity: quantity ?? 1, cache });
    }
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    // Recompute live when the primary party (or any of its members) changes.
    this._hookId = Hooks.on("updateActor", () => this.render({ parts: ["body"] }));
  }

  /** @override */
  _onClose(options) {
    if ( this._hookId ) Hooks.off("updateActor", this._hookId);
    EncounterArchitectApp.#instance = null;
    super._onClose(options);
  }

  /** Serialise current state and persist it as the scratchpad. */
  async #persist() {
    await storage.saveScratchpad(this.#toState());
  }

  /** @returns {storage.EncounterState} */
  #toState() {
    return {
      rulesetId: this.rulesetId,
      target: this.target,
      entries: Array.from(this.entries, ([uuid, e]) => ({ uuid, quantity: e.quantity }))
    };
  }

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const party = resolveParty();
    const ruleset = getRuleset(this.rulesetId);

    // Build the entry list from the cache.
    const entryList = Array.from(this.entries, ([uuid, e]) => ({
      uuid, quantity: e.quantity,
      name: e.cache.name, img: e.cache.img, cr: e.cache.cr, xp: e.cache.xp, source: e.cache.source
    }));

    const verdict = ruleset.evaluate(party, entryList, { target: this.target });

    // Decorate entries for display.
    const fmt = new Intl.NumberFormat(game.i18n.lang);
    context.entries = entryList.map(e => ({
      ...e,
      crLabel: crLabel(e.cr),
      xpLabel: fmt.format(e.xp),
      lineCost: ruleset.costLabel === "XP" ? fmt.format(e.xp * e.quantity) : (e.cr * e.quantity),
      flag: verdict.monsterFlags[e.uuid]
        ? { label: game.i18n.localize(verdict.monsterFlags[e.uuid].badge),
            tooltip: verdict.monsterFlags[e.uuid].tooltip }
        : null
    }));

    // Gauge → percentages for the template.
    const max = verdict.gauge.max || 1;
    context.gauge = {
      status: verdict.summary.status,
      valuePct: Math.clamp((verdict.gauge.value / max) * 100, 0, 100),
      markers: verdict.gauge.markers
        .filter(m => m.at > 0)
        .map(m => ({ ...m, pct: Math.clamp((m.at / max) * 100, 0, 100), label: `${m.label}` }))
    };
    context.summary = verdict.summary;
    context.costLabel = verdict.costLabel;
    context.notes = verdict.notes;

    // Party.
    context.party = party;
    context.partyMembers = party.members.map(m => ({
      ...m, contribLabel: m.kind === "ally" ? crLabel(m.contribution) : m.contribution
    }));

    // Ruleset toggle.
    context.rulesets = Array.from(rulesets.values(), r => ({
      id: r.id, label: game.i18n.localize(r.label), active: r.id === this.rulesetId
    }));
    context.supportsTarget = ruleset.supportsTarget;
    context.targets = ruleset.targets.map(t => ({
      id: t.id, label: game.i18n.localize(t.label), active: t.id === this.target
    }));

    // Search.
    const { results, total } = await listNpcs(this.query);
    context.query = this.query;
    context.results = results.map(r => ({ ...r, crLabel: crLabel(r.cr), xpLabel: fmt.format(r.xp) }));
    context.resultCount = results.length;
    context.resultTotal = total;

    // Saved encounters.
    context.saved = storage.listSaved();

    context.isEmpty = entryList.length === 0;
    return context;
  }

  /* -------------------------------------------- */
  /*  Render: wire up search + drag-drop          */
  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;

    // Search box (debounced; preserve focus across re-render).
    const search = root.querySelector('input[name="query"]');
    if ( search ) {
      search.addEventListener("input", foundry.utils.debounce(ev => {
        this.query = ev.target.value;
        this._refocusSearch = true;
        this.render({ parts: ["body"] });
      }, 250));
      if ( this._refocusSearch ) {
        this._refocusSearch = false;
        search.focus();
        const v = search.value;
        search.setSelectionRange(v.length, v.length);
      }
    }

    // Drag-and-drop NPCs onto the whole window.
    root.addEventListener("dragover", ev => ev.preventDefault());
    root.addEventListener("drop", this.#onDrop.bind(this));
  }

  async #onDrop(event) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if ( data?.type !== "Actor" || !data.uuid ) return;
    await this.#addEntry(data.uuid);
  }

  /* -------------------------------------------- */
  /*  Mutations                                   */
  /* -------------------------------------------- */

  async #addEntry(uuid, delta = 1) {
    const existing = this.entries.get(uuid);
    if ( existing ) {
      existing.quantity = Math.max(1, existing.quantity + delta);
    } else {
      const cache = await resolveEntry(uuid);
      if ( !cache ) {
        ui.notifications.warn(game.i18n.localize("ENCOUNTER_ARCHITECT.Notify.NotNpc"));
        return;
      }
      this.entries.set(uuid, { quantity: 1, cache });
    }
    await this.#persist();
    this.render({ parts: ["body"] });
  }

  async #adjust(uuid, delta) {
    const e = this.entries.get(uuid);
    if ( !e ) return;
    e.quantity += delta;
    if ( e.quantity <= 0 ) this.entries.delete(uuid);
    await this.#persist();
    this.render({ parts: ["body"] });
  }

  /* -------------------------------------------- */
  /*  Action handlers                             */
  /* -------------------------------------------- */

  static async #onSetRuleset(event, target) {
    this.rulesetId = target.dataset.ruleset;
    await this.#persist();
    this.render({ parts: ["body"] });
  }

  static async #onSetTarget(event, target) {
    this.target = target.dataset.target;
    await this.#persist();
    this.render({ parts: ["body"] });
  }

  static #onIncrease(event, target) {
    this.#adjust(target.dataset.uuid, 1);
  }

  static #onDecrease(event, target) {
    this.#adjust(target.dataset.uuid, -1);
  }

  static async #onRemove(event, target) {
    this.entries.delete(target.dataset.uuid);
    await this.#persist();
    this.render({ parts: ["body"] });
  }

  static #onAddResult(event, target) {
    this.#addEntry(target.dataset.uuid);
  }

  static async #onBrowse() {
    const CompendiumBrowser = dnd5e?.applications?.CompendiumBrowser;
    if ( !CompendiumBrowser ) {
      ui.notifications.warn(game.i18n.localize("ENCOUNTER_ARCHITECT.Notify.NoBrowser"));
      return;
    }
    const results = await CompendiumBrowser.select({
      filters: { locked: { documentClass: "Actor", types: new Set(["npc"]) } },
      selection: { min: 1 }
    });
    if ( !results ) return;
    for ( const uuid of results ) await this.#addEntry(uuid);
  }

  static async #onClear() {
    if ( !this.entries.size ) return;
    const ok = await DialogV2.confirm({
      window: { title: game.i18n.localize("ENCOUNTER_ARCHITECT.Clear") },
      content: `<p>${game.i18n.localize("ENCOUNTER_ARCHITECT.ClearConfirm")}</p>`
    });
    if ( !ok ) return;
    this.entries.clear();
    this.savedId = null;
    await this.#persist();
    this.render({ parts: ["body"] });
  }

  static async #onSave() {
    const current = this.savedId ? storage.listSaved().find(s => s.id === this.savedId)?.name : "";
    const name = await DialogV2.prompt({
      window: { title: game.i18n.localize("ENCOUNTER_ARCHITECT.SaveTitle") },
      content: `<input type="text" name="name" value="${foundry.utils.escapeHTML(current ?? "")}"
        placeholder="${game.i18n.localize("ENCOUNTER_ARCHITECT.SavePlaceholder")}" autofocus style="width:100%;">`,
      ok: {
        label: game.i18n.localize("ENCOUNTER_ARCHITECT.Save"),
        callback: (event, button) => button.form.elements.name.value.trim()
      }
    });
    if ( !name ) return;
    this.savedId = await storage.saveEncounter(this.#toState(), name, this.savedId);
    ui.notifications.info(game.i18n.format("ENCOUNTER_ARCHITECT.Notify.Saved", { name }));
    this.render({ parts: ["body"] });
  }

  static async #onLoadSaved(event, target) {
    const state = storage.loadEncounter(target.dataset.id);
    if ( !state ) return;
    this.rulesetId = rulesets.has(state.rulesetId) ? state.rulesetId : this.rulesetId;
    this.target = state.target ?? this.target;
    this.savedId = target.dataset.id;
    this.entries.clear();
    for ( const { uuid, quantity } of state.entries ?? [] ) {
      const cache = await resolveEntry(uuid);
      if ( cache ) this.entries.set(uuid, { quantity: quantity ?? 1, cache });
    }
    await this.#persist();
    this.render({ parts: ["body"] });
  }

  static async #onDeleteSaved(event, target) {
    const ok = await DialogV2.confirm({
      window: { title: game.i18n.localize("ENCOUNTER_ARCHITECT.DeleteTitle") },
      content: `<p>${game.i18n.localize("ENCOUNTER_ARCHITECT.DeleteConfirm")}</p>`
    });
    if ( !ok ) return;
    if ( this.savedId === target.dataset.id ) this.savedId = null;
    await storage.deleteEncounter(target.dataset.id);
    this.render({ parts: ["body"] });
  }
}
