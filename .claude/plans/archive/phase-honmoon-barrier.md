# Barrière du Honmoon — bouclier absorbant (doc 16 §7, différé Vox Arcana)

## Contexte

Dernière signature Vox Arcana non faite (Phénix/Sombral/Barrière-sort livrés).
Choix utilisateur : **bouclier absorbant lancé**, gaté par la Résonance. L'Avatar
du Honmoon (T8) projette une barrière qui **absorbe N PV de dégâts** sur les piles
alliées d'une **zone**, gatée par la ressource **Résonance**.

## Design (générique, 1 point d'extension moteur)

- **Capacité générique `barrier`** (data/core/abilities.json) params :
  `{ absorb: number, radius?: number, requiresResource?: { id, atLeast } }`.
  - `absorb` : PV de bouclier posés sur chaque pile alliée protégée.
  - `radius` : rayon hex (Chebyshev offset) autour du porteur ; absent ⇒ tout le camp.
  - `requiresResource` : **gate** — le joueur du héros du camp porteur doit avoir
    `factionResources[id] ≥ atLeast` ; absent ⇒ pas de gate. (Seuil atteignable
    plutôt que le `cap` 999 littéral — sinon jamais déclenché.)
- **Champ `CombatStack.shield?`** (optionnel paresseux) : réserve de PV absorbée
  AVANT les PV. Absent ⇒ pile non protégée (omis du JSON). Guard save-shape mis à
  jour (compile) ; **pas de bump** (patron `stealthed?`/`ownerHeroId?` : optionnel
  omis ⇒ vieux saves gracieux, golden inchangé).
- **Projection au SETUP du combat** (le plus chirurgical : pas de boucle
  spellcaster/IA/UI de ciblage) : après construction des piles, pour chaque camp,
  chaque pile `barrier` dont le joueur du héros du camp passe le gate ⇒ pose
  `shield = max(shield, absorb)` sur les piles alliées dans `radius`. Event
  `BarrierProjected`. « L'Avatar dresse le Honmoon à l'entrée en lice. »
- **Absorption** : helper `absorbShield(stack, amount)` réduit les dégâts par le
  bouclier (mute `shield`). Branché aux 2 voies de dégât principales : frappe
  (`performStrike`) et sort d'unité (`damageOneStack`). Splash (dérivé, déjà
  réduit) et DoT (poison) passent outre — limite MVP documentée.

## Données Vox Arcana

- Avatar T8 (`t8-avatar` + `t8-avatar-elite`, parité élite) gagne
  `barrier { absorb: 30, radius: 2, requiresResource: { id: 'resonance', atLeast: 40 } }`
  (40 = coût de recrutement Résonance de l'Avatar — « un Honmoon plein »).

## Invariants

Générique : `barrier` = capacité data (zéro nom de faction). `shield?` optionnel
⇒ **golden inchangé** (Avatar hors replay ; unités synthétiques sans `barrier`),
**pas de bump save**. Gate lit un id de ressource opaque + un seuil. Garde-fou
faction vert.

## Étapes

1. Ability catalog `barrier` + schéma params → verify: content:check.
2. `CombatStack.shield?` + save-shape StackKey guard → verify: typecheck + save-shape test.
3. `absorbShield` helper + branchement strike + damageOneStack → verify: typecheck, golden inchangé.
4. Projection au setup (gate ressource + radius) + event `BarrierProjected` → verify: typecheck.
5. Données Avatar (2 variantes) + parité élite → verify: content:check, elite-parity.
6. Client : event `BarrierProjected` au log ; bouclier affiché sur la pile si peu coûteux (sinon noté).
7. Docs 16 (§4/§7 barrière livrée) → verify: relecture.
8. Tests : engine (barrière absorbe une frappe ; gate ressource ; radius) → verify.
9. Vérif complète.

## Statut

- [x] **LIVRÉ.** Capacité `barrier` (catalogue) ; `CombatStack.shield?` (optionnel
      paresseux, guard save-shape MAJ, pas de bump) ; `absorbShield` + `barrierParams`
      (damage.ts) ; absorption branchée frappe (`performStrike`) + sort d'unité
      (`damageOneStack`) ; projection `applyStartingBarrier` au setup (gate ressource
      + radius hex) + event `BarrierProjected` ; données Avatar (2 variantes, parité
      élite). Client : log `BarrierProjected` + bouclier sur la fiche de pile (locales
      fr/en). Docs 16 (CAP-BARRIER + notes périmées Sombral/Phénix/Avatar corrigées).
- **Vérif** : typecheck ✓ · lint ✓ · **935 engine** (+5) ✓ · **156 content** ✓ ·
  **golden inchangé** · save-shape ✓ (pas de bump) · content:check ✓ · garde-fou
  faction ✓ · elite-parity ✓ · build ✓ · bundle **340.7 Ko** < 800 ✓ · smoke
  `@core` **35/35** ✓.
- **Limite MVP assumée** : projection au SETUP (pas de lancer ciblé mid-combat) ;
  splash/DoT passent outre. Lancer actif = différé.
