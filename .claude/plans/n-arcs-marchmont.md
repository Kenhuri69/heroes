# Lot N-ARCS.5 — Arc personnel du Professeur Marchmont (Arcane Hunters)

> Dernier des **6 arcs personnels** (backlog §2.8, doc 13 §5.4). Aldric ✅,
> Séraphine ✅, Vhalen ✅, Evadne ✅, Mère Corbeau ✅ livrés. Ce lot livre le
> **6ᵉ et dernier arc — Marchmont** (Arcane Hunters, « Doyen des Sceaux »,
> doc 05 §7 / doc 13), en **données pures**. **N-ARCS complet (6/6).**

## Thème (doc 05 §3.4 — « le mensonge fondateur »)

Marchmont, Doyen des Sceaux, exhume via sa chouette les archives fondatrices :
le sceau que l'Académie surveille n'est pas ce que la doctrine prétend. Révéler
la vérité (au risque de l'autorité de l'Académie) ou protéger la doctrine qui
tient l'ordre. Drapeaux `marchmont-reveal` / `marchmont-protect`.

## Périmètre — données pures

- **Zéro diff moteur/client/save/golden** : quêtes `kind: personal`,
  `dialogBefore`, `choices`/`setFlag`, `campaignFlags`. Aucune modif de schéma.
- **Hôte = `arcane-ch2`** (déjà l'arc d'Evadne + une rencontre d'ouverture à
  choix). Nouvel arc ajouté APRÈS `evadne-verrou` ⇒ dialogues enfilés après ceux
  d'Evadne : le smoke Evadne (s'arrête à SON drapeau) reste vert. Marchmont ajouté
  aux `characters` (locale `character.marchmont.name` existe déjà).

## Changements

1. `arcane-ch2.scenario.json` : `characters += marchmont` ; 3 dialogues
   (`dlg-marchmont-1/-2/-choice`) ; quête `marchmont-mensonge` (`kind: personal`,
   3 étapes ; 2 pré-satisfaites par l'armée de départ — `t3-prefet`/`t1-eleve` ;
   3ᵉ `defeatHero`) après `evadne-verrou`.
2. `data/core/locales/{fr,en}.json` : `quest.marchmont-mensonge.*` +
   `dlg.marchmont.arc.*` (parité FR/EN).
3. `docs/13-plan-narrative-polish.md` §5.4 (6/6) + backlog N-ARCS.

## Vérification

1. `content:check` + content tests → valides, parité FR/EN.
2. `pnpm -r typecheck` ; `pnpm lint` (aucun code touché).
3. Golden + save-shape inchangés. Bundle < 800 Ko gzip. Garde-fou faction.
4. Smoke : nouveau cas — arcane-ch2, résoudre l'ouverture + le choix d'Evadne
   puis atteindre celui de Marchmont → `marchmont-reveal` posé (patron robuste
   Evadne). Smoke Evadne inchangé.

## Journal

- 2026-07-12 — Plan créé, branche `claude/n-arcs-marchmont` depuis main (@fd291e7).
- 2026-07-12 — **Implémenté**. `arcane-ch2` : `marchmont` ajouté aux characters ;
  3 dialogues (`dlg-marchmont-1/-2/-choice`) + quête `marchmont-mensonge`
  (personal, 3 étapes, 2 pré-satisfaites `t3-prefet`/`t1-eleve`, 3ᵉ `defeatHero`)
  après `evadne-verrou` ; drapeaux `marchmont-reveal`/`marchmont-protect`.
  Locales core FR/EN (parité). Doc 13 §5.4 (6/6) + backlog N-ARCS ✅. Smoke :
  nouveau cas (résout ouverture + choix Evadne puis atteint celui de Marchmont).
  **Vérifs** : typecheck 5/5 ✅, lint ✅, content 123 + content:check ✅, parité
  FR/EN ✅, golden + save-shape inchangés ✅, bundle 305 Ko gzip ✅, garde-fou
  faction ✅. Zéro diff moteur/save/golden. Smoke en cours. **N-ARCS complet.**
