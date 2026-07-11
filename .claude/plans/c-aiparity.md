# C-AIPARITY — Parité IA : sorts du héros & attaque héroïque (backlog §2.1, 🧩 M)

Doc 02 §5.5 : l'IA de combat n'utilise ni `CastSpell` ni `HeroAttack` (livrés
côté joueur, gatés `combat.playerSide` dans les handlers). Un héros IA en
face du joueur (ou en auto-combat) n'exploite ni sa mana ni sa frappe — le
joueur a un avantage structurel, et l'auto-combat sous-évalue les héros.

## Décisions

- **Internes paramétrés par camp** : extraire de `handleCastSpell` /
  `handleHeroAttack` des fonctions `castHeroSpell(draft, side, …)` et
  `strikeWithHero(draft, side, …)` ; les handlers joueur les appellent avec
  `playerSide` (zéro changement de chemin joueur). L'IA les appelle avec son
  camp — les VALIDATIONS de commandes restent joueur-only (l'IA passe par
  l'interne, comme `applyAction`).
- **`heroCastThisRound: boolean` → `CombatSideId[]`** (camps ayant lancé ce
  round, miroir de `heroAttackUsed`) : le booléen partagé créerait une course
  entre les deux camps. Champ sérialisé ⇒ **bump `CURRENT_SAVE_VERSION`
  22→23**. Client : `combat.heroCastThisRound` → `.includes(playerSide)`.
- **Heuristique IA** (déterministe, zéro RNG dans le CHOIX) :
  - Sort (1/round, si mana ≥ coût) : dégâts ⇒ meilleur ennemi (valeur de
    cible) ; soin ⇒ allié le plus blessé (aucun blessé ⇒ garde la mana) ;
    debuff/marks ⇒ meilleur ennemi ; buff ⇒ meilleur allié. Réutilise la
    logique de `chooseSpellcast` (A2h) adaptée au grimoire du héros.
  - Attaque héroïque (1/combat, « si prête ») : meilleure cible au score
    `dégâts + kills × valeur` dès disponible.
  - Terminaison : sort borné par la mana (pas de régén en combat), frappe
    1×/combat ⇒ property « un combat se termine toujours » préservée.
- `faction:sim` inchangé (armées sans héros ⇒ no-op).
- Golden : si le replay inline comporte des combats avec héros IA, re-fixer
  le hash (opération documentée) — sinon inchangé.

## Étapes

1. [x] Types + save bump 22→23 (`heroCastThisRound: CombatSideId[]`),
   setup/turns/serialize alignés, client `combat.tsx` ajusté.
2. [x] `castHeroSpell`/`strikeWithHero` paramétrés par camp ; handlers joueur
   inchangés en comportement.
3. [x] `combat/ai.ts` : `maybeHeroAction(draft, side, events)` appelé dans
   `runAiIfNeeded` et `runAutoCombat` avant l'action de pile.
4. [x] Tests (`combat-ai-hero.test.ts`, 6 cas) : l'IA lance un sort (1/round, mana débitée, cible du bon camp),
   l'IA frappe au héros (1×/combat), le joueur garde son lancer (pas de course
   sur le flag par-camp), property + golden verts (ou golden re-fixé).
5. [x] Backlog C-AIPARITY ✅ ; doc 02 §5.6 note de parité ; doc 07 §4 v23 ;
   golden re-fixé (forme sérialisée : booléen → liste + saveVersion) ; smoke
   « sort du héros » aligné sur le verrou par-camp.
   → vérif : typecheck, lint, tests moteur/content, build, smoke combat.
