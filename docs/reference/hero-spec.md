# Hero spec

A hero is drawn from a small JSON spec, `<name>.hero.json`, committed beside its SVG. The spec's `kind` field picks the layout, and each layout needs its own fields; the render script throws, naming the missing field, when one is left out.

## fan

For a product that gathers many things into one. `kind` is left out for this layout.

| Field | Holds |
|---|---|
| `title` | The picture's accessible title. |
| `sources` | A list of `{ label, icon, gives }`, one card per thing the product reads from. `gives` is optional, a short label on the arrow leaving that card. |
| `handled` | A list of `{ label, icon }`, one small tile per kind of thing the product handles. |
| `more` | Optional. `true` adds a dashed "and more" tile after the last one. |
| `deliverable` | `{ label, heading, kind, backing }`. `heading` defaults to `label`. `kind` is `document` for a README-like page or `table` for a summary with rows and a total; anything else draws the document page. `backing` is optional, a line under the label naming what stands behind it. |

## before-after

For a product that makes one thing better.

| Field | Holds |
|---|---|
| `title` | The picture's accessible title. |
| `before` | `{ problems, label }`. `problems` is a list of `{ at, label }`, one callout per fault, each `at` one of `fold`, `code`, `badge` or `link`, each place used at most once. |
| `by` | `{ icon, label, with }`. The one arrow between the two pages. `with` is optional, a second line under the label. |
| `after` | `{ parts, label, backing }`. `parts` is a list of `{ at, label }`, each `at` one of `tagline`, `picture`, `badges` or `features`, each place used at most once. `backing` is optional. |

## pages

For a repo that feeds several pages to different readers. This is the layout this repo's own hero uses.

| Field | Holds |
|---|---|
| `eyebrow` | The short line above the headline. |
| `title` | Exactly two lines of the headline. |
| `subtitle` | Exactly three lines under the headline. |
| `legend` | Exactly two entries, `{ who, reads }`, naming the two readers. |
| `source` | The label on the repo pill the arrows leave from. |
| `edge` | The short label on the merge arrow. |
| `tiers` | Exactly three entries, `{ label, colour, reader, items }`. `reader` is `person` or `agent`, drawing that reader's icon on the tile. `items` is the list of ticked lines on that tile. |
| `description` | Optional. The picture's accessible title; falls back to the title lines joined together. |

## Icons

Every `icon` field names one of a fixed set built into the renderer: folder, sparkles, mail, calendar, target, badge-check, image, terminal, shield, link, scissors, car, utensils, plane, bed, train, wifi and more. A name outside this set is an error naming the icons it does know, read in full in figurehead's `references/icons.md`.

## Rendering

This repo carries no renderer. figurehead, a peer skill (`npx skills add oficiallyAkshay/figurehead`), draws a `fan` or `before-after` spec:

```
node <figurehead>/scripts/figurehead.mjs render assets/readme/hero.hero.json > assets/readme/hero.svg
```

This repo's own hero uses `pages`, which figurehead does not render yet; that spec has no working render command until figurehead adds the layout.

## How the drift test works

`test/hero.test.ts` looks for figurehead at `FIGUREHEAD_DIR`, or a sibling `../figurehead` checkout, and skips, naming the env var, when neither exists. When found, it renders every hero this repo commits straight from its `.hero.json` file with figurehead's CLI and compares the result, byte for byte, against the SVG already committed beside it. Separately, the check command's own visuals/spec-agrees rule reads every label a spec names and fails a hero SVG that does not show all of them, so the picture and its spec can never quietly say different things.
