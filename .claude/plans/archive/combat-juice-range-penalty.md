# Plan — Sprint 1 : « le combat se lit sans le log » (B6 + B1)

> **Statut** : plan détaillé rédigé, implémentation non lancée.
> Parent : `.claude/plans/mvp-game-loop-roadmap.md` (Sprint 1).
> Écarts couverts : **B6** (projectiles & FX de sorts) et **B1** (pénalité de
> portée de tir) de `docs/18-audit-fonctionnalites-vs-heroes-online.md`.

## 0. Objectif & critère de sortie

Une bataille doit se comprendre **écran seul** : chaque tir traverse le plateau,
chaque sort a un retour visuel distinct de la frappe physique, et les tireurs
ont un contre-jeu (½ dégâts à longue portée, fidélité HoMM3).

**Critère de sortie mesurable** : sur l'arène (`/#arena`), un observateur
distingue sans le journal : tir ↔ mêlée ↔ sort de dégâts ↔ soin ↔ buff/debuff ;
la préviz de dégâts affiche la pénalité de portée quand elle s'applique.

## 1. Invariants (guidelines §8)

- Zéro faction dans le moteur ; B1 = config **data opt-in** (absente ⇒
  comportement bit-identique ⇒ golden inchangé).
- FX = présentation pure : `render/combatFx.ts` ne touche jamais l'état moteur,
  consomme les événements déjà émis.
- Déterminisme : aucune `Math.random` — les variations visuelles (angle,
  scintillement) sont hashées sur `(stackId, round)` si besoin.
- `prefers-reduced-motion` + réglage vitesse (`appStore.combatSpeed`) respectés
  partout, comme les tweens existants.
- Pas de bump `CURRENT_SAVE_VERSION` (aucun champ d'état nouveau).

## 2. État des lieux (points d'ancrage vérifiés)

- `CombatScene.onEvent` sérialise les animations dans `this.queue` ; chaque
  type passe par `animateEvent` (switch, `CombatScene.ts:846`). Les FX
  transitoires vivent dans `this.fxLayer` et s'auto-détruisent (cf.
  `spawnDamageNumber`, `spawnFloatingLabel`).
- `animateAttack` (`CombatScene.ts:954`) fait **toujours** une ruée à 35 % du
  chemin — y compris pour un tir à 10 hexes (c'est le bug de lisibilité : le
  tireur « se rue » vaguement et rien ne vole).
- Le SFX `combat-shoot` existe déjà (`app/audio.ts`) et est joué sur les tirs.
- Moteur : la pénalité de mêlée passe par `meleePenalized` →
  `mult *= rules.rangedMeleePenalty` (`combat/damage.ts:276`) ; `rules` est le
  `CombatRulesConfig` chargé de `data/core/config.json → combat`. La préviz
  client (`scenes/combat/preview.ts`) est déjà branchée sur `estimateDamage`
  ⇒ tout ajout dans le pipeline de dégâts se propage à la préviz gratuitement.

## 3. Étapes

### 3.1 Moteur — pénalité de portée (`combat.rangePenalty`) [B1]

- [ ] a. Schéma/type : champ **optionnel** `rangePenalty?: { hexes: number;
      factor: number }` dans `CombatRulesConfig` (`engine/adventure/config.ts`)
      + validation Zod côté `@heroes/content` si le bloc `combat` y est décrit.
- [ ] b. Calcul : au point où `meleePenalized` est déterminé (résolution
      d'attaque dans `combat/actions.ts` + `estimateDamage`), calculer
      `rangePenalized = tir && hexDistance(attaquant, cible) > rules.rangePenalty.hexes`
      et propager un champ `rangePenalized: boolean` dans `DamageInput` ;
      dans `computeDamage` : `if (rangePenalized) mult *= rangePenalty.factor`.
      Cumulable en théorie avec rien (un tir n'est jamais `meleePenalized`).
      → vérif : unitaires `combat/damage` (voir 3.4).
- [ ] c. Données : activer dans `data/core/config.json → combat` :
      `"rangePenalty": { "hexes": 10, "factor": 0.5 }` (valeurs HoMM3).
- [ ] d. Doc : `docs/02-mechanics.md` §5.3 (formule de dégâts) — ajouter la
      ligne « ½ dégâts au-delà de 10 hexes », noter l'opt-in par config.

### 3.2 Client — préviz & indication de portée [B1]

- [ ] a. Vérifier que la préviz (`scenes/combat/preview.ts` + tooltip/fiche)
      reflète la pénalité via `estimateDamage` (attendu : automatique).
- [ ] b. Indication minimale côté plateau : lors du ciblage d'un tir pénalisé,
      la fourchette affichée suffit (pas de nouvel élément d'UI) ; si un
      marqueur s'avère nécessaire au playtest, petit glyphe « ↓ » près de la
      fourchette (jamais la couleur seule — doc 08).

### 3.3 Client — projectiles & FX de sorts [B6]

- [ ] a. Nouveau module **`packages/client/src/render/combatFx.ts`** (pure
      présentation) exposant :
      - `spawnProjectile(fxLayer, from: Point, to: Point, opts: { speed, reduced }): Promise<void>`
        — trait lumineux étiré (Graphics : segment + tête claire, léger arc
        quadratique si distance > 4 hexes façon boulet), tween ~90 ms/hex
        divisé par `combatSpeed` ; `reduced` ⇒ résolution immédiate (pas de vol).
      - `spawnSpellImpact(fxLayer, at: Point, kind: SpellKind, opts): Promise<void>`
        — par famille : `damage` = onde circulaire expansive + flash ;
        `heal` = 3-5 étincelles montantes ; `buff` = halo bref ascendant ;
        `debuff` = halo bref descendant sombre. Tout en Graphics procédural
        (palier 0 : **zéro asset**), objets transitoires auto-détruits
        (même patron que `spawnFloatingLabel`, gardes `destroyed`).
- [ ] b. **Tir** : dans `animateAttack`, si l'attaque est un **tir** (attaquant
      `shooter` non adjacent — recalculé depuis les positions des jetons +
      `hasAbility` du def d'unité, comme le fait déjà le moteur), remplacer la
      ruée par : micro-recul du tireur (~40 ms) → `spawnProjectile` →
      impact existant (tint rouge + `spawnDamageNumber` + secousse). La
      riposte à distance suit le même chemin. Mêlée : ruée inchangée.
      → le SFX `combat-shoot` coïncide enfin avec un visuel.
- [ ] c. **Sorts** : dans les cas `SpellCast` / `UnitSpellCast` de
      `animateEvent`, après la ruée du héros existante (`lungeHero`), appeler
      `spawnSpellImpact` sur la cible avec le `kind` du
      `spellCatalog[event.spellId]` (déjà consulté à `CombatScene.ts:907`).
      Sorts de zone : un impact par pile touchée si l'événement les énumère,
      sinon impact sur la cible principale (pas de sur-ingénierie).
- [ ] d. Intégration file B38 : tout FX awaité **dans** `animateEvent` (jamais
      en parallèle sauvage) ; les FX ne référencent que des jetons via les
      gardes `destroyed` existantes.

### 3.4 Tests (skill `test-authoring` : niveau le plus bas possible)

- [ ] a. **Unitaires moteur** (pas cher) : `combat/damage` — tir à ≤ hexes ⇒
      inchangé ; tir à > hexes ⇒ ×factor ; config absente ⇒ strictement
      identique à avant (non-régression) ; parité `estimateDamage` ↔ dégâts
      réels (le contrat de la préviz).
- [ ] b. **Golden** : inchangé attendu (les fixtures replay n'activent pas
      `rangePenalty`). Si le golden bouge ⇒ erreur d'implémentation (le champ
      n'est pas opt-in) — corriger, ne pas re-fixer.
- [ ] c. **Smoke arène** (1 seul cas, tag `@core`) : sur `/#arena`, un tir
      produit un nœud projectile (hook de test à la `tileToScreen` : exposer
      un compteur `window.__fx` en mode test OU vérifier l'existence d'un
      enfant nommé dans `fxLayer`) ; avec `prefers-reduced-motion` émulé, le
      combat reste jouable et aucun vol n'est animé.

### 3.5 Vérifications standard avant PR

- [ ] typecheck + lint + tests moteur (802+) + golden + garde-fou « zéro
      faction » + budget bundle < 800 Ko gzip (aucun asset ajouté ⇒ marge
      intacte) + smoke desktop/mobile.
- [ ] Skill `verify` : partie rapide → combat → tir visible → sort visible.

## 4. Hors périmètre (assumé)

- Sprites d'idle/walk des unités (B6 « éventuel idle 2 frames ») — différé.
- PNG de projectiles par famille d'unité (palier 1 assets) — le repli
  procédural EST le livrable de ce sprint ; l'art se branchera par simple
  dépôt (`assets/`, convention `import.meta.glob`).
- Toute retouche d'équilibrage au-delà de `rangePenalty` (attend `faction:sim`).

## 5. Risques

| Risque | Mitigation |
|---|---|
| Détection « tir » côté client divergente du moteur | réutiliser les helpers purs exportés (`hasAbility`, distance) sur les mêmes données ; en cas de doute, préférer enrichir l'événement `StackAttacked` d'un flag `ranged: boolean` (événement non haché ⇒ golden épargné — même patron que `survivors` sur `CombatEnded`) |
| Allongement de la durée des combats auto | vol de projectile ÷ `combatSpeed`, plafonné (~350 ms max), coupé en reduce-motion |
| Fuite d'objets FX | patron transitoire existant (self-destroy + gardes `destroyed`), filet `flushPendingDeaths` inchangé |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] 3.1 moteur `rangePenalty` — champ opt-in `CombatRulesConfig.rangePenalty`
      `{hexes,factor}` + Zod content ; `computeMultiplier` gagne `rangePenalized`
      (×factor, jamais cumulé avec `meleePenalized`) ; calculé dans `performStrike`
      ET `estimateDamage` (préviz = résolution) sur `hexDistance`. Données :
      `{hexes:10,factor:0.5}` (HoMM3). Golden **inchangé** (le journal golden n'a
      pas de tir long ; config opt-in).
- [x] 3.2 préviz — automatique via `estimateDamage` (branché de longue date) ;
      couvert par le test de parité `estimateDamage` ci-dessous.
- [x] 3.3 `render/combatFx.ts` (pur présentation, déterministe) : `spawnProjectile`
      (trait lumineux étiré + léger arc, plafond 350 ms, coupé en reduce-motion) et
      `spawnSpellImpact` (4 familles : onde `damage` / étincelles `heal` / halo
      montant `buff` / descendant `debuff`). Branchés : `animateAttack` route le
      TIR (`event.ranged`) vers micro-recul + projectile + impact (mêlée inchangée) ;
      `SpellCast` et **nouveau** `UnitSpellCast` (spellcaster : AUCUN visuel avant)
      appellent `spawnSpellImpact`. `UnitSpellCast` ajouté à `eventStackIds` (B38).
- [x] 3.4 tests — moteur : 3 cas B1 (`computeMultiplier` ×factor / opt-in ignoré /
      `estimateDamage` ½ à > seuil). Smoke : impact de sort (`combatFx().impacts>0`
      dans le test de sort existant) + **projectile** (tir manuel d'un archer ⇒
      `combatFx().projectiles>0` ; l'auto-combat détruit la scène ⇒ animations en
      combat MANUEL, documenté).
- [x] 3.5 vérifs + PR — typecheck/lint/838 moteur (golden `04cb6e08` inchangé)/
      148 contenu/content:check/garde-fous/bundle 325 Ko/smoke @core. PR à ouvrir.
