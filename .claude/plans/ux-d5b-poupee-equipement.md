# Plan — UXD-5b : poupée d'équipement typée par slot

> Suivi restant du lot UXD-5 (`.claude/plans/ux-d5-gestion.md`, plan maître
> `ux-design-overhaul.md` §6). La vue de ville « plan de construction » a été
> livrée ; **la poupée d'équipement typée était reportée** faute de champ
> `slot` sur les artefacts (données = id + bonus). Ce lot ouvre ce champ **en
> donnée pure** et transforme l'écran héros en poupée à 10 emplacements nommés
> + sac (doc 08 §2.3).

## Constat de départ

- `ui/HeroInventory.tsx` : grille de 10 slots **génériques** (index positionnel
  de `hero.artifacts`), aucun typage.
- `data/core/artifacts.json` : 4 artefacts, forme `{ id, bonus }` sans `slot`.
- Moteur : `hero/artifacts.ts` ne lit que `bonus` (somme cumulative). Le
  placement au ramassage (`adventure/movement.ts`, `quest/evaluate.ts`) écrit
  au **1er slot libre** du tableau plat `hero.artifacts` — comportement **non
  touché** par ce lot.

## Décision de conception

- **Taxonomie de 10 slots typés** (HoMM-flavour, kebab-case) :
  `head neck torso weapon shield cloak hands feet ring misc`.
- La poupée est un **regroupement présentationnel client** : on lit le tableau
  plat `hero.artifacts` (inchangé), on résout le `slot` de chaque id via
  `game.artifactCatalog`, on place chaque artefact dans sa **position typée**.
  Débordement (2 artefacts d'un même slot, ou slot inconnu/absent) → **sac**.
  Ainsi « 10 slots + sac » du doc 08 §2.3, sans changer la sémantique du
  tableau moteur.
- `slot` est **optionnel** sur le schéma/le type : additif, aucun bump
  `CURRENT_SAVE_VERSION` (l'artefact sans slot tombe gracieusement dans le sac).
- **A5 (jamais la couleur seule)** : chaque emplacement porte son **libellé de
  slot** (visible à vide) + `aria-label` « slot — nom/vide ». Icône d'artefact
  si présente, repli nom.

## Invariants tenus (guidelines §8)

- **Moteur pur** : `slot` n'est JAMAIS lu par la logique moteur (aucun
  `if (slot === …)`), c'est une donnée de présentation. Golden inchangé
  (artefacts hors replay), pas de bump save.
- **Zéro faction dans le moteur** : taxonomie générique, pas de faction.
- **Budget < 800 Ko gzip** ; **touch-first** (slots ≥ 44 px) ; **i18n FR/EN** ;
  **docs = vérité** (doc 08 §2.3 mis à jour dans le lot).

## Étapes

- [x] Schéma contenu (`packages/content/src/schemas.ts`) : `artifactSlotSchema`
      (`z.enum` des 10 slots) + champ `slot` **optionnel** sur `artifactSchema`.
- [x] Type moteur (`packages/engine/src/hero/types.ts`) : union `ArtifactSlot` +
      `slot?: ArtifactSlot` sur `ArtifactDef` (commenté « présentation, jamais
      lu par le moteur »). Export `ArtifactSlot` depuis `@heroes/engine`.
- [x] Loader (`packages/content/src/loader.ts`) : `buildArtifactCatalog`
      propage `slot`.
- [x] Données (`data/core/artifacts.json`) : `slot` sur les 4 artefacts
      (lame→weapon, égide→shield, orbe→neck, trèfle→ring).
- [x] i18n (`data/core/locales/{fr,en}.json`) : `hero.slot.<type>` (10) +
      `hero.equipmentTitle`, `hero.bagTitle`, `hero.slotState`.
- [x] Client : `ui/HeroInventory.tsx` → poupée typée (10 positions ordonnées
      tête→pieds + sac), testids `hero-slot-<type>` / `hero-bag`. CSS
      `HeroInventory.css` (tokens uniquement, slots ≥ 44 px). Branché via
      `shell.tsx` (`game.artifactCatalog`).
- [x] Doc 08 §2.3 : note « État UXD-5b » — poupée typée livrée.
- [x] Smoke (`tests/smoke.spec.ts`) : tiroir héros ouvert, `lame-aiguisee`
      occupe le slot **weapon** (classe `filled`), slot **head** vide affiche
      « Tête ». ✅ desktop + mobile.
- [x] Vérif verte : typecheck ✅, lint ✅, tests moteur 401 (golden intact) ✅,
      content 96 ✅, `content:check` ✅, garde-fou couleurs ✅, build ~278 Ko
      gzip JS/CSS ✅, **suite smoke 134 passed / 2 skipped** ✅.
- [x] MàJ `ux-d5-gestion.md` + `ux-design-overhaul.md` §6 (UXD-5 → livré).
- [ ] Commit + push + PR draft.

## Journal
- **2026-07-09** — Cadrage : recherche faite (schéma/loader/type/données/client/
  smoke/golden/save-shape). Confirmé : `slot` additif optionnel ⇒ zéro bump
  save, golden intact, moteur ne lit jamais `slot`. Plan rédigé.
