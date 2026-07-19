# Lot 5b (P1) — Le combat prend vie : morts habillées (I4) + micro-secousse (I5)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 5, items 4 & 5. La mort d'une
> pile n'était qu'un **fondu d'alpha** ; aucun impact ressenti sur un kill entier.
> On habille la mort d'une **bascule ~90°** et on ajoute une **micro-secousse du
> plateau** (~4 px, 120 ms) au kill. **Zéro moteur, zéro asset**, pas de bump save.

## Changement (client)
- `combatFx.ts` : `combatShakeStats = { count }` (hook de test).
- `CombatScene.ts` :
  - `animateDeath` : en plus du fondu, le conteneur `bob` du jeton **bascule**
    (`rotation` 0→π/2) et, sur le kill, déclenche `shakeBoard`. **Reduce-motion**
    ⇒ fondu seul (comportement d'avant, ni rotation ni secousse).
  - `shakeBoard` : décale la **racine de scène** (`this.container`, toujours à
    l'origine ⇒ le pan/zoom de `camera.world` en dessous est préservé) en sinus
    amorti puis restaure ; **verrou** anti-cumul (kills en rafale de l'auto).
- `main.ts` : hook `combatShake() → { count }`.

## Vérification
- Smoke @core : combat manuel, un gros tireur one-shot une pile fragile ⇒
  `StackDied` ⇒ `combatShake().count > 0`. (Rotation = visuel pur, couverte par le
  chemin de mort exécuté sans erreur.)
- @perf arène ×4 inchangé ; typecheck · lint · engine (golden inchangé) · content ·
  client · build · bundle · smoke @core + mobile · gardes.

## Journal
- [x] `combatShakeStats = { count }` + `shakeBoard` (verrou `boardShaking`, décale
      `this.container` en sinus amorti puis restaure). `animateDeath` : bascule
      `bob.rotation` 0→π/2 + `shakeBoard` sur kill ; reduce-motion ⇒ fondu seul.
- [x] hook `combatShake()` (main.ts).
- [x] Smoke @core I5 (tireur ×40 one-shot 1 pile fragile — le défenseur garde une
      2ᵉ pile pour NE PAS finir le combat ⇒ scène vivante ⇒ `combatShake().count>0`).
      Recette : typecheck · lint · engine 897 (client-only ⇒ golden inchangé) ·
      content 154 · client 13 · build · bundle 335 844 ≤ 819 200 · smoke @core 28 +
      mobile 13 · **@perf arène ×4 21.7 fps** · gardes faction/couleurs propres.
- Note : la bascule de mort (I4) est un visuel pur ⇒ couverte par le chemin de mort
      exécuté sans erreur (le smoke asserte la secousse I5, signal déterministe).
