# Lot M-TAVERN.1 — recrutement de héros à la Taverne (moteur)

Backlog §2.3 (A6 / M-TAVERN 🕳️ L, découpé). Débloqué par H-NAMED.1 (roster jouable).
Le moteur est **déjà largement multi-héros** (`state.heroes` est un tableau, la
plupart du code itère/`find` correctement — IA, élimination, machines de guerre).
Trous : id `hero-${p.id}` en collision, aucune commande `RecruitHero`, Taverne inerte.

## Portée M-TAVERN.1 (moteur ; client différé .2)

- **Taverne active** : nouvel effet de bâtiment `{type:'tavern'}` (`town/types.ts`) ;
  la Taverne core passe de `none` à `tavern`.
- **`GameState.heroRoster`** : le roster résolu (H-NAMED, `ResolvedHeroDef` par id)
  est **embarqué à `StartGame`** (comme `houseCatalog`) et **persisté** — nécessaire
  pour résoudre un recrutement en cours de partie. **Save bump 23→24**.
- **Commande `RecruitHero`** (`{ playerId, townId, heroId }`) : valide joueur actif,
  ville possédée avec Taverne bâtie, or ≥ coût, cap de héros non atteint (8),
  `heroId` dans le roster de la **faction de la ville**, pas déjà vivant chez ce
  joueur. Handle : crée le héros (id `hero-${playerId}-${heroId}`, identité résolue
  du roster, armée vide) à la tuile de la ville, décompte l'or, event `HeroRecruited`.
- **Config** : `hero.recruitCost` (or) + `hero.maxHeroesPerPlayer` (8) — data-driven.

## Différés (M-TAVERN.2+)

Câblage **client** (bouton Recruter + sélection du héros actif) ; **combat
héros-vs-héros** (`defenderHeroId`) ; **échanges** de troupes/artefacts entre héros
(UX-HEROSWAP) ; **exclusivité de pool inter-joueurs** (v1 : recrutement par joueur).

## Invariants

- **Zéro faction** moteur (roster/faction = ids opaques) — garde-fou vert.
- **Save bump 23→24** (un seul, `GameState.heroRoster`) ; `readSaveVersion` rejette
  proprement une autre version. Golden re-fixé (forme : `heroRoster:{}` ajouté).
- Le recrutement ne s'active qu'avec une Taverne bâtie + roster non vide.

## Vérifs

typecheck · lint · engine (recrutement OK / cap / sans Taverne / or insuffisant /
déjà recruté) + content · content:check · garde-fou · golden re-fixé une fois ·
budget · smoke.

## Journal

- branche `claude/m-tavern-recruit` depuis `main` @ 34c52d1 (H-NAMED.1 #255).
