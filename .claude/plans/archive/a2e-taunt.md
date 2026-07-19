# Lot A2e — capacité `taunt` (provocation)

Backlog `game-feature-gaps.md` : dernière capacité défensive (CAP-DEF) manquante
côté Haven — le **Conscrit** « attire les attaques adjacentes » (doc 03 §3).
Point d'extension moteur **générique** (zéro nom de faction), data-driven.

## Interprétation retenue (documentée)

`taunt` est une capacité **défensive** portée par une pile. Règle de mêlée :

> Une **attaque de mêlée** lancée depuis une case adjacente à une (ou
> plusieurs) pile(s) ennemie(s) `taunt` **doit viser l'une de ces pile(s)
> provocatrice(s) adjacentes**.

- Le **tir n'est pas concerné** (la provocation « attire les attaques
  adjacentes » ; un tireur à distance garde sa cible). C-LOS/tir inchangés.
- Contrainte évaluée **par position de frappe** (la case d'où part la mêlée :
  position actuelle si déjà adjacente, sinon le `from` de repositionnement).
- Attaquer **n'importe quel** provocateur adjacent satisfait la contrainte
  (plusieurs provocateurs ⇒ le joueur choisit lequel).
- On ne peut pas « contourner » un provocateur pour frapper une pile derrière
  lui **si** on reste adjacent au provocateur.

Aucun nouvel état de pile ⇒ **pas de bump `CURRENT_SAVE_VERSION`**, golden
inchangé (aucune unité `taunt` dans le catalogue golden).

## Étapes

1. **Données** — ajouter `"taunt"` à `data/core/abilities.json` (→ 24) ;
   `abilities: ["taunt"]` sur `data/factions/haven/units/t1-conscrit.json`.
   → vérifier : `content:check` vert, garde-fou faction vert.
2. **Moteur** — helper pur `tauntersAdjacentTo(combat, catalog, side, pos)`
   dans `combat/actions.ts` ; contrainte appliquée dans
   `validateCombatAction` (chemin mêlée) et `attackableTargets` (surbrillance
   client) ; filtre des candidats IA dans `combat/ai.ts` (`chooseAction`).
   → vérifier : typecheck, lint.
3. **Docs** — `docs/02-mechanics.md` §5.4 (24 capacités + ligne sémantique) ;
   `docs/03-faction-haven.md` (Conscrit : `taunt` interprété).
4. **Test** — `packages/engine/test/combat-taunt.test.ts` : (a) mêlée depuis
   une case adjacente à un provocateur vers une autre cible ⇒ refus ; (b) vers
   le provocateur ⇒ accepté ; (c) tir ignore la provocation ; (d) `attackableTargets`
   n'expose pas la cible protégée en mêlée.
5. **Vérif complète** — `pnpm test` (engine+content), typecheck, lint,
   `content:check`, garde-fou faction, build, smoke Playwright. Golden **inchangé**,
   **pas de bump save**.

## Journal

- branche `claude/a2e-taunt` créée depuis `main` @ b5bea12.
- Données : `taunt` ajouté à `abilities.json` (→ 24) ; `[{ "id": "taunt" }]` sur
  le Conscrit. ✅ `content:check` vert, garde-fou faction vert.
- Moteur : `tauntersAdjacentTo` + `tauntBlocks` (actions.ts), contrainte dans
  `validateCombatAction` (mêlée) et `attackableTargets` ; filtre IA (ai.ts). ✅
  typecheck + lint verts.
- Docs : doc 02 §5.4 (24 capacités + ligne) ; doc 03 (bloc « État » Haven,
  Conscrit `taunt` interprété). ✅
- Test : `combat-taunt.test.ts` (4 cas : refus mêlée tierce / OK provocateur /
  tir ignore / attackableTargets). ✅ `pnpm test` = 461 + 101 verts, golden
  **inchangé** (`879c3291`), save v17 **non bumpé**. Build < budget (275 Ko).
- Écart relevé : mon 1ᵉʳ jet écrivait `abilities: ["taunt"]` (chaîne) → paquet
  Haven rejeté par le schéma ; corrigé en objet `{ "id": "taunt" }`.

