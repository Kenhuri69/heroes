# Lot — F2 revisit : correction de la variance des jets de dégâts

> Décision utilisateur : « f2 revisit ». F2 (revue perf lot 7b) plafonne les jets
> de dégâts à `MAX_DAMAGE_ROLLS = 10` puis met le total à l'échelle de l'effectif.
> **Diagnostic** : la mise à l'échelle est mathématiquement fausse — elle multiplie
> l'écart échantillonné par `N/rolls` (linéaire) au lieu de `√(N/rolls)`, ce qui
> **gonfle l'écart-type de √(N/10)** pour de grandes piles (mesuré : ×2.2 à N=50,
> ×4.4 à N=200, ×10 à N=1000). La moyenne reste juste, mais le **CV** (dispersion
> relative) devient constant (~0.078) au lieu de décroître en 1/√N — une pile de
> 1000 créatures frappe aussi « swingy » qu'une pile de 10. Le commentaire du code
> (« variance à peine accrue ») est faux.

## Correctif (moteur, 1 expression)

Dans `performStrike` (et miroir dans `estimateDamage` si concerné) :
- Avant : `base = round((sum/rolls) * count)` = `round(count·μ + dev·(count/rolls))`
- Après : `base = round(count·μ + dev·√(count/rolls))`, `dev = sum − rolls·μ`,
  `μ = (dmgMin+dmgMax)/2`, clampé à `[count·dmgMin, count·dmgMax]`.

Préserve **moyenne ET variance** (vérifié Monte-Carlo : SD ratio 0.98–1.01× vs
somme exacte, à N=10/50/200/1000), **même coût** (10 tirages), déterministe
(arithmétique + `sqrt` IEEE correctement arrondi, aucun transcendantal).

## Étapes

1. **Fix** `damage.ts` : remplacer la mise à l'échelle linéaire par √. → verify :
   test de plafond mis à jour (moyenne exacte ⇒ inchangée ; ajout d'une assertion
   de **variance** bornée à la somme exacte).
2. **Golden** : la branche N>10 n'est pas exercée par le replay (seule pile >10 ne
   frappe jamais) ⇒ golden **doit rester inchangé**. → verify : `golden-replay`.
3. **Impact équilibrage** : re-`faction:sim`. Le fix réduit la variance des grandes
   piles ⇒ les duels valeur-égale peuvent bouger vs la passe 2 (calibrée sur le
   F2 bogué). → si régression (béances qui reviennent) : **s'arrêter et demander**
   avant tout re-tuning (sous-lot subjectif distinct).
4. Recette : typecheck · lint · engine test (golden) · content · build · bundle ·
   smoke @core · gardes faction/couleurs. Doc 02 §5.3 (note perf) alignée.

## Journal
- [x] Fix `damage.ts` : écart × **√(count/rolls)** (au lieu de count/rolls), clampé
      aux extrêmes. Commentaire du bloc `MAX_DAMAGE_ROLLS` corrigé (variance juste).
- [x] Test variance ajouté (`combat-damage.test.ts`) : dé [1,6] × 1000, 120 graines
      ⇒ SD ∈ [20,150] (vraie ≈54, ancien ≈540 exclu) ; moyenne ∈ [3400,3600].
- [x] **Golden inchangé** (branche N>10 non exercée par le replay) — engine 847.
- [x] **faction:sim inchangé : toujours 1 béance** (AH-vs-dungeon 83→85, bruit de
      seuil) — la passe 2 tient sous le modèle corrigé, **pas de re-tuning requis**.
      Gauntlet légèrement resserré (dungeon 2.0→2.2).
- [x] Recette : typecheck · lint · content 148 (**balance.test gaté OK**, grandes
      piles) · build · bundle 327 806 ≤ 819 200 · smoke @core 26 · gardes
      faction/couleurs. Doc 02 : le cap F2 n'y est pas documenté (approximation
      perf) ⇒ rien à aligner ; le fix **rapproche** l'implémentation du modèle
      documenté « somme de N dés ». CLAUDE.md note.
