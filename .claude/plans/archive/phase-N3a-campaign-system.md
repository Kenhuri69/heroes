# Plan — Lot N3a : système de campagne + continuité héros

Cœur de N3 (doc 13 §4.1/§7) : transformer des scénarios isolés en **campagne
chapitrée** avec **continuité du héros** entre chapitres. Livré comme increment
prouvant l'infra sur une **campagne Haven à 2 chapitres** (le chapitre 1 = le
Prologue N2b réutilisé). Les campagnes complètes (3 chapitres, Necropolis),
cutscenes caméra et arcs de héros nommés suivent en N3b/N3c.

## Portée N3a

1. **Moteur** — `PlayerSetup` gagne des champs optionnels de **report de héros**
   (`startingLevel`, `startingXp`, `startingSkills`, `startingArtifacts` déjà là) ;
   le handler `StartGame` en dote le héros créé. Aucun bump de save (champs de
   commande, pas d'état ; le golden ne les exerce pas → inchangé).
2. **Contenu** — `campaignSchema` (`@heroes/content`) : campagne = id + factionId
   + chapitres ordonnés (chapitre → scénario + titleKey/descKey). Fichier
   `data/factions/haven/story/campaign.json`. Loader `loadCampaigns`. `data/story/`
   dossier partagé introduit (characters.json déplacé/partagé — optionnel N3a).
3. **Données** — campagne Haven : chapitre 1 = `prologue` (réutilisé), chapitre 2
   = nouveau scénario `haven-ch2` (proto-01 re-skin, quêtes/dialogues propres).
   Locales.
4. **Client** —
   - `app/campaign.ts` : `campaignState` persistant (localStorage) —
     `{campaignId, chapterReached, heroCarry|null}` ; API start/advance.
   - Écran de **sélection de campagne** (menu) : campagnes + chapitres
     débloqués (jusqu'à `chapterReached`).
   - Démarrer un chapitre : `chapterStartCommand` (dérivé de `scenarioStart`)
     injecte le report de héros (`heroCarry`) dans le `PlayerSetup` humain.
   - À `GameEnded(won)` dans un chapitre de campagne : snapshot du héros +
     avance `chapterReached` + persiste ; `OutcomeOverlay` propose « chapitre
     suivant » (ou fin de campagne).
5. **Smoke** — démarrer la campagne Haven → gagner le chapitre 1 (assisté) →
   `chapterReached` avance + héros reporté (niveau/artefacts) ; chapitre 2
   débloqué et démarrable avec le héros reporté.
6. **Docs** — doc 13 (N3 scindé, État N3a), roadmap 09.

## Différé (N3b/N3c)

3ᵉ chapitre Haven + campagne Necropolis complète ; cutscenes caméra ; arcs
personnels des héros nommés (quêtes `personal`) ; cartes dédiées par chapitre
(N3a réutilise proto-01) ; `daily-templates` mode libre.

## Vérification par lot

- [x] typecheck 4/4
- [x] tests moteur 296 (golden inchangé + 2 tests report de héros)
- [x] tests content 74 (+ test campagne)
- [x] `content:check` (campagne haven-campaign, 2 chapitres)
- [x] garde-fou faction (grep CI local)
- [x] build client (< 800 Ko gzip)
- [x] smoke desktop + mobile (campagne : gagner ch1 → ch2 débloqué, héros reporté)

## Décisions / écarts

- **Report de héros** : `PlayerSetup` gagne `startingLevel/Xp/Skills/Artifacts`
  (optionnels, défaut = héros neuf → golden inchangé). `scenarioStartCommand`
  accepte un `HeroCarry?` qui dote le joueur humain. `campaignState`
  (localStorage) snapshotte le héros à la victoire d'un chapitre.
- **Chapitre gagnable en smoke** : le Prologue (= chapitre 1) passe de
  `eliminateAllEnemies` à `surviveDays: 2` — thématique « tenir Cendregarde » et
  déterministe au smoke. Artefact de départ `trefle-chance` ajouté pour prouver
  la continuité (persiste au chapitre 2).
- **`data/story/` par paquet** : campagne dans `data/factions/<id>/story/` via
  `manifest.story` (modularité doc 13 §8). `data/story/` partagé
  (characters/daily-templates) différé (personnages toujours dans le scénario).
- **Cartes dédiées différées** (N3a réutilise proto-01) ; 3ᵉ chapitre, campagne
  Necropolis, cutscenes, arcs de héros nommés → N3b/N3c.
