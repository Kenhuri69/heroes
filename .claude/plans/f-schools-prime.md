# Lot F-SCHOOLS.2 — École Prime (Necropolis), pur contenu

Backlog §2.3 (F-SCHOOLS, sous-lot .2). Jumeau strict de F-SCHOOLS.1 (Lumière) :
Necropolis a `spellSchool: null` (doc 04 §1 : école propre = **Nécromancie/Prime**,
« variante Terre au MVP : affaiblissement, animation, drain »). Pur contenu, **zéro
diff moteur** (école = chaîne opaque ; câblage client générique déjà livré).

## Portée F-SCHOOLS.2

- `SPELL_SCHOOLS` += `'prime'` (id d'école, distinct de la **compétence**
  `necromancy` de F-SKILLS pour éviter toute confusion).
- Necropolis `manifest.spellSchool = "prime"`.
- 4 sorts Prime dans `data/core/spells.json` réutilisant les kinds existants
  (thème doc 04 : affaiblissement/animation/drain) : Flétrissure (c1 debuff
  attackMod), Drain Vital (c1 damage), Carapace Osseuse (c2 buff def), Vague
  Mortifère (c3 damage `splash`). Noms FR/EN (`spell.<id>` core locales).
- Docs : doc 04 §1 (école Prime livrée).

## Invariants

- **Zéro diff moteur** (école opaque) — garde-fou vert, **golden inchangé**.
- **Aucun bump de sauvegarde**.

## Vérifs

typecheck · lint · engine+content · content:check (paquet Necropolis + 4 sorts +
clés de nom) · garde-fou · build · budget · smoke.

## Journal

- branche `claude/f-schools-prime` depuis `main` @ merge #244 (F-SCHOOLS.1).
