# Lot 5a (P1) — Le combat prend vie : idle procédural des jetons (I2/I3)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 5, item 1. Les jetons de
> combat sont **statiques** entre deux actions ⇒ le plateau paraît figé. On ajoute
> une **oscillation verticale subtile** (respiration), désynchronisée par pile,
> coupée en `reduce-motion`. **Zéro moteur, zéro asset** (uniquement `CombatScene`
> + `combatFx`), pas de bump save.
>
> Constat : les items 2 (projectiles), 3 (impacts de sorts) et une partie du 4
> (fondu de mort) de Lot 5 sont **déjà livrés** (`spawnProjectile` /
> `spawnSpellImpact` / `animateDeath`). Restent l'idle (ce lot), la **rotation**
> de mort (item 4) et le **screen-shake** (item 5) — sous-lots ultérieurs.

## Changement (client)
- `combatFx.ts` : `combatIdleStats = { bob: 0 }` (hook de test, comme
  `combatFxStats`).
- `CombatScene.ts` :
  - `buildStackToken` enveloppe le **visuel d'unité** (repli polygone puis sprite)
    dans un conteneur `bob` (l'ellipse de sol et le badge d'effectif restent fixes).
  - callback `app.ticker` : chaque jeton oscille `bob.y = sin(t·ω + φ)·AMP`
    (`AMP ≈ 1.5 px`, `φ` dérivé d'un hash déterministe de l'id ⇒ désynchronisé) ;
    `combatIdleStats.bob` = max |bob| courant. **Coupé en `reduce-motion`** (remet
    tous les `bob` à 0). Ticker retiré à `destroy`.
- `main.ts` : hook `combatIdle()` → `{ bob }`.

## Vérification
- Smoke @core : combat manuel ; `reduce-motion` ⇒ `combatIdle().bob === 0` ;
  motion ON ⇒ `bob > 0` (les jetons oscillent). Déterminisme moteur intact
  (rendu pur, aucun `Math.random`).
- Anti-gel @perf (arène ×4) inchangé.
- typecheck · lint · engine (golden inchangé) · content · client · build ·
  bundle · smoke @core + mobile · gardes.

## Journal
- [x] `combatIdleStats = { bob }` (combatFx.ts) + `idleTick` sur `app.ticker`
      (bob désync par `idlePhase(id)`, coupé en reduce-motion, retiré à `destroy`).
      Visuel d'unité enveloppé dans un conteneur `bob` interne (position hex et
      animations d'action intactes ; ellipse de sol + badge fixes).
- [x] hook `combatIdle()` (main.ts).
- [x] Smoke @core I2 (reduce ⇒ `bob===0` ; motion ⇒ `bob>0`). Recette :
      typecheck · lint · engine 890 (golden inchangé) · content 154 · client 13 ·
      build · bundle 334 998 ≤ 819 200 · smoke @core 27 + mobile 13 · **@perf arène
      ×4 19.8 fps (inchangé)** · gardes faction/couleurs propres.
- Constat consigné : items 2 (projectiles) / 3 (impacts sorts) déjà livrés ; item 4
      (mort) partiel (fondu OK, **rotation** à faire) ; item 5 (screen-shake) à faire
      ⇒ sous-lots 5b+ ultérieurs.
