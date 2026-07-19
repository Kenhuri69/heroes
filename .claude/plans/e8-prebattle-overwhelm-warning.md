# E8 — Garde-fou « combat très défavorable » au pré-combat

Item **client-only** restant du plan `game-ergonomics-immersion-review.md`
(constat E8, moitié pré-combat). Zéro moteur, zéro donnée de gameplay, pas de
bump save, golden inchangé.

## Constat (E8)

Le tap-tap + l'aperçu de dégâts suffisent au quotidien, mais **aucune alerte**
n'avertit le joueur quand il engage un combat à **puissance écrasante contre
lui** — alors que l'écran pré-combat affiche déjà `armyStrength` des deux camps.
C'est le seul trou du pilier A3 (« tap-tap avant action irréversible »).

## Décision de périmètre

- On traite la **moitié pré-combat** d'E8 : un bandeau d'alerte sur
  `PreBattleScreen` quand la puissance ennemie **écrase** celle du joueur.
  L'écran offre déjà *Combattre* / *Combat auto* / *Abandonner* — l'alerte rend
  le mauvais engagement **explicite** au point de décision.
- La moitié « in-combat » (avertir qu'une frappe précise sacrifie la pile via la
  riposte estimée) reste **différée** — valeur moindre, calcul de riposte
  attendue plus lourd ; notée dans le plan maître.

## Changements

- **`PreBattleScreen.tsx`** : calcule `playerPower`/`enemyPower` depuis
  `combat.playerSide` (les deux `armyStrength` sont déjà calculés). Si
  `enemyPower >= playerPower * OVERWHELM_RATIO` (= 2) et `playerPower > 0`,
  afficher un bandeau `role="alert"` `preBattle.overwhelmWarning` (glyphe ⚠ +
  libellé = double canal, jamais la couleur seule). → verify: siège/combat très
  défavorable ⇒ bandeau ; combat équilibré ⇒ absent.
- Locales FR/EN `preBattle.overwhelmWarning`.
- CSS `.pre-battle-warning` (couleur `--danger-text`, tokens uniquement).

## Vérification

- [ ] typecheck / lint verts
- [ ] client vitest vert (+ éventuel cas)
- [ ] build + budget bundle ≤ 800 Ko gzip
- [ ] garde-fous faction / couleurs verts
- [ ] smoke @core desktop + mobile
- [ ] golden inchangé (aucun fichier moteur touché)

## Différé

E8 in-combat (confirmation d'une frappe « suicidaire » via riposte estimée) —
reste dans le plan maître comme tail 🟡.
