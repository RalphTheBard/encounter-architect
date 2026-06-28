# Encounter Architect

An interactive combat encounter designer for the [Foundry VTT](https://foundryvtt.com/)
**dnd5e** system. Build an encounter by dragging in monsters or searching your world &
compendium NPCs, and watch the difficulty recompute live as you go.

Toggle on the fly between two rulesets:

- **2024 DMG (XP budget)** — pick a target difficulty (Low / Moderate / High) and see your
  XP spend, budget, and how much you have left against that target.
- **Lazy Encounter Benchmark (CR)** — SlyFlourish's loose "may be deadly" gauge based on the
  sum of monster CRs versus the party, with per-monster "boss" flags and optional high-power
  scaling at level 11+.

## Features

- **Live recompute** — updates instantly when you change the encounter *or* edit the party
  (no stale difficulty).
- **Party-aware** — reads the world's primary party group. Player characters contribute their
  level; allied NPCs contribute their CR.
- **Add monsters your way** — drag-and-drop from the sidebar/compendium, search world +
  compendium NPCs (results show their source), or use the dnd5e Compendium Browser.
- **Scratchpad + saved encounters** — reopens where you left off; name and save encounters to
  reload later.

## Installation

In Foundry: **Add-on Modules → Install Module**, and paste this Manifest URL:

```
https://github.com/RalphTheBard/encounter-architect/releases/latest/download/module.json
```

Requires the **dnd5e** system (v5.1.8+) on Foundry VTT v13–v14.

## Usage

1. Designate a primary party: in the **Actors** sidebar, right-click a Group actor →
   **Make Primary Party**.
2. Open the tool from the **skull-crossbones button** at the top of the Actors sidebar.
3. Drag in monsters or search for them; pick a ruleset and (for 2024) a target difficulty.

## License

[MIT](LICENSE).

The Lazy Encounter Benchmark is by SlyFlourish (Michael E. Shea), released under
CC BY 4.0 in the *Lazy GM's Resource Document*.
