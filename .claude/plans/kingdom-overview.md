# Plan — Sprint 3 : « gérer son royaume sans friction » (E1 + filet perf)

> **Statut** : plan détaillé rédigé, implémentation non lancée.
> Parent : `.claude/plans/mvp-game-loop-roadmap.md` (Sprint 3).
> Écart couvert : **E1** (vue de royaume / kingdom overview) de
> `docs/18-audit-fonctionnalites-vs-heroes-online.md` — « P1, confort majeur,
> coût faible » — + filet perf consolidant le Sprint 2.

## 0. Objectif & critère de sortie

Dès 2+ villes / 2+ héros, répondre en UN écran à « où en suis-je ? » : villes
(chantier du jour, garnison, revenus), héros (niveau, armée, mouvement
restant), revenus/jour agrégés — avec navigation directe (tap ⇒ ville ou
centrage caméra sur héros).

**Critère de sortie mesurable** : partie à 2 villes + 2 héros — depuis la
carte : ouvrir la vue, lire l'état complet, taper une ville ⇒ `TownScreen`
s'ouvre ; taper un héros ⇒ la caméra se centre dessus et il devient le héros
sélectionné. Zéro chaîne en dur (parité FR/EN), cibles ≥ 44 px, 3 crans de
police.

## 1. Invariants (guidelines §8 + doc 08)

- **Client pur, zéro diff moteur** : toutes les données existent dans l'état
  (`TownState` — construction du jour, garnison, bâtiments ; `HeroState` —
  niveau, armée, PM ; revenus via les helpers purs `@heroes/engine` déjà
  consommés par le client : coût/revenu de ville, `armyStrength`). Si une
  projection manque, l'écrire en **helper pur exporté du moteur** (patron R7),
  jamais en logique dupliquée côté client.
- Pas de bump `CURRENT_SAVE_VERSION`, golden inchangé, garde-fou « zéro
  faction » (l'écran consomme `FactionBadge` + noms localisés génériques).
- Touch-first : cibles ≥ 44 px, appui long = hover (parité), pile de modales
  ≤ 2 (doc 08) — **la vue remplace** toute modale ouverte et se ferme avant
  d'ouvrir `TownScreen` (jamais 3 niveaux).
- i18n : toutes les clés dans `data/core/locales/` FR/EN dans le même commit
  (l'audit i18n CI casse sinon).

## 2. État des lieux (points d'ancrage vérifiés)

- `ui/shell.tsx` : barre du jeu (ressources, `TurnIndicator`, boutons ville/
  héros/quêtes/minimap) — point d'entrée naturel du bouton « Royaume ».
- `app/store.ts` : patron d'ouverture d'écrans par état
  (`townOpen`/`heroDrawer`/etc.) — ajouter `kingdomOpen: boolean`.
- Navigation existante réutilisable : ouverture `TownScreen` (par id de
  ville), sélection de héros + `panCameraTo(x, y, ms)`
  (`app/camera-control.ts`) pour le centrage.
- « Chantier du jour » : bandeau livré dans l'écran de ville (lot B1 fidélité
  HO) — la vue de royaume en réutilise la logique d'affichage (libre/occupé +
  jours), pas de duplication : extraire le fragment en composant partagé si
  nécessaire.
- `humanPlayerId` (remédiation R3) : la vue montre le royaume du **joueur
  humain actif** (hot-seat : celui qui a la main), jamais `'player-1'` en dur.

## 3. Étapes

### 3.1 UI — écran `KingdomOverview`

- [ ] a. Store : `kingdomOpen` + action d'ouverture/fermeture ; bouton
      « Royaume » dans la barre (`shell.tsx`), icône + libellé i18n, ≥ 44 px.
      Raccourci : ouvrable aussi depuis l'écran de ville (« voir tout »)
      en remplacement de la modale courante.
- [ ] b. Composant `ui/KingdomOverview.tsx` + `KingdomOverview.css` :
      - **En-tête agrégé** : revenus/jour par ressource (somme des villes +
        mines possédées — helper pur moteur si non exposé), nombre de villes,
        jour/semaine courants.
      - **Section Villes** (une carte par ville) : nom localisé +
        `FactionBadge`, chantier du jour (libre / en cours + nom du bâtiment),
        garnison résumée (jusqu'à 7 vignettes unité×count, débordement
        « +N »), alerte discrète si chantier libre en fin de journée
        (glyphe, pas seulement couleur).
      - **Section Héros** (une ligne par héros) : avatar, nom résolu
        (`resolveHeroName`), niveau, PM restants (fraction + barre),
        `armyStrength` de l'armée, artefact récent éventuel — rien qui ne
        soit déjà dans l'état.
      - Tri stable et déterministe (ordre d'acquisition), listes scrollables
        (`overflow-y`), tailles en `rem` (3 crans de police).
- [ ] c. Navigation : tap ville ⇒ fermer la vue puis ouvrir `TownScreen(id)` ;
      tap héros ⇒ fermer, sélectionner le héros, `panCameraTo(pos, DEFAULT_PAN_MS)`
      (0 ms en reduce-motion). Bouton retour/X standard.
- [ ] d. Hot-seat : la vue se ferme au passage de main (comme les autres
      overlays) ; en tour IA (`store.aiTurn`), bouton désactivé (les actions
      humaines sont déjà ignorées — cohérence avec le lot multiplayer-ux).
- [ ] e. i18n : clés `kingdom.*` FR/EN dans `data/core/locales/`.

### 3.2 Helper moteur éventuel (seulement si nécessaire)

- [ ] a. Si le revenu/jour agrégé n'est pas déjà exposé : helper **pur**
      `dailyIncomeOf(state, playerId): ResourceMap` dans `@heroes/engine`
      (réutilisant le calcul de `TownIncome` de `EndTurn` — même source de
      vérité, pas de formule dupliquée), + test unitaire dédié. **Aucun autre
      diff moteur autorisé dans ce lot.**

### 3.3 Filet perf (consolidation Sprint 2)

- [ ] a. Étendre le smoke anti-gel throttling ×4 (`@perf`) : carte 128²
      générée avec gardiens gradués (Sprint 2) — pan/zoom + fin de tour sans
      gel ; vue de royaume ouverte/fermée dans la même passe (l'écran ne doit
      pas re-render en boucle : abonnements store ciblés).

### 3.4 Tests (skill `test-authoring`)

- [ ] a. **Unitaire moteur** : uniquement si 3.2 (helper `dailyIncomeOf` —
      parité avec les événements `TownIncome` d'un EndTurn simulé).
- [ ] b. **Smoke** (1 cas, `@core` ; + variante `@mobile`) : ouvrir la vue,
      vérifier la présence des sections villes/héros, taper la ville ⇒
      `TownScreen` visible. Pas de smoke par sous-détail (coût CI).
- [ ] c. **Audit UX** (skill `ux-audit`) sur le nouvel écran : cibles ≥ 44 px,
      3 crans de police, desktop + mobile — captures de référence.

### 3.5 Vérifications standard avant PR

- [ ] typecheck + lint + tests moteur + golden (inchangé) + garde-fou « zéro
      faction » + audit i18n (0 chaîne en dur, parité FR/EN) + budget bundle
      (composant UI : surveiller le gzip, pas d'asset) + smoke desktop/mobile.
- [ ] Skill `verify` : partie 2 villes → boucle complète en passant par la
      vue de royaume à chaque tour — le confort est le livrable.

## 4. Hors périmètre (assumé)

- Guilde des voleurs / comparatif inter-joueurs (E3, P2 — étape 3 doc 18) :
  la vue de royaume ne montre QUE le joueur actif, aucune info adverse.
- Actions depuis la vue (construire/recruter à distance) : v2 éventuelle —
  ce lot est en lecture + navigation seulement (simplicité d'abord).
- Vue de ville peinte (D1) : jalon Beta, chantier assets distinct.

## 5. Risques

| Risque | Mitigation |
|---|---|
| Duplication de la formule de revenus côté client | helper pur moteur unique (3.2), patron R7 |
| Pile de modales > 2 (royaume → ville → recrutement) | la vue se ferme AVANT d'ouvrir `TownScreen` (remplacement, pas empilement) |
| Re-renders coûteux (grosse partie, 8 héros, N villes) | abonnements store sélectifs, listes plates sans canvas, filet perf 3.3 |
| Dérive CI (tentation d'un smoke par détail) | 1 smoke `@core` + 1 `@mobile`, le reste en revue visuelle + audit UX |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [ ] 3.1 écran + navigation
- [ ] 3.2 helper revenus (si nécessaire)
- [ ] 3.3 filet perf
- [ ] 3.4 tests + audit UX
- [ ] 3.5 vérifs + PR
