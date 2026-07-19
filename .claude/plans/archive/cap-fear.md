# CAP-MORAL `fear` — peur du Sombral (doc 16 §4)

> « go next » autonome. Backlog `game-feature-gaps.md` CAP-MORAL : ouvre la
> capacité générique **`fear`** (peur Sombral Vox) — dernière pièce moral/aura
> restante (immunité/aura déjà livrées).

## Conception (additive, sans bump save, golden stable)
- **`fear`** = capacité générique passive **sur frappe** (comme `curseOnHit` /
  `poisonSting`) : une frappe qui touche (non esquivée, cible survivante) a une
  chance d'**effrayer** la cible ⇒ elle **saute son prochain tour**. Réutilise le
  champ existant **`immobilizedRounds`** des piles de combat (mécanisme
  `pinningShot`) ⇒ **aucun nouveau champ d'état, pas de bump save**.
- `combat/damage.ts` : `fearPlan(def)` (params `chance` ∈ [0,1], `rounds`) + bloc
  d'application après le poison. Jet RNG **gated sur la capacité** ⇒ aucun tirage
  pour une unité sans `fear` ⇒ **golden inchangé** (unités golden sans peur).
- Event `StackFeared { targetId }` (pur événement, pas d'état sérialisé).
- Catalogue `data/core/abilities.json` : ajout `fear`.
- Données : `t5-sombral` (Vox) gagne `{ id: fear, params: { chance: 0.2, rounds: 1 } }`
  (doc 16 §4 : « peur — différé » ⇒ livré).
- Client : `CombatScene` — label flottant « peur » sur la cible (même patron que
  `StackCursed` « maudit », labels VFX courts hardcodés existants).

## Vérif
- Tests moteur (`combat-fear.test.ts`) : frappe d'un porteur `fear` (chance 1) ⇒
  `immobilizedRounds` de la cible ≥ 1 + event `StackFeared`, et la cible saute
  son tour ; sans capacité / chance 0 ⇒ aucun immobilize, **aucun RNG consommé**.
  **Golden inchangé**, save-shape inchangée.
- Content 101 (schéma : `fear` dans le catalogue, params libres). Typecheck/lint/
  build, garde-fou faction. Smoke (non-régression combat ; mécanique unit-testée).
- doc 16 §4 (Sombral peur livré) + backlog CAP-MORAL.

## Différés
- Autres pièces CAP-* actives (`spellcaster`, renaissance Phénix, barrière
  Avatar) ; peur en **prévisualisation** (side-effect probabiliste non prévisualisé,
  comme curseOnHit/poison).

## Journal
- Livré. `fear` (catalogue `abilities.json`), `fearPlan` + bloc d'application
  dans `combat/damage.ts` (jet gated sur la capacité, réutilise
  `immobilizedRounds`), event `StackFeared`, label combat « peur ». Données :
  `t5-sombral` `fear(chance 0.2, rounds 1)`. **Golden inchangé, pas de bump save**
  (aucun nouveau champ d'état, aucun RNG pour les unités sans peur). Vérif : 490
  tests moteur (4 fear), content 101, typecheck/lint/build (bundle < 800 Ko),
  garde-fou faction vert. La cible effrayée saute son tour dès l'avance
  d'initiative (skip `StackImmobilized`, prouvé en test). Mécanique probabiliste
  de combat ⇒ couverte par les tests unitaires (pas de smoke déterministe) ;
  smoke = non-régression combat. doc 16 §4 + backlog CAP-MORAL ✅.
