# Audit i18n — noms d'écoles de sorts manquants

Audit i18n du client (décision utilisateur « audit i18n »). Données/locales +
test uniquement, **zéro moteur, pas de bump save, golden inchangé**.

## Méthode & résultats

1. **Chaînes en dur** (JSX, `aria-label`/`title`/`placeholder`/`alt`) : aucune
   chaîne visible en dur (seuls des séparateurs `·` `aria-hidden`, un placeholder
   d'e-mail `you@example.com` universel — non traduit à dessein).
2. **Clés `t('…')` statiques** : les **573** clés littérales utilisées existent
   toutes dans `fr.json` **et** `en.json`.
3. **Parité FR/EN** : **1174** clés de chaque côté, **diff = 0**.
4. **Familles de clés dynamiques** (`t(\`prefix.${x}\`)`) : vérifiées
   `resource.*`, `guardianBand.*`, `combat.reason.*`, `attribute.*`,
   `skill.rank.*` ⇒ **complètes**. **UNE lacune trouvée** ↓.

### Lacune : `school.*` (BUG utilisateur)

`SpellBook.tsx` affiche un onglet + panneau par école via `t(\`school.${s}\`)`,
mais les locales **core** ne définissent que `air/earth/fire/neutral/water`.
Or **4 écoles supplémentaires** ont des sorts (core `spells.json`) et ne sont
définies **ni en core ni en paquet** (`t()` ne lit que le core) ⇒ le grimoire
affiche la **clé brute** (« school.traque »…) pour 4 factions :

| école   | sorts | faction        | FR       | EN    |
|---------|-------|----------------|----------|-------|
| lumiere | 4     | Haven (doc 03) | Lumière  | Light |
| prime   | 4     | Necropolis (04)| Prime    | Prime |
| traque  | 8     | Arcane Hunters | Traque   | Hunt  |
| scene   | 4     | Vox Arcana (16)| Scène    | Stage |

## Correctif

- `data/core/locales/fr.json` + `en.json` : ajouter `school.lumiere/prime/traque/
  scene` (noms des docs 03/04/05/16). (Ids d'**école** — pas d'id de faction ⇒
  garde-fou faction non concerné ; en `data/`, pas dans `packages/`.)
- **Test de régression** (`packages/content`) : toute école de sort référencée
  par un sort core a une clé `school.<id>` en core FR **et** EN — empêche la
  réapparition (une nouvelle école sans libellé casse le test).

## Vérification

- [ ] typecheck / lint / content vitest (+ nouveau test) verts
- [ ] parité FR/EN maintenue (content:check / parité)
- [ ] build + budget bundle ≤ 800 Ko gzip
- [ ] garde-fous faction / couleurs verts
- [ ] smoke @core desktop + mobile
- [ ] golden inchangé
