# Lot F-RESON.1 — application du cap de ressource de faction au gain

Backlog §2.3 (F-RESON 🧩 M, découpé). Bug : la ressource de faction déclare une
**capacité** (`factionResources[].cap` — Résonance/Essence = 999, doc 16 §3.2 /
doc 05 §3.3), mais le gain post-victoire (`gainFactionResourceOnVictory`,
`faction/effects.ts`) **ajoute sans plafonner**. Ce sous-lot **applique le cap au
gain**. (La génération de Résonance intra-combat par les « performeurs » = nouvelle
surface de combat, différée en F-RESON.2.)

## Portée F-RESON.1

- **Moteur** `faction/types.ts` : `GainFactionResourceOnVictoryBonus` gagne
  `cap?: number` (optionnel ⇒ vieilles saves gracieuses : cap absent = non plafonné).
- **Contenu** `loader.ts` (`buildFactionCatalog`) : **estampille** le `cap` sur
  chaque bonus `gainFactionResourceOnVictory` depuis le `factionResources[].cap`
  correspondant du même paquet (dérivé, pas authored ⇒ pas de champ de schéma).
- **Moteur** `faction/effects.ts` : le gain devient
  `max(current, min(current + amount, cap))` quand `cap` est défini (jamais de
  réduction d'un stock pré-seedé — patron R1 de la croissance de ville).
- **Docs** : doc 16 §3.2 (cap Résonance appliqué), doc 05 §3.3 (cap Essence).

## Invariants

- **Zéro faction** dans le moteur (cap = nombre opaque estampillé) — garde-fou vert.
- **Aucun bump de sauvegarde** : `cap` est une donnée de **catalogue** (embarquée
  à `StartGame`), optionnelle ⇒ pas de changement de forme d'état persisté.
- **Golden** : re-fixé UNE fois si l'estampillage du cap change le hash du
  `factionCatalog` embarqué (forme seule) ; sinon inchangé.

## Vérifs

typecheck · lint · engine+content (gain plafonné au cap ; gain sous le cap
inchangé) · content:check · garde-fou · build · budget · smoke.

## Journal

- branche `claude/f-reson-cap` depuis `main` @ merge #245 (F-SCHOOLS.2).
