# Lot R3 — Le HUD d'aventure se range (H3, H6, H7, U7)

> Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
> §6 « Lot R3 » + constats **H3**, **H6**, **H7** (§2) et **U7** (§3).
>
> **Périmètre** : client + locales + docs. **Zéro diff `packages/engine`**, pas de
> bump `CURRENT_SAVE_VERSION`, golden inchangé, aucun id de faction dans `packages/`.
>
> **Base de branche** : `origin/main` = `3f52d11` (R2 mergé, PR #522). Vague 2 du
> plan de remédiation : R2 puis **R3**.

## 0. État de référence mesuré (AVANT)

Build de prod servi par `vite preview`, partie `?seed=42`, viewport **360×640**,
mesures DOM (`getBoundingClientRect`) aux crans de police 1 et 3.

| Id | Mesure |
|---|---|
| **H3** | `.actions` a un fond **transparent** (`rgba(0,0,0,0)`) : les boutons sont posés sur du terrain nu. Le bloc déborde sur **4 rangées** au cran 1 (212 px = **33 %** du viewport) et **5 rangées** au cran 3 (286 px = **45 %**). |
| **H6** | Barre de ressources : `scrollWidth` **477 px** pour `clientWidth` 360 (493 px au cran 3) ⇒ **2 ressources sur 7** hors écran, sans aucune affordance de défilement. |
| **H7** | `towns.map(...)` sans plafond : un bouton par ville possédée dans la même rangée que « Fin de tour ». |
| **U7** | 5 boutons **icône seule** (muet, options, royaume, héros suivant, journal) sans libellé, y compris en desktop 1280 px où la place ne manque pas. |

## 1. Décisions d'interaction (⇒ `docs/08-ui-ux.md` §2.1)

1. **Le HUD bas est un panneau, pas des boutons flottants.** `.turn-row` reçoit
   un fond **opaque** (encre du design system) et un liseré haut : plus aucun
   contrôle posé sur du terrain nu. Trois zones **visuellement séparées** dans un
   ordre stable : **statut** (calendrier, PM, indices) → **navigation** (icônes)
   → **action principale** (« Fin de tour », et « Fouiller » quand il s'affiche).
2. **Une seule rangée d'icônes en portrait.** La zone de navigation devient une
   rangée **à défilement horizontal avec fondu de bord** — patron déjà livré pour
   la file d'initiative de combat (`combat.css`) — pendant que l'action principale
   reste **épinglée** hors du défilement : elle ne peut jamais sortir de l'écran.
3. **Barre de ressources : défilement assumé.** Fondu de bord (même patron) +
   **accrochage** (`scroll-snap`) : à toute position de défilement, on ne voit que
   des ressources **entières** — plus de valeur tranchée au bord.
4. **Plafond de villes.** Au-delà de **2** villes possédées, la rangée n'affiche
   plus qu'un bouton **« Villes (N) »** qui ouvre l'écran Royaume déjà livré (qui
   liste et centre chaque ville). À 1 ou 2 villes, rien ne change.
5. **Libellés en desktop.** À partir de **900 px** (le seuil où la colonne héros
   est déjà permanente), les 5 boutons icône-seule affichent leur libellé à côté
   de l'icône. En portrait, l'icône seule reste la règle (place).

## 2. Étapes & critères de vérification

- [x] **R3.1** — panneau de barre d'actions (H3).
      → *vérif* : mesure DOM mobile — `.turn-row` a un fond **opaque**, la rangée
      d'icônes tient sur **1 rangée** aux 3 crans, et le bloc bas passe sous
      **25 %** du viewport (contre 33 % / 45 %).
- [x] **R3.2** — barre de ressources défilante avec affordance (H6).
      → *vérif* : mesure DOM aux 3 crans — **aucune ressource coupée** par le bord
      (toute ressource est soit entièrement visible, soit entièrement hors champ).
- [x] **R3.3** — plafond « Villes (N) » (H7).
      → *vérif* : smoke — avec 5 villes, un seul bouton de ville, la rangée ne
      déborde pas ; il ouvre l'écran Royaume.
- [x] **R3.4** — libellés desktop (U7).
      → *vérif* : capture/mesure desktop — les 5 boutons portent leur libellé
      textuel ; masqués en portrait.
- [x] **R3.5** — doc 08 §2.1 alignée (docs = source de vérité).
- [x] **R3.6** — pipeline complet : `typecheck`, `lint`, `test`, `content:check`,
      garde-fous CI, `build` (budget), smoke, audit `ux-audit`.

## 3. Journal / écarts constatés

- **Métrique de « rangée unique » d'abord fausse.** Compter les `y` distincts des
  boutons donne 3-4 « rangées » même sur une seule ligne : `align-items: flex-end`
  aligne des boutons de **hauteurs différentes**, donc des `y` différents. Mesure
  corrigée : `nav.scrollHeight ≤ hauteur du plus haut bouton` — c'est elle qui est
  encodée dans le smoke.
- **Ordre des icônes changé** (au-delà de la lettre du plan). Une rangée qui
  défile fait un choix implicite : ce qui dépasse est caché. Avec l'ordre
  historique, **« Ville »** — le bouton le plus utilisé — tombait hors champ.
  Réordonné par fréquence : villes → héros suivant → journal → royaume → options →
  son. Mesuré : les 3 premiers sont visibles sans défiler aux crans 1 et 3.
- **Desktop : retour à la ligne plutôt que défilement.** Une fois les libellés
  affichés (U7), 6 boutons libellés à droite de la colonne héros (300 px)
  débordent dès le cran 2 en 1280 px. Cacher la moitié des entrées derrière un
  fondu n'a de sens qu'en portrait, où la **hauteur** est la ressource rare ; en
  desktop la rangée revient à la ligne.
- **H6 — masquage des zéros retenu plutôt que le seul fondu.** Le plan offrait
  les deux. Le fondu seul laisse une valeur tranchée au bord au chargement ; les
  ressources à **0** ne portent aucune décision et la fiche détaillée (tap) les
  liste **toutes** avec leur revenu — rien ne devient inaccessible. Le fondu +
  accrochage sont **conservés** pour les parties où beaucoup de ressources sont
  non nulles. Mesuré : 3 ressources affichées, **0 coupée**, aux 3 crans.
- **Bandeau d'armée intégré** (au-delà de la lettre du plan) : replié, il formait
  une **seconde** bande opaque pleine largeur au-dessus du nouveau panneau — le
  constat H3 le mentionnait explicitement. Même encre, liseré unique ⇒ le HUD bas
  se lit comme UN panneau.
- **Statut non compressible** : le panneau serrait « Mois 1 · Semaine 1 · Jour 1 »
  au point de le couper en plein milieu ; `flex: none` + `white-space: nowrap`.
- **Niveau de test choisi** (skill `test-authoring`) : le plafond de villes est
  une **règle pure** ⇒ test unitaire client (`town-buttons.test.ts`, helper
  `collapseTownButtons` extrait dans `app/game.ts`). Le reste (panneau opaque,
  rangée unique, ressource non coupée, action épinglée) est du **layout DOM** ⇒
  un seul test smoke à assertions multiples, aux crans 1 (`@core`) et 3
  (`@mobile`). Le critère « la rangée ne déborde pas à 5 villes » est **structurel**
  et non simulé : le plafond borne la navigation à **6 boutons quelle que soit la
  partie**, et c'est cette configuration à 6 boutons que le smoke mesure.

## 4. Bilan

Livré.

| Vérification | Résultat |
|---|---|
| `pnpm typecheck` / `pnpm lint` | ✅ |
| `pnpm test` (moteur + contenu) | ✅ 935 tests |
| Tests unitaires client | ✅ 69 tests (16 fichiers, +2 pour R3) |
| `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| Garde-fous CI (faction, couleurs) | ✅ |
| `pnpm build` + budget bundle | ✅ **355 Ko gzip** / 800 |
| Smoke Playwright | ✅ (desktop + mobile) |
| Audit `ux-audit` (96 captures) | ✅ 0 warning A1, 0 échec |

### Avant / après mesurés (aventure, 360×640)

| | Avant | Après |
|---|---|---|
| Fond de la barre d'actions | **transparent** (boutons sur terrain nu) | **opaque** (panneau + liseré) |
| Rangées de boutons | 4 (cran 1) · 5 (cran 3) | **1** (les 3 crans) |
| Hauteur de la barre d'actions | 33 % · 45 % du viewport | **20 %** · **23 %** |
| Ressources coupées par le bord | 2 sur 7 | **0** |
| « Fin de tour » | dans le flux, repoussé par les autres | **épinglé**, jamais hors champ |
| Boutons de ville | 1 par ville, sans plafond | plafonné à 2, puis « Villes (N) » |
| Libellés desktop | 0 / 5 | **5 / 5** (≥ 900 px) |
