# Lot A2h — capacité `spellcaster` (unités lanceuses de sorts), engine-first

Backlog `game-feature-gaps.md` (CAP-CAST) : dernière famille de capacités de
combat. Des unités lancent un sort embarqué ×N charges par combat (Prêtresse
soin ×2, doc 03 §3 ; Bibliothécaire debuff ×2, doc 05 §4 ; Vox doc 16 §4).
Point d'extension moteur **générique**, data-driven, zéro nom de faction.

## Scope (décision : engine-first, UI différée)

Le tool de question utilisateur étant indisponible, choix par défaut **raisonné**
(cohérent avec la livraison « données/moteur d'abord » du projet) :

- **Livré ici** : le point d'extension moteur (état de charges, résolution de
  sort côté unité réutilisant le pipeline `CastSpell`) + **auto-cast** piloté par
  l'IA de combat (`chooseAction`) ⇒ **actif en tours IA et en auto-combat** ;
  données (Prêtresse) ; tests.
- **Différé (lot UI ultérieur)** : bouton de lancer côté client pour une pile
  **contrôlée manuellement** par le joueur (le `chooseAction` ne pilote que
  l'IA/auto-combat ; une pile jouée à la main garde attaque/déplacement/attente).

Rationale : borne le lot (pas de nouvelle surface UI + validation joueur),
délivre la capacité générique + son exercice réel (auto-combat, `faction:sim`).

## Impact save : **bump** (nouveau champ `CombatStack.spellCharges`)

Init au setup depuis `spellcaster.charges` (0 pour les non-lanceurs). Golden
re-fixé une fois (piles golden sans la capacité ⇒ seul `saveVersion` + le champ
`spellCharges: 0` s'ajoutent à la forme ; simulation inchangée).

## Modèle `spellcaster`

Params : `{ spellId, charges, power }`. La pile lance `spellId` (catalogue de
sorts partagé) jusqu'à `charges` fois/combat, Pouvoir effectif = `power` (pilote
dégâts/soin/durée — les unités n'ont pas d'attribut Pouvoir). Cibles : ennemi
(damage/debuff), allié (heal/buff), comme pour le héros.

## Étapes

1. **Résolution partagée** — extraire `applySpellToTargets(draft, combat, spell,
   target, power, luck, events) → {amount, kills}` de `handleCastSpell`
   (hero/index.ts) ; le chemin héros l'appelle (comportement identique).
2. **État** — `CombatStack.spellCharges` (types.ts) ; init `setup.ts` depuis
   l'ability ; `state.ts` bump `CURRENT_SAVE_VERSION` ; `save-shape` + golden.
3. **Action** — `CombatActionInput += { type:'castSpell'; targetStackId }` ;
   `applyAction` : résout via helper, décrémente `spellCharges`, `afterAction`
   (pas de riposte) ; `validateCombatAction` accepte (sûreté + futur UI) ; event
   `UnitSpellCast`.
4. **IA** — `chooseAction` : si la pile active est `spellcaster` avec charges et
   cible utile (heal ⇒ allié le plus blessé ; damage/debuff ⇒ meilleur ennemi),
   renvoyer `castSpell` en priorité.
5. **Données** — `spellcaster` dans `abilities.json` (→ 27) ; Prêtresse (T5
   Haven) dotée `spellcaster(soin, 2, 3)`.
6. **Docs** — doc 02 §5.4 (→ 27 + ligne) ; doc 03 (Prêtresse, `spellcaster`).
7. **Test** — `combat-spellcaster.test.ts` : l'IA Prêtresse soigne un allié
   blessé (charge décrémentée) ; charges épuisées ⇒ ne lance plus.
8. **Vérif** — `pnpm test`, typecheck, lint, `content:check`, garde-fou, build,
   smoke.

## Journal

- branche `claude/a2h-spellcaster` depuis `main` @ a247f8f.
- Scope : engine-first / auto-cast (tool de question utilisateur en échec
  répété — défaut raisonné, UI joueur différée, documenté PR).
- Refactor : cœur d'effet extrait dans **`combat/spell-effect.ts`**
  (`applySpellToTargets` + `spellTargets`/`damageOneStack` déplacés depuis
  hero/index.ts) — évite le cycle combat↔hero (combat n'importe jamais hero ;
  `hero/spells.ts` est une feuille pure). Chemin héros re-câblé dessus, **golden
  du combat de gardien inchangé en comportement** (176 tests combat/hero verts
  après refactor, avant l'ajout du champ).
- État : `CombatStack.spellCharges` (save **v19→v20**) ; init au setup ;
  `save-shape` → 20 ; golden re-fixé (`ce30195f`→`45a9d71f`, ajout `spellCharges:0`
  aux piles + saveVersion) ; +`spellCharges:0` propagé aux 27 fixtures de test.
- Action : `castSpell` ajouté à `CombatActionInput` ; `applyCastSpell`
  (résout via helper partagé, décrémente charge, pas de riposte) ; validation
  (lanceuse/charges/camp selon kind) ; event `UnitSpellCast`.
- IA : `chooseSpellcast` (heal → allié le plus blessé ; damage/debuff → meilleur
  ennemi ; buff → meilleur allié) branché en tête de `chooseAction`.
- Données : `spellcaster` dans `abilities.json` (→ 27) ; Prêtresse
  `spellcaster(soin, 2, 3)` (+ MàJ assertion faction-recruit t5).
- Docs : doc 02 §5.4 (→ 27 + ligne) ; doc 03 (Prêtresse) ; doc 07 §4 (v20).
- Test : `combat-spellcaster.test.ts` (IA soigne l'allié blessé / résolution +
  charge / rien à soigner ⇒ pas de lancer / plus de charges ⇒ pas de lancer).
- Vérif : `pnpm test` = 479 (engine, +4) + 101 (content) ; typecheck 5/5 ; lint ;
  `content:check` ; garde-fou vert ; build 277 Ko < 800. Smoke en cours.
- **Suivi ouvert** : lot UI joueur (bouton de lancer en combat pour une pile
  contrôlée à la main) — hors périmètre engine-first.
- Rebase (main avait avancé) : **collision de save** — M-CALENDAR avait pris v20
  (`Calendar.weekEventId`). A2h rebasé en **v21** ; golden re-fixé
  (`45a9d71f`→`f577968c`, weekEventId null + spellCharges 0 + saveVersion) ;
  save-shape → 21 ; doc 07 §4 alignée (v20 M-CALENDAR + v21 A2h). Post-rebase :
  `pnpm test` = 485 (engine) + 101 (content), typecheck/lint/content:check/
  garde-fou/build verts ; smoke relancé.
