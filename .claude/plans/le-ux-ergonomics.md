# LE-UX — Ergonomie du client

> Lot LE-UX du plan `game-experience-enrichment.md` (§1.3, §4), issu de la revue
> `archive/game-review-2026-09b.md` §3.2 (points 1–10 ; le 11 est déjà livré).
> **Client seul** : le moteur ne gagne qu'un helper pur exporté (stats effectives
> d'une pile), sans règle nouvelle. Pas de bump save, golden inchangé.

## 1. Constat (repérage du code)

| # | Point | Aujourd'hui |
|---|---|---|
| 1 | Nombres localisés | aucun `Intl.NumberFormat` ; coûts et revenus en « 12500 » |
| 2 | Toasts | `top: 52px`, z 30 > fond de modale (z 20) : ils couvrent l'en-tête des modales |
| 3 | Piège de focus | ~25 modales `role="dialog"` sans aucune gestion du focus |
| 4 | Fin de tour renseignée | bouton sans badge ; « IA en cours » seulement dans la barre d'état |
| 5 | « Tout recruter » / annuler | un seul tap sans aperçu du coût ; aucun retour arrière de transfert |
| 6 | Clavier de carte | Échap/?/E/H/N/T seuls ; pas de pan/zoom clavier, pas d'Entrée, pas de Ctrl+S |
| 7 | Info au seul `title=` | artefact : bonus jamais affiché, conflit d'emplacement en `title` ; garnison du Royaume en icône + `title` |
| 8 | Fiche de pile | stats de **base** (att/déf) ; ni bonus du héros, ni moral, ni chance |
| 9 | Carte mobile | Royaume/Options/Son hors vue à 360 px dans la rangée défilante |
| 10 | Combat mobile | plancher tactile 44 px ⇒ plateau plus large que l'écran, ouvert centré sur la pile active |

## 2. Décisions

- **1** : `formatNumber(n)` dans `app/i18n.ts` (`Intl.NumberFormat` mis en cache par
  langue) ; appliqué aux coûts, revenus, ressources exactes et paramètres
  numériques interpolés par `t()`.
- **2** : quand une modale est ouverte, les toasts passent en **bas** d'écran.
- **3** : un seul module global (`app/focus-trap.ts`) : Tab/Maj+Tab bouclent dans
  la dernière `[role=dialog][aria-modal=true]` du DOM ; focus posé à l'ouverture,
  rendu à la fermeture. Pas d'édition des 25 modales.
- **4** : badge sur « Fin de tour » (héros avec PM · villes sans construction du
  jour) ; bouton désactivé et libellé « IA en cours » pendant les tours adverses.
- **5** : « Tout recruter » ouvre un aperçu (coût total, effectifs) à confirmer ;
  bouton « Annuler le dernier transfert » en rencontre de héros et en garnison
  (rejoue la commande inverse, tant que rien d'autre n'a changé).
- **6** : flèches/ZQSD-WASD = pan, +/− = zoom, Entrée = confirme le chemin
  prévisualisé, Ctrl/⌘+S = sauvegarde rapide ; aide « ? » mise à jour.
- **7** : fiche d'artefact (appui long / survol / focus) avec bonus, effets, sort
  enseigné, panoplie et raison de conflit ; garnison du Royaume avec nom d'unité.
- **8** : helper moteur pur `effectiveStackStats` (attaque/défense effectives,
  moral, chance) exporté, affiché dans la fiche de pile (base → effectif).
- **9** : tiroir « ⋯ » sur la carte mobile pour les actions secondaires (patron du
  combat).
- **10** : combat mobile ouvert en **vue d'ensemble** (plateau entier) ; le premier
  tap zoome au plancher tactile autour du point touché, sans agir.

## 3. Étapes

1. [ ] Nombres localisés
2. [ ] Toasts sous les modales
3. [ ] Piège de focus
4. [ ] Fin de tour renseignée
5. [ ] Aperçu « Tout recruter » + annuler le dernier transfert
6. [ ] Clavier de carte
7. [ ] Fiche d'artefact + garnison du Royaume
8. [ ] Stats effectives de la fiche de pile
9. [ ] Tiroir « ⋯ » de la carte mobile
10. [ ] Vue d'ensemble du combat mobile
11. [ ] Doc 08, CLAUDE.md ; vérifications

## 4. Vérifications

- [ ] `pnpm typecheck` (sans `-s`) · `pnpm lint` · `pnpm build` + budget
- [ ] `pnpm test` ; golden inchangé
- [ ] garde-fous faction et couleurs
- [ ] suite Playwright complète

## 5. Journal

- 2026-09-30 : plan ouvert après la fusion de LE7 (#556).
