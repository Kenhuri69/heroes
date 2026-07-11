# Lot F-SCHOOLS.1 — École de la Lumière (Haven), pur contenu

Backlog §2.3 (F-SCHOOLS 🧩 M, découpé). Haven a `spellSchool: null` (doc 03 §1/§3 :
son école propre = **Lumière**, « variante Eau au MVP »). Ce sous-lot lui donne sa
**vraie école Lumière** — **exactement le patron livré pour la Scène (État 16.5,
Vox)** : pur contenu, **zéro diff moteur** (le moteur traite `SpellSchool` comme
une chaîne opaque ; le client câble déjà les écoles de faction génériquement —
`SpellBook` ordonne l'école propre, `game.ts` ajoute au pool de départ les sorts
de `manifest.spellSchool`).

## Portée F-SCHOOLS.1

- **Contenu (anti-typo)** : `SPELL_SCHOOLS` += `'lumiere'` (liste contrôlée de
  contenu, comme `scene` en 16.5) — **pas** un diff moteur (le moteur ne compare
  que l'égalité de chaîne).
- **Données** : Haven `manifest.spellSchool = "lumiere"` ; 4 sorts Lumière dans
  `data/core/spells.json` réutilisant les **kinds existants** (damage/heal/buff) :
  Trait de Lumière (c1 damage), Aura Sacrée (c1 buff def), Soin de Lumière (c2
  heal), Châtiment Céleste (c3 damage `splash`). Noms + textes d'ambiance FR/EN
  (`spell.<id>` core locales — exigé par `checkCoreNameKeys`).
- **Docs** : doc 03 §1/§3 (Lumière livrée), pas de nouveau mécanisme.

## Différés (F-SCHOOLS.x suivants)

Necropolis Nécromancie/Prime (doc 04 §1), complétion Traque 8 sorts (doc 05 §6 —
6 sorts exigent de **nouvelles** mécaniques de combat : téléport, silence,
bannissement, furtivité, noRetaliation conditionnel), effets Scène enrichis
(peur/+moral). Chacun = sous-lot dédié.

## Invariants

- **Zéro diff moteur** (le moteur voit `SpellSchool` = chaîne opaque) — garde-fou
  faction vert, **golden inchangé** (sorts hors replay inline).
- **Aucun bump de sauvegarde**.

## Vérifs

typecheck · lint · engine+content (`spellSchema` accepte `lumiere` ; content:check
valide le paquet Haven + les 4 sorts + clés de nom core) · content:check ·
garde-fou · build · budget · smoke.

## Journal

- branche `claude/f-schools-lumiere` depuis `main` @ merge #243 (F-BUILDEFF.4).
