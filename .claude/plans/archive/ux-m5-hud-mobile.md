# Plan — Lot M5 : HUD mobile compact (C10, C11)

> Lot du plan `.claude/plans/ux-revue-mmho.md` (après M1 #140, M2 #141, M4 #146).
> Client seul, zéro diff moteur. Cible : rendre au plateau la place mangée par
> le HUD en portrait 360×640.

## Constats traités

- **C10 (P1)** : HUD mobile envahissant — bandeau ressources sur 2 lignes
  (~190 px), barre d'actions sur 2 rangées, statut sur 3 lignes ; la carte est
  réduite à ~50 % de l'écran (captures `adventure-mobile-*`). Doc 08 §2.1 :
  « ressources en bandeau haut **compact** ».
- **C11 (P2)** : Sauvegarder/Charger occupent la barre de tour (`shell.tsx`)
  alors que l'autosave existe — 2 gros boutons de faible fréquence au niveau du
  geste le plus fréquent (fin de tour).

## Étapes

1. **Barre de ressources 1 ligne** : format compact des grands nombres
   (≥ 10 000 → « 12k », helper pur `formatResourceShort`, tap/appui long =
   valeur exacte via la fiche existante ou un `title`/aria). Icônes + valeurs
   sur une seule rangée à défilement horizontal si débordement ; hauteur cible
   ≤ 56 px. Garder les `data-testid` intacts (smoke).
   → *Vérif* : capture mobile font1–3 ; A1 (44 px) et A6 (cran 3) verts.
2. **Sauvegarder/Charger → Options** : déplacer les 2 boutons de `TurnBar` vers
   la section « Données » de `OptionsPanel` (déjà présente sur l'écran
   aventure, à côté d'export/import). La barre de tour ne garde que ⚙ / 🔔 /
   Ville(s) / Fin de tour. L'autosave de fin de tour couvre le cas courant ;
   le feedback « sauvegarde réussie » (toast) est conservé.
   → *Vérif* : smoke — `save`/`load` restent accessibles (nouveaux testids
   dans Options), la barre de tour ne les porte plus ; les tests qui les
   utilisaient passent par Options.
3. **Statut compact** : « J1 · S1 » + PM sur une ligne (déjà proche) ; vérifier
   qu'au cran 3 rien ne déborde.
4. **Docs & journaux** : doc 08 §2.1 (état M5), journaux des plans.

## Points d'attention

- Les smoke `save`/`saveRoundtrip` passent par le hook `__HEROES_TEST__`
  (pas par le bouton) — donc peu impactés. Repérer les tests qui cliquent
  `data-testid="save"`/`"load"` et les rerouter par Options.
- Ne PAS toucher au layout desktop (colonne droite persistante) — le compactage
  vise le portrait ; en desktop la barre garde de la place.

## Vérifications de sortie

- [x] Typecheck 5/5, lint, garde-fou couleurs, build.
- [x] Smoke : 6 tests save/load reroutés par Options, verts desktop + mobile ;
      suite complète (résultat au journal).
- [x] Captures : barre de ressources mobile ~32 px sur 1 rangée (vs 2 lignes),
      barre d'actions réduite à ⚙/🔔/Ville/Fin de tour, Sauvegarder/Charger
      dans la section Données des Options.

## Journal

- 2026-07-08 : plan ouvert (prep pendant l'attente CI M4), puis livré. Étapes
  1–4. `formatResourceShort` (abrège ≥ 10k, valeur exacte en `title`) ; barre
  de ressources mobile 1 rangée à défilement (`@media max-width:640px`) ;
  Sauvegarder/Charger déplacés du `TurnBar` vers la section « Données » de
  `OptionsPanel` (imports orphelins retirés de `shell.tsx`) ; `data-testid=
  "options-panel"` ajouté. Smoke : helper `clickSaveAction` (ouvre Options →
  clique → Échap ; le chargement referme déjà les modales). Doc 08 §2.1
  (état M5).
