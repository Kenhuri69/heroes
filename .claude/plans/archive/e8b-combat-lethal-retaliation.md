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

- [x] typecheck / lint verts
- [x] client + content vitest verts (parité locale)
- [x] build + budget bundle ≤ 800 Ko gzip
- [x] garde-fous faction / couleurs verts
- [x] smoke @core desktop + mobile
- [x] golden inchangé (aucun fichier moteur touché)

## Notes

Réutilise le champ `retaliation` de `DamagePreview` (déjà produit par
`estimateDamage`) — aucune nouvelle logique moteur, aucun recalcul. **E8 clôt**
(pré-combat + in-combat) le pilier A3.

## Clôture (2026-08-24)

Plan **clos** par la passe `close-open-plans.md` : le code décrit ci-dessus était
déjà sur `main`, seule la trace de vérification manquait. Pipeline rejoué en
entier ce jour — typecheck ✓ · lint ✓ · tests **935 moteur / 165 contenu / 74
client** ✓ · `content:check` (7 paquets, 2 cartes, 16 scénarios) ✓ · garde-fous
faction & couleurs ✓ · build + budget bundle **364 866 o gzip** (cap 819 200) ✓ ·
smoke `@core` desktop + mobile **55/55** ✓ (54 au 1ᵉʳ passage : le test `ville`
mobile a dépassé le timeout **local** de 30 s sous contention CPU du conteneur —
rejoué seul : **22,1 s, vert** ; la CI utilise 45 s pour cette raison) · golden inchangé (aucun fichier
moteur touché).
