# M-VISIT — bonus permanent d'attribut (doc 02 §2.2)

> « go next » autonome. Item M du backlog. Enrichit les lieux visitables d'un
> nouveau `kind` générique : **arène/statue** = +attribut primaire DÉFINITIF.

## Conception (bornée, sans bump save)
- `VisitableEffect` + variant `{ kind: 'permanentStat'; attribute; amount }`
  (`map.ts`). Variant optionnel ⇒ golden inchangé, pas de bump.
- `visitable.ts` : branche `permanentStat` ⇒ `hero.attributes[attribute] += amount` ;
  la re-visite est bornée par le registre `visits` existant (`oncePerHero`).
- content : schéma (`schemas.ts`) + type local `ResolvedMap` du loader.
- client : `MapObjectCard` (libellé) + `notifications` (toast) + locales FR/EN.
  `render/mapObjects.ts` gère déjà les kinds inconnus (repli obélisque).
- data : proto-01 `arene-1` (12,4), attack +1, oncePerHero.

## Vérif
- Tests moteur `map-visitables.test.ts` : gain permanent + unicité par héros.
  Golden inchangé. Content 101. typecheck/lint/build. Smoke (non-régression).
- doc 02 §2.2 + backlog mis à jour.

## Journal
- Livré. `permanentStat` de bout en bout (moteur/contenu/client/données), 466
  tests moteur (dont M-VISIT), content 101, golden inchangé (pas de bump).
  Différé : sanctuaire de sort / cabane de compétence (octroi hors montée).
