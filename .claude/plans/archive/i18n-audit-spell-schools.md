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
- **2ᵉ garde `@loc:` (suite d'audit)** : `loc-refs-resolve.test.ts` — TOUTE
  référence `@loc:` d'un paquet (récursif sur ses JSON) résout dans ses locales
  ou en core, FR **et** EN. Le loader (`content:check`) n'imposait que les noms
  d'unités/héros/faction/maison + loreKey d'unité ; ce test **généralise** aux
  refs non couvertes (**lore de bâtiment**, **campagnes**). Mutation-testé
  (retrait d'une clé ⇒ échec ciblé), puis restauré.

## Vérification

- [x] typecheck / lint / content vitest (+ nouveau test) verts
- [x] parité FR/EN maintenue (content:check / parité)
- [x] build + budget bundle ≤ 800 Ko gzip
- [x] garde-fous faction / couleurs verts
- [x] smoke @core desktop + mobile
- [x] golden inchangé

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
