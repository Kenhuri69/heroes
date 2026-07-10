# Refonte UX de l'écran de ville (doc 08 §2.2)

## Contexte

L'écran de ville est jugé lourd à l'usage et éloigné de HoMM Online. Deux
constats de l'utilisateur (captures mobiles) :

1. **Incohérence marché/guilde** : le client affiche les onglets **Marché** et
   **Guilde** en permanence, alors que le moteur (`validateTradeResources`,
   `market.ts:52`) exige un **bâtiment construit** portant l'effet `market`.
   Ouvrir l'onglet sur une ville sans marché ⇒ échange refusé (`invalidTrade`).
2. **Lourdeur** : 4 couches empilées avant le contenu (en-tête, vue peinte
   décorative, 5 gros onglets en grille, grand ruban « Chantier du jour »),
   puis des cartes de bâtiment très verbeuses (lore + coût + temps + statut).

Objectif : rapprocher l'écran du core loop HoMM (la panorama = point d'entrée),
alléger la densité, **zéro diff moteur** (client + CSS + data + doc uniquement).

## Lots (commits atomiques)

### Lot A — Cohérence des onglets Marché/Guilde  ✅
- `hasBuiltEffect(town, catalog, 'market' | 'mageGuild')` : la ville a-t-elle un
  bâtiment construit portant cet effet.
- N'afficher l'onglet **Marché** que si `hasMarket`, **Guilde** que si `hasGuild`.
- Si l'onglet actif devient indisponible, repli sur `build`.
- Vérif : la ville de départ (jour 1) n'a ni marché ni guilde ⇒ onglets absents.
  Les tests marché/guilde construisent le bâtiment d'abord ⇒ restent verts.
  Ajout d'assertion « onglets absents avant construction ».

### Lot B — Vue peinte interactive (panorama = point d'entrée)  ✅
- Tap sur un emplacement route vers l'action pertinente au lieu de toujours
  basculer sur `build` :
  - construit + effet `market` ⇒ onglet Marché ;
  - construit + effet `mageGuild` ⇒ onglet Guilde ;
  - construit + habitation (dwelling) ⇒ onglet Recruter ;
  - sinon (disponible / verrouillé) ⇒ onglet Construire.
- Vérif : `town-view-building` toujours cliquable ; smoke inchangé.

### Lot C — Cartes de bâtiment compactes  ✅
- Lore tronqué (line-clamp 2 lignes) — reste visible (test `.town-building-lore`
  vert) mais n'explose plus la hauteur.
- Retrait du « Chantier : 1 j » par carte (redondant avec le badge global du
  lot D) → mise à jour du test qui l'asserte.

### Lot D — « Chantier du jour » condensé  ✅
- Remplacer le grand ruban ornemental par un **badge compact** intégré à
  l'en-tête (revenu · croissance · chantier). Conserver le testid
  `town-build-queue-state` (+ texte /Libre/).

### Lot E — Ergonomie mobile  ✅
- Onglets **collants** (sticky) en haut du scroll de la modale (plus de
  re-scroll pour changer d'onglet).
- Vue peinte un peu plus courte.

### Lot F — Doc & tests
- Mettre à jour `docs/08-ui-ux.md` §2.2 (nouvel état).
- Ajuster/compléter les assertions smoke.
- Vérif finale : typecheck, lint, build, smoke Chromium, budget bundle, garde-fou
  « zéro faction ».

### Lot G — Blason de faction (suivi hors refonte, demandé après)
Le `FactionBadge` n'affichait qu'un motif procédural (repli a11y), d'où le
« dé violet » pour Havre. Objectif : un vrai blason quand un asset existe, sans
perdre le repli non chromatique ni introduire de faction en dur.
- Résolveur générique `factionBadgeUrl(factionId)` → `badges/<factionId>`
  (data-driven, aucune faction en dur, comme `buildingUrl`).
- `FactionBadge` : rend l'image de blason si présente, sinon le motif SVG
  procédural. `aria-label` + `data-pattern` + `data-testid` conservés (a11y +
  smoke inchangés).
- Générateur procédural déterministe `tools/assets/gen_faction_badge.py` (PIL,
  esprit `gen_chrome.py`) → écu bleu roi, bordure or, charge héraldique dorée
  (soleil/lumière — identité Haven doc 03). Staging `assets/badges/haven.png`.
- Doc 12 : nouvelle famille d'assets « blasons ».
- Vérif : smoke `faction-badge` toujours visible ; budget bundle inchangé (PNG
  hors JS).

## Critères de vérification
- [ ] `pnpm typecheck` / `pnpm lint` OK
- [ ] `pnpm build` OK, budget < 800 Ko gzip tenu
- [ ] smoke Playwright vert (dont onglets marché/guilde masqués avant construction)
- [ ] garde-fou « zéro faction dans le moteur » vert (aucun diff moteur)
