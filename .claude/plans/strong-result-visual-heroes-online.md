# Résultat fort — identité visuelle + héros nommés + cloud saves

> Demande utilisateur (2026-07-10) : traiter les options **2, 3, 4** du backlog
> `game-feature-gaps.md`, chacune dans un **commit indépendant**, en autonomie.
> Une seule branche `claude/cities-screen-ux-wemh1n`, une **PR draft** à la fin.
> Chaque lot doit être une tranche **réelle et vérifiée** (smoke vert), pas une
> demi-façade. Portée volontairement bornée là où le gap complet est L.

## Lot 2 — Identité visuelle : blasons sur plus de surfaces  (client pur)
Objectif : rentabiliser les blasons livrés (#190/#193) au-delà de l'en-tête de
ville. Cibles :
- **Écran pré-combat** (`PreBattleScreen`) : blason de faction de chaque camp.
- **Tiroir héros** (en-tête) : blason de la faction du héros.
Contraintes : `FactionBadge` existant (repli motif a11y intact) ; **zéro moteur**,
zéro save bump. Vérif : smoke — badges présents, non-régression.

## Lot 3 — Héros nommés + spécialité déclarative  (moteur + données, borné)
Ouvre le point d'extension **H-NAMED** en version bornée (taverne/pool différés) :
- Champs `name` (clé `@loc:`) + `specialtyId` sur `HeroState` (ou catalogue par
  heroId — décidé selon l'impact save).
- **Spécialité déclarative générique** : profil de bonus (attribut) appliqué à la
  création du héros — **aucun héros/faction en dur** dans le moteur (mirroir du
  pattern `houseAllegiance`/effets de compétence).
- Héros de départ **nommé + doté d'une spécialité** en données (`config.newGame`
  ou `heroes.json`).
- **UI** : nom + libellé de spécialité dans le tiroir héros.
- Save : bump `CURRENT_SAVE_VERSION` si la forme change ; **golden re-fixé**.
Vérif : test moteur (spécialité appliquée), smoke (nom/spécialité affichés),
golden vert, garde « zéro faction » vert.

## Lot 4 — Cloud saves câblées (NET-CLOUDSAVES)  (client, backend déjà déployé)
Câble le SDK `putSave`/`getSave` (déjà présent, endpoints Worker déployés) dans
l'UI, **derrière l'auth** :
- Section « En ligne » des sauvegardes : liste de slots cloud, envoyer / charger,
  horodatage. Garde de version client déjà en place.
- L'app hors-ligne est **inchangée quand non authentifié** (section masquée) ⇒
  smoke reste vert. ⚠️ Le chemin réseau authentifié n'est **pas couvert par le
  smoke headless** (pas de backend/auth en CI) — explicité dans la PR.
Vérif : typecheck/lint/build, smoke (app hors-ligne intacte), revue manuelle du
contrat SDK↔Worker.

## Critères transverses
- [ ] 1 commit par lot, messages clairs
- [ ] `pnpm typecheck` / `lint` / `build` OK, budget bundle tenu
- [ ] smoke Playwright vert après chaque lot
- [ ] golden re-fixé si save bump (lot 3)
- [ ] garde-fou « zéro faction dans le moteur » vert
- [ ] PR draft unique, corps détaillé + limites de vérif du lot 4

## Journal
- (à compléter au fil des lots)
