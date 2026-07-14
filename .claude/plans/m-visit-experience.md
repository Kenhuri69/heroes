# M-VISIT — lieu visitable « expérience » (Pierre du Savoir / Learning Stone)

> Lot atomique du backlog `game-feature-gaps.md` §2.5 M-VISIT (« Autres
> VisitableEffect (ex. grantXp fixe) »). Nouveau variant **générique** de
> `VisitableEffect` : un lieu qui accorde un **montant fixe** d'XP au héros
> visiteur — distinct de `levelXp` (arbre du savoir = XP jusqu'au niveau
> suivant). Réutilise `grantXp`. Patron VisitableEffect déjà rodé (6 kinds
> livrés). **Zéro faction moteur, pas de bump save, golden inchangé, pas de
> faction:sim.**

## Décision de conception

- HoMM classique distingue « Arbre de la Connaissance » (+1 niveau) de la
  « Pierre du Savoir / Learning Stone » (+montant fixe d'XP). Le moteur a
  déjà `levelXp` (le premier) ; ce lot ajoute le second.
- Variant `{ kind: 'experience'; amount: number }` — additif à l'union
  discriminée ⇒ rétrocompatible, aucun champ d'état neuf (`grantXp` mute
  `hero.xp`/`level`, champs déjà sérialisés). **Pas de bump save.**
- Handler = 2 lignes : `grantXp(draft, events, hero.id, effect.amount)` puis
  `amount = effect.amount`. Le crédit d'XP peut faire monter de niveau (file
  de choix humain / tirage IA), exactement comme `levelXp`.
- Client : réutilise le toast existant `toast.bonusXp` (même message « +N XP »).

## Étapes (chaque étape → vérif)

1. [x] **engine/adventure/map.ts** — variant `{ kind: 'experience'; amount }`
   de `VisitableEffect`. → verify: typecheck.
2. [x] **engine/adventure/visitable.ts** — branche `experience` : `grantXp` +
   `amount`. → verify: typecheck + test.
3. [x] **content/schemas.ts** — variant Zod `experience` (amount int positif).
4. [x] **content/loader.ts** — union `ResolvedMapObject` += `experience`.
5. [x] **client/ui/MapObjectCard.tsx** — case `experience` → `mapCard.effectExperience`.
6. [x] **client/render/mapObjects.ts** — teinte + silhouette (tome/livre) `experience`.
7. [x] **client/app/notifications.ts** — `experience` ⇒ `toast.bonusXp`.
8. [x] **data/core/locales/{fr,en}.json** — `mapCard.effectExperience`.
9. [x] **data/maps/proto-01.map.json** — `pierre-savoir-1` (experience +1000, 9,7).
10. [x] **test map-visitables.test.ts** — accorde l'XP fixe + visite consommée.
11. [x] **docs/02-mechanics.md §2.2** — mention de la Pierre du Savoir.

## Vérifs pipeline (avant push)

- [x] `pnpm typecheck` 5/5
- [x] `pnpm lint`
- [x] vitest engine 731 (golden + save-shape INCHANGÉS — additif pur)
- [x] vitest content 126
- [x] `pnpm content:check` (proto-01 revalidée)
- [x] garde-fou faction (statut grep 1)
- [x] garde-fou couleur CSS (statut grep 1)
- [x] `pnpm build` + bundle gzip 312839 < 819200
- [x] `pnpm smoke` (101 passed)
- faction:sim : **non requis** (aucun équilibrage de faction touché).

## Écarts constatés

- RAS.

## Journal

- 2026-07-14 — Lot créé, branche `claude/m-visit-experience` depuis origin/main.
