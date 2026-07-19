# Lot — Équilibrage passe 2 (tuning subjectif, données pures)

> Décision utilisateur : **scope = Crushers + Sylvan**, **levier AH = trim mark
> amplification**. La passe 1 (faction-sim-fidelity) a rendu le sim fidèle ; on
> tune enfin les stats. **Zéro moteur, zéro faction en dur, pas de bump save,
> golden inchangé** (unités synthétiques du replay ≠ unités de faction ; le
> replay n'a pas de `mark` ⇒ `targetMarks = 0` ⇒ `markBonusPerStack` no-op).
> Itératif : chaque changement → `faction:sim` → vérifier que la béance vise
> 20–80 % ET qu'aucune NOUVELLE béance n'apparaît.

## Baseline (main mergé, avant tuning)

Duel — **6 béances** (hors 20–80 %) :
- haven vs arcane-hunters — 5.4 / **94.6** (AH crush)
- haven vs necropolis — 11.7 / **88.3** (Necro crush)
- arcane-hunters vs necropolis — **80.8** / 19.2 (AH)
- arcane-hunters vs sylvan-court — **94.6** / 5.4 (AH)
- arcane-hunters vs dungeon — **94.2** / 5.8 (AH)
- necropolis vs vox-arcana — **84.2** / 15.8 (Necro)

Crushers : **AH** (4 béances, ~86 % avg) · **Necro** (2 béances, ~67 %).
Punching-bag : **Sylvan** (~23 % avg, perd contre tous). Gauntlet plancher :
dungeon 1.8 < sylvan/vox 2.0.

Diagnostic :
1. AH `mark` sur CHAQUE unité (auto à la frappe) = +8 %/charge ×3 = **+24 %**
   de dégâts army-wide, always-on, unique à AH ; + `consumeMarks` (T2 no-retal,
   T5 +40 %, T6 immobilise) + tankiness (def/hp) supérieure quasi chaque tier.
2. Sylvan `symbiosis` **remis à 0 dès que l'unité bouge/frappe** (actions.ts
   375/559) ⇒ ne monte jamais en combat agressif ⇒ T3/T6/T7 sans capacité utile.
3. Necro duel-crush = **stats d'unités** (la nécromancie post-victoire ne joue
   PAS dans un duel unique valeur-égale — à vérifier sur le lineup).

## Étapes (itératives, chacune re-simmée)

1. **Nerf AH — mark amplification.** `markBonusPerStack` 0.08 → 0.05 (config).
   Re-sim. Si AH reste > 80 % sur des paires : ajouter `marksMax` 3 → 2, puis
   éventuellement trimmer `consumeMarks`/tankiness. → verify : AH sort de la
   bande béante, pas de nouvelle béance.
2. **Nerf Necro — léger (stats).** Cibler ce qui crush Haven/Vox sans casser la
   nécromancie identitaire. → verify : necro-vs-haven & necro-vs-vox < 80 %.
3. **Buff Sylvan — stats/symbiosis (données).** Relever les 3 unités symbiosis
   (ou leurs params) pour compenser le non-ramp. → verify : Sylvan remonte,
   sort du plancher gauntlet.
4. Recette complète : faction:validate · content test/check · garde-fous
   faction/couleurs · typecheck · lint · engine test (**golden inchangé**) ·
   build · bundle · smoke @core. Docs 02/03/04/05/06/14 alignées si valeurs
   changées. CLAUDE.md note.

## Résultat livré

Duel : **6 → 1 béance** (la seule = AH-vs-dungeon 83.3, contre-pied thématique
tir-vs-mêlée-pure, assumé). Écart de puissance **divisé par ~2** (63 → 27 pts) :

| Faction | Baseline | Livré |
|---|---|---|
| Arcane Hunters | 85.8 % | **60.3 %** (dominance cassée) |
| Necropolis | 66.7 % | 64.3 % |
| Sylvan | 22.8 % | **48.3 %** (plus le punching-bag) |
| Haven | 46.6 % | 46.3 % |
| Vox | 44.7 % | 43.5 % |
| Dungeon | 41.4 % | 37.4 % |

Gauntlet resserré (1.8–3.0 → 2.0–3.0). Leviers (tous **données**, sauf le
config mark) :
1. **AH mark** : `markBonusPerStack` 0.08 → **0.05** (config). A réglé AH vs
   ses vrais rivaux (Necro/Vox). `marksMax` laissé à 3 (le baisser désactivait
   `consumeMarks` coût 3 de la Lame — refusé, casse furtive).
2. **AH kit** (au-delà du mark, décision « trim AH kit ») : tankiness rabaissée
   (T4 déf/PV, T5/T6/T7 PV) + tireur T3 att 6→5 ⇒ AH cesse de crush le trio
   faible. `consumeMarks` Lame gardé à +40 %.
3. **Necro** (durabilité, hors nécromancie/capacités) : T4/T5 PV, T7 déf/PV ⇒
   necro-vs-haven 88→72.
4. **Sylvan** : +déf/PV sur les 3 unités `symbiosis` (T3/T6/T7) — leur capacité
   ne monte jamais en combat agressif (reset à l'action) ⇒ base sous-statée
   compensée.
5. **Vox/Dungeon** (les 2 nouveaux planchers) : +PV ciblés (Vox T6/T7, Dungeon
   T4/T5) ⇒ necro-vs-vox 80.4→75 (résolu), Dungeon relevé sur ses matchups
   hors-AH.

*Sensibilité au seuil* : les duels valeur-égale basculent en bloc quand une stat
franchit un palier de kills ⇒ tuning empirique itératif (sim déterministe,
re-simmé à chaque pas ; reverts des changements non-positifs).

## Journal
- [x] Baseline capturé (6 béances).
- [x] Étape 1 (AH mark 0.08→0.05).
- [x] Étape 2 (Necro durabilité).
- [x] Étape 3 (Sylvan +déf/PV).
- [x] Étape 4 (AH kit + Vox/Dungeon planchers) — 6→1.
- [x] Formatage compact restauré (json.dump avait tout ré-indenté) — diff minimal.
- [x] Recette verte : content 148 (balance.test/elite-parity OK) · validate ×5 ·
      content:check 7 · gardes faction/couleurs · typecheck · lint · engine 846
      **golden inchangé** · build · bundle 327 743 ≤ 819 200 · smoke @core 26.
- [x] Docs 02/04/05/14/16/17 alignées (tables stats + mark 8%→5%) ; test
      `faction-recruit` (Sylvan T7 PV) mis à jour ; CLAUDE.md note.
