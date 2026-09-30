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

1. [x] Nombres localisés
2. [x] Toasts sous les modales
3. [x] Piège de focus
4. [x] Fin de tour renseignée
5. [x] Aperçu « Tout recruter » + annuler le dernier transfert
6. [x] Clavier de carte
7. [x] Fiche d'artefact + garnison du Royaume
8. [x] Stats effectives de la fiche de pile
9. [x] Tiroir « ⋯ » de la carte mobile
10. [x] Vue d'ensemble du combat mobile
11. [x] Doc 08, CLAUDE.md ; vérifications

## 4. Vérifications

- [x] `pnpm typecheck` (sans `-s`) · `pnpm lint` · `pnpm build` ; budget **387 544 o gzip**
- [x] `pnpm test` — moteur 1106 (+1), contenu 197, client 113 (+4), serveur 10 ; golden inchangé
- [x] garde-fous faction et couleurs
- [x] suite Playwright complète : 146 verts, 1 instable repassé (fluidité @perf, hors zone), 3 échecs réels corrigés (R3 : barre > 25 % à 360 px ⇒ pastille de fin de tour ; sauvegarde mobile ⇒ helper par le tiroir « ⋯ ») puis projet mobile rejoué 21/21

## 5. Journal

- 2026-09-30 : plan ouvert après la fusion de LE7 (#556).
- 2026-09-30 : les dix points livrés, un commit chacun. Écarts et décisions :
  - nombres : regroupement `min2` (séparateur dès 5 chiffres) — typographie
    usuelle, et les compteurs courts (PM, or de départ) restent inchangés ;
  - focus : un module global plutôt qu'un hook par modale (~25 modales) ;
  - annuler le transfert : seulement si la commande inverse restitue l'état
    exact ; une pile fusionnée ne se sépare pas (pas de commande de scission) ;
    la pile revenue au héros reprend sa place par `ReorderArmy` ;
  - point 7 : effets d'artefact écrits sous le nom (visibles au doigt sans
    appui long) plutôt qu'une fiche de plus ; garnison du Royaume nommée dans le
    nom accessible et l'infobulle (le tap ouvre toujours la ville) ; le marché,
    déjà prévisualisé, est laissé tel quel ;
  - point 8 : `performStrike` lit les deux briques extraites (attaque, défense
    d'unité) — arithmétique inchangée, golden inchangé ;
  - point 9 : au cran de police 3 en portrait, le sous-titre de « Fin de tour »
    élargissait le bouton par-dessus « ⋯ » : forme compacte à icônes ;
  - point 10 : la vue d'ensemble survit aux resizes (le HUD mesure ses marges
    après l'ouverture) jusqu'au premier tap.
