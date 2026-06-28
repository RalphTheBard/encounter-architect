/**
 * Encounter Architect — module entry point.
 * Registers settings, the CR compendium index field, the ruleset registry, the
 * Actors-sidebar launch button, and the public macro API.
 */
import { registerBuiltinRulesets, rulesets } from "./rulesets/registry.mjs";
import EncounterArchitectApp from "./apps/encounter-architect-app.mjs";

export const MODULE_ID = "encounter-architect";

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  // Make Challenge Rating available in Actor compendium indexes so the in-tool
  // search can show/sort by CR without loading every full document.
  if ( !CONFIG.Actor.compendiumIndexFields.includes("system.details.cr") ) {
    CONFIG.Actor.compendiumIndexFields.push("system.details.cr");
  }

  registerBuiltinRulesets();
  registerSettings();
});

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  // Public API for macros / other modules.
  const module = game.modules.get(MODULE_ID);
  module.api = {
    open: () => EncounterArchitectApp.show(),
    app: EncounterArchitectApp,
    rulesets
  };

  if ( game.system.id !== "dnd5e" ) {
    console.warn(`${MODULE_ID} | Designed for the dnd5e system; current system is "${game.system.id}".`);
  }
});

/* -------------------------------------------- */
/*  Launch button in the Actors sidebar         */
/* -------------------------------------------- */

Hooks.on("renderActorDirectory", (app, html) => {
  if ( !game.user.isGM ) return;

  // ApplicationV2 directories pass an HTMLElement; v1 passes a jQuery object.
  const root = html instanceof HTMLElement ? html : html?.[0];
  if ( !root || root.querySelector(".encounter-architect-launch") ) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("encounter-architect-launch");
  button.innerHTML = `<i class="fa-solid fa-skull-crossbones" inert></i> ${game.i18n.localize("ENCOUNTER_ARCHITECT.Launch")}`;
  button.addEventListener("click", () => EncounterArchitectApp.show());

  let headerActions = root.querySelector(".header-actions");
  if ( !headerActions ) {
    headerActions = document.createElement("div");
    headerActions.className = "header-actions action-buttons flexrow";
    root.querySelector(":scope > header")?.insertAdjacentElement("afterbegin", headerActions);
  }
  headerActions?.appendChild(button);
});

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

function registerSettings() {
  // Saved encounters (named). Stored as an object keyed by a generated id.
  game.settings.register(MODULE_ID, "encounters", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Last scratchpad state, restored when the app reopens.
  game.settings.register(MODULE_ID, "scratchpad", {
    scope: "client",
    config: false,
    type: Object,
    default: null
  });

  game.settings.register(MODULE_ID, "defaultRuleset", {
    name: "ENCOUNTER_ARCHITECT.Settings.DefaultRuleset.Name",
    hint: "ENCOUNTER_ARCHITECT.Settings.DefaultRuleset.Hint",
    scope: "client",
    config: true,
    type: String,
    default: "dmg2024",
    choices: {
      dmg2024: "ENCOUNTER_ARCHITECT.Ruleset.dmg2024.Label",
      lazy: "ENCOUNTER_ARCHITECT.Ruleset.lazy.Label"
    }
  });

  // Lazy Benchmark: show the optional high-power benchmark at level 11+.
  game.settings.register(MODULE_ID, "lazyHighPower", {
    name: "ENCOUNTER_ARCHITECT.Settings.LazyHighPower.Name",
    hint: "ENCOUNTER_ARCHITECT.Settings.LazyHighPower.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
}
