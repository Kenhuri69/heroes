# E8 (moitié in-combat) — Avertissement de riposte mortelle

Complète la paire E8 (`game-ergonomics-immersion-review.md`) : après la moitié
**pré-combat** (`e8-prebattle-overwhelm-warning.md`), voici la moitié
**in-combat**. Client seul, **zéro moteur** (réutilise l'estimation de riposte
déjà calculée par `estimateDamage`), pas de bump save, golden inchangé.

## Constat (E8, moitié in-combat)

En combat manuel, la préviz de dégâts (`combatPreview`) annonce déjà la **riposte
estimée** de la cible — mais rien ne signale que cette riposte **anéantirait la
pile attaquante**. Le joueur peut lancer une frappe « suicidaire » sans alerte.

## Approche (tap-tap, non bloquante)

Fidèle au modèle tap-tap (1er tap = préviz, 2ᵉ tap = exécute) et cohérent avec
l'alerte pré-combat : on **ajoute un avertissement** dans le bandeau de préviz,
pas une modale bloquante. Le joueur garde la décision.

- `combat.tsx` : quand la préviz d'attaque porte une `retaliation` dont le
  **minimum** (`retaliation.damageMin`) ≥ **PV totaux de la pile attaquante**
  (`(count-1)·hp + firstHp`), afficher un bandeau `role="alert"`
  « ⚠ Riposte mortelle » sous la préviz. Seuil = riposte **minimale** létale ⇒
  perte **certaine** de la pile (pas de sur-alerte). `retaliation` est déjà
  `null` pour un tir / une cible qui ne riposte pas ⇒ aucun faux positif.
- Locale FR/EN `combat.lethalRetaliationWarning`.
- CSS `.damage-preview-warning` (couleur `--danger-text`, tokens uniquement).

## Vérification

- [ ] typecheck / lint verts
- [ ] client + content vitest verts (parité locale)
- [ ] build + budget bundle ≤ 800 Ko gzip
- [ ] garde-fous faction / couleurs verts
- [ ] smoke @core desktop + mobile
- [ ] golden inchangé (aucun fichier moteur touché)

## Notes

Réutilise le champ `retaliation` de `DamagePreview` (déjà produit par
`estimateDamage`) — aucune nouvelle logique moteur, aucun recalcul. **E8 clôt**
(pré-combat + in-combat) le pilier A3.
