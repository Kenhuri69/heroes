# Lot A2a — Capacités de combat (multiplier/gate/heal, vague 1a)

Sous-lot du lot A2 du backlog (CAP-DEF + CAP-ATK mêlée). A2 est marqué
« L découpable » : on le livre en sous-PR atomiques. **Empilé sur A1**
(`claude/a1-rules-data-fixes`, PR #191 non mergée) ⇒ branche
`claude/a2a-combat-capabilities` part de A1.

## Périmètre A2a — capacités DÉTERMINISTES (zéro nouveau tirage RNG)
Chacune = **un** point d'extension moteur **générique** (params en données) +
déclaration sur les unités concernées (guidelines §8, zéro nom de faction).

1. **shieldWall** (Frère-Lame Haven, doc 03 §3) : Défendre donne un multiplicateur
   de défense propre (param `defendMultiplier`, 1.5) au lieu de 1.3.
2. **unlimitedRetaliation** (Griffon Haven, doc 03 §3) : la pile riposte sans
   limite de 1/round.
3. **charge** (Chevalier du Griffon Haven `+5 %/hex`, Cavalier funeste Necro
   `+4 %/hex`, doc 03/04 §3) : bonus de dégâts mêlée = `perHex × hexes parcourus`
   avant la frappe (attaque volontaire, pas la riposte).
4. **magicResistance** autonome (Bibliothécaire AH 30 %, doc 05 §4) : réduit les
   dégâts de sort — aujourd'hui uniquement porté par `demonform`, ouvrir en
   capacité indépendante.
5. **lifeDrain** (Vampire Necro `50 %`, doc 04 §3) : la pile se soigne/relève de
   `pct × dégâts` infligés en mêlée (plafond = effectif de départ, réutilise le
   plafond de soin des sorts) ; nouvel event `StackHealed`.

## Reporté (A2b/A2c — nécessitent RNG / statuts / ordre / ciblage)
`incorporeal` (esquive RNG), `curseOnHit`/`poisonSting` (statuts, dont un champ
`damageMod`/DoT à ajouter), `firstStrike` (ordre de riposte), `strikeAndReturn`
(déplacement post-frappe), `taunt` (contrainte de ciblage).

## Étapes & vérifs
1. `data/core/abilities.json` : +`shieldWall`,`unlimitedRetaliation`,`charge`,
   `magicResistance`,`lifeDrain`.
2. `combat/damage.ts` : `defendMultiplier` param dans `computeMultiplier` ;
   `chargeBonus` (mult) ; `magicResistanceOf` lit aussi la capacité autonome ;
   `lifeDrain` post-frappe + event.
3. `combat/actions.ts` : gate `unlimitedRetaliation` (résolution) ; distance de
   charge calculée depuis la position d'origine.
4. `combat/damage.ts estimateDamage` : même gate riposte + defendMultiplier.
5. `core/events.ts` : `StackHealed`.
6. Données : déclarer les capacités sur Frère-Lame, Griffon, Chevalier du
   Griffon, Cavalier funeste, Bibliothécaire, Vampire.
7. Tests : `combat-capabilities.test.ts` (1 cas/capacité + estimate).
8. Vérifs : typecheck, lint, tests, content:check, garde-fou zéro faction,
   golden (inchangé attendu — aucune capacité A2a dans le catalogue golden),
   bundle, smoke. Pas de bump save version.

## Journal
- branche `claude/a2a-combat-capabilities` (empilée sur A1) + plan.
- Catalogue `abilities.json` : +shieldWall/unlimitedRetaliation/charge/
  magicResistance/lifeDrain (9 → 14 capacités).
- Moteur : `computeMultiplier` (defendMultiplier + chargeBonus) ;
  `magicResistanceOf` autonome ; helpers `shieldWallMultiplier`/`chargePerHex`/
  `lifeDrainPct` ; `performStrike` (charge + lifeDrain + event `StackHealed`) ;
  `applyAttack` (distance de charge, gate unlimitedRetaliation) ; `estimateDamage`
  (shieldWall + gate riposte). Client : chiffre de soin `+N` vert.
- Données : Frère-Lame(shieldWall 1,5), Griffon(unlimitedRetaliation), Chevalier
  du Griffon(charge 5 %), Cavalier funeste(charge 4 %), Vampire(lifeDrain 50 %),
  Bibliothécaire(magicResistance 30 %).
- Docs 02 §5.4 (14 capacités + table), 03/04/05 (notes « livré A2a »).
- Vérifs : typecheck 5/5, lint, **428** tests (+8 `combat-capabilities`),
  content:check, garde-fou zéro faction, golden **inchangé** (aucune capacité A2a
  dans le catalogue golden), bundle < 800 Ko gzip, pas de bump save version.
  Smoke : en cours.
- Reste : commit + push + PR draft (empilée sur #191).
