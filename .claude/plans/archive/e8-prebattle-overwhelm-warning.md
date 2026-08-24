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

- [x] typecheck / lint verts
- [x] client vitest vert (+ éventuel cas)
- [x] build + budget bundle ≤ 800 Ko gzip
- [x] garde-fous faction / couleurs verts
- [x] smoke @core desktop + mobile
- [x] golden inchangé (aucun fichier moteur touché)

## Différé

E8 in-combat (confirmation d'une frappe « suicidaire » via riposte estimée) —
reste dans le plan maître comme tail 🟡.

## Clôture (2026-08-24)

Plan **clos** par la passe `close-open-plans.md` : le code décrit ci-dessus était
déjà sur `main`, seule la trace de vérification manquait. Pipeline rejoué en
entier ce jour — typecheck ✓ · lint ✓ · tests **935 moteur / 165 contenu / 74
client** ✓ · `content:check` (7 paquets, 2 cartes, 16 scénarios) ✓ · garde-fous
faction & couleurs ✓ · build + budget bundle **364 866 o gzip** (cap 819 200) ✓ ·
smoke `@core` desktop + mobile **55/55** ✓ (54 au 1ᵉʳ passage : le test `ville`
mobile a dépassé le timeout **local** de 30 s sous contention CPU du conteneur —
rejoué seul : **22,1 s, vert** ; la CI utilise 45 s pour cette raison) · golden inchangé (aucun fichier
moteur touché).
