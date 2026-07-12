# Plan — Corrections équilibrage/combat/UI (retours de jeu)

Quatre points constatés en jeu :

1. **Moulin / or aléatoire** : quand l'objet de carte donne de l'or, il en donne
   1 au lieu de respecter un palier (250/500/1000 selon la ressource rare/…).
2. **Abandon en pré-combat** : ajouter un bouton « Abandon » (retraite) à côté de
   « Combattre » et « Auto-Battle » pour pouvoir renoncer une fois la puissance
   ennemie connue.
3. **Paliers de niveau du héros** : commencer à 1000 XP.
4. **Écran de fin de combat** : lister morts/survivants par armée + gains XP et
   ressources.

## Étapes

- [x] 1. Moulin : `mapgen.ts` — l'or suit les paliers 250/500/1000 (comme les
      mines), les autres ressources 1–3. → vérifié : typecheck + content:check.
- [x] 2. Pré-combat : bouton « Abandonner » → commande moteur générique
      `AbandonCombat` (garde l'armée survivante, gratuit, gate round 1) + bouton
      UI **uniquement** sur `PreBattleScreen` (jamais en bataille — choix
      utilisateur « Ici, mais pas en bataille »). → vérifié : tests moteur +
      smoke `abandon pré-combat`.
- [x] 3. Paliers XP dès 1000 : `config.json` `levelCurve.base` 1000 → 268
      (niveau 2 = 1000 XP, exposant 1.9 inchangé). Fixture `testConfig` gardée à
      1000 (double de test, évite le churn ; golden inline non affecté). →
      vérifié : experience.test re-fixé, 667 tests moteur verts.
- [x] 4. Écran de résultat : événement `CombatEnded` enrichi de `survivors` ;
      `dispatch.buildCombatResult` agrège pertes/survivants + XP/or/ressources/
      artefact/mort-vivants ; composant `CombatResultScreen` (modale par-dessus
      la carte, « Continuer »). → vérifié : smoke `bilan de fin de combat`.

## Décisions / écarts

- **Abandon = pré-combat uniquement, garde l'armée** : `Retreat` existant perd
  toute l'armée (fuite) — trop punitif pour « je renonce avant d'échanger un
  coup ». Nouvelle commande `AbandonCombat` reconstruit l'armée depuis les
  survivants (aucune résurrection de pertes du round 1), gratuite, gate
  `round === 1`. UI seulement sur `PreBattleScreen` (confirmé par l'utilisateur).
- **Golden épargné** : `hashState` hache l'ÉTAT, pas les événements ⇒ ajouter
  `survivors` à `CombatEnded` n'affecte pas le golden. `config.json` (base 268)
  n'affecte pas le golden non plus (`GOLDEN_CONFIG` inline base 1000).
- **Bilan non affiché pour un départ délibéré** (fuite/reddition/abandon) : la
  décision est déjà explicite côté joueur.
- **Environnement** : smoke lancé avec `PW_CHROMIUM_PATH` (binaire Chromium 1194
  local ; Playwright 1.61 attend 1228, absent du conteneur).
