# Lot N-ARCS.4 — Arc personnel de Mère Corbeau (Necropolis)

> Sous-lot de **N-ARCS** (backlog §2.8, doc 13 §5.4). Aldric ✅ + Séraphine ✅
> (Haven), Vhalen ✅ (Necropolis, N-ARCS.2), Evadne ✅ (Arcane Hunters, N-ARCS.3).
> Ce lot livre le **2ᵉ arc Necropolis — Mère Corbeau** (doc 13 §3.3 :
> « recueillir l'âme d'un enfant de Cendregarde que le sceau retient, quitte à
> pactiser avec le Havre »), en **données pures**, patron identique à Vhalen.

## Périmètre — données pures

- **Zéro diff moteur/client/save/golden** : réutilise quêtes `kind: personal`,
  `dialogBefore`, `choices`/`setFlag`, drapeaux `campaignFlags`. Aucune modif de
  schéma.
- **Hôte = `necropolis-ch2`** (Mère Corbeau y est déjà un personnage déclaré,
  aux côtés de Vhalen). L'arc de Vhalen y vit déjà : le nouvel arc s'ajoute
  APRÈS `vhalen-sceau` dans le tableau `quests` ⇒ ses dialogues s'enfilent après
  ceux de Vhalen (le smoke Vhalen, qui s'arrête au 1ᵉʳ nœud de choix, reste vert).

## Changements

1. `necropolis-ch2.scenario.json` : 3 dialogues (`dlg-corbeau-1/-2/-choice`, le
   dernier à 2 `choices` posant `corbeau-pact` / `corbeau-refuse`) + quête
   `corbeau-enfant` (`kind: personal`, 3 étapes ; 2 premières pré-satisfaites par
   l'armée de départ ⇒ arc déroulé dès l'ouverture ; 3ᵉ = `defeatHero`).
2. `data/core/locales/{fr,en}.json` : clés `quest.corbeau-enfant.*` +
   `dlg.corbeau.arc.*` (parité FR/EN, ton « sage-femme des âmes » douce).
3. `docs/13-plan-narrative-polish.md` §5.4 + backlog N-ARCS mis à jour.

## Vérification

1. `pnpm --filter @heroes/content test` + `content:check` → valides, parité FR/EN.
2. `pnpm -r typecheck` ; `pnpm lint` verts (aucun code touché).
3. Engine test inchangé ; **golden + save-shape inchangés**.
4. `pnpm --filter @heroes/client build` → bundle < 800 Ko gzip.
5. Garde-fou « zéro faction dans le moteur ».
6. Smoke Playwright : nouveau cas — dans `necropolis-ch2`, résoudre le choix de
   Vhalen (avance la file) puis dérouler l'arc de Mère Corbeau jusqu'à son nœud
   de choix (2 boutons, pas de « Passer ») → drapeau `corbeau-pact` posé &
   persistant. Smoke Vhalen inchangé (s'arrête à son propre choix).

## Journal

- 2026-07-12 — Plan créé, branche `claude/n-arcs-mere-corbeau` depuis main (@4e35c4c).
- 2026-07-12 — **Implémenté**. Arc `corbeau-enfant` (3 dialogues `dlg-corbeau-1/
  -2/-choice` + quête `personal` 3 étapes, 2 pré-satisfaites par l'armée de
  départ, 3ᵉ `defeatHero`) ajouté APRÈS `vhalen-sceau` dans `necropolis-ch2` ;
  drapeaux `corbeau-pact`/`corbeau-refuse`. Locales core FR/EN (parité, ton
  « sage-femme des âmes »). Doc 13 §5.4 + backlog N-ARCS (5/6). Smoke : nouveau
  cas (résout le choix de Vhalen puis atteint celui de Corbeau → drapeau posé),
  patron robuste identique à Evadne.
  **Vérifs** : typecheck 5/5 ✅, lint ✅, content 123 tests + content:check (6
  paquets / 12 scénarios) ✅, parité FR/EN ✅, golden + save-shape inchangés ✅,
  build + bundle 305 Ko gzip ✅, garde-fou faction ✅. Zéro diff moteur/save/golden.
  Smoke en cours.
