# Lot F-SKILLS.2-UI — UI joueur de la Prière de bataille

> La commande moteur `HeroRally` (Prière de bataille, F-SKILLS.2, doc 03 §2/§5)
> est livrée et **engine-first** (IA + auto-combat) mais SANS UI joueur. Ce lot
> ajoute le bouton de combat « Prière » + modale de ciblage d'une pile alliée +
> prévisualisation des créatures relevées, sur le patron de `HeroAttackModal` /
> `UnitSpellModal` (CAP-CAST). **Zéro règle nouvelle** : le moteur est déjà là.
> Backlog §2.3 F-SKILLS (tranche UI).

## Décision UX

- Patron **modale + liste de cibles alliées** (comme `HeroAttackModal` C1 et
  `UnitSpellModal` CAP-CAST), PAS le ciblage d'hex `combatSpellTarget` (réservé au
  Pas-de-Brume, qui vise une case vide). La Prière vise une **pile**, la liste
  tap-tap est plus simple et touch-first (cibles ≥ 44 px héritées de `.spell-target`).
- Prévisualisation OBLIGATOIRE avant confirmation (doc 08 §1.4/§2.4) : par cible,
  nombre de créatures **ressuscitées** + PV rendus (helper moteur pur, sans RNG).

## Changements

### Moteur (helpers PURS read-only — zéro impact golden/save/forme)
- `combat/spell-effect.ts` : extraire `resolveResurrect(def, target, lostSoFar, hp)`
  (maths pures : `{ newCount, newFirstHp, healed, revived }`) ; `resurrectStack`
  l'applique — **comportement byte-identique** (mêmes calculs) ⇒ golden inchangé.
- `combat/hero-rally.ts` : `estimateHeroRally(state, targetStackId)` → `{ healed,
  revived }` (préviz sans mutation ; réutilise `collectCasualties` + `resolveResurrect`).
- `index.ts` : exporter `heroRallyHp`, `canHeroRally`, `estimateHeroRally`
  (patron des helpers client-consommés : `heroAttackDamage`, `estimateUnitSpell`).

### Client
- `ui/combat.tsx` : bouton `combat-prayer` (gate `canHeroRally` + `!autoActive`) ;
  `PrayerModal` (liste des piles ALLIÉES vivantes, préviz par cible via
  `estimateHeroRally`, dispatch `HeroRally { targetStackId }`).
- `app/combat-log.ts` : `case 'HeroRallied'` → `combatLog.rallied`.
- locales FR/EN : `combat.prayer`, `combat.prayerPreview`, `combatLog.rallied`.

### Doc
- doc 08 §2.4 : mentionner le bouton « Prière » (miroir « Attaque du héros »).

## Vérification

- smoke : dans le combat existant (test C1), le bouton `combat-prayer` est **présent
  et désactivé** (héros de départ sans compétence `battleResurrectHp`) — « gating
  d'absence vérifié » comme F-SKILLS.2. Le flux actif (héros doté) n'est pas
  smoke-déclenchable sans référencer une faction (interdit) ⇒ couvert par les
  tests moteur `combat-hero-rally` déjà livrés.
- typecheck 5/5 · lint · engine (golden + save-shape **INCHANGÉS**) · content +
  content:check · garde-fous faction/couleur · build + bundle gzip < 800 Ko · smoke.
- Pas de `faction:sim` (aucun changement d'équilibrage).

## Journal

- 2026-07-13 — Plan créé, branche `claude/f-skills-battle-prayer-ui` depuis origin/main.
