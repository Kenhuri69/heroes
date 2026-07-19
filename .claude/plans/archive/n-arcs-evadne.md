# Lot N-ARCS.3 — Arc personnel d'Evadne (Arcane Hunters)

> Sous-lot de **N-ARCS** (backlog §2.8, doc 13 §5.4). Aldric ✅ + Séraphine ✅
> (Haven) + Vhalen ✅ (Necropolis). Ce lot livre le **1er arc Arcane Hunters —
> Evadne Corvel** (doc 13 §3.4 : « la relique greffée sur son visage provient
> du verrou de Cendregarde ; le sceau la reconnaît »), en **données pures**,
> patron identique aux arcs précédents.

## Périmètre — données pures

- **Zéro diff moteur/client/save/golden** : réutilise quêtes `kind: personal`,
  `dialogBefore`, `choices`/`setFlag`, drapeaux `campaignFlags`. Aucune modif de
  schéma.
- **Zone isolée** : `data/scenarios/arcane-ch2.scenario.json` + locales core.
- Hôte = **arcane-ch2** (Evadne & Aldric y sont déjà des personnages déclarés ;
  **aucun smoke ne pilote ce chapitre** — le smoke N4a ne démarre que le
  chapitre 0/ch1 ⇒ pas de collision).

## Changements

1. `arcane-ch2.scenario.json` : 3 dialogues (`dlg-evadne-1/-2/-choice`, le
   dernier à 2 `choices` posant `evadne-embrace` / `evadne-sever`) + quête
   `evadne-verrou` (`kind: personal`, 3 étapes ; 2 premières pré-satisfaites par
   l'armée de départ ⇒ nœud de choix dès l'ouverture ; 3ᵉ = `defeatHero`).
2. `data/core/locales/{fr,en}.json` : clés `quest.evadne-verrou.*` +
   `dlg.evadne.arc.*` (parité FR/EN, ton mirroir des arcs précédents).
3. `docs/13-plan-narrative-polish.md` §5.4 + backlog N-ARCS mis à jour.

## Vérification

1. `pnpm --filter @heroes/content test` + `content:check` → valides, parité FR/EN.
2. `pnpm -r typecheck` ; `pnpm lint` verts.
3. Engine test inchangé ; **golden + save-shape inchangés**.
4. `pnpm --filter @heroes/client build` → bundle < 800 Ko gzip.
5. Garde-fou « zéro faction dans le moteur ».
6. Smoke Playwright : nouveau cas — dérouler l'arc d'Evadne dans `arcane-ch2`
   jusqu'au nœud de choix (2 boutons, pas de « Passer ») → drapeau
   `evadne-embrace` posé & persistant.

## Journal

- **2026-07-12** — **Livré**. Arc `evadne-verrou` (3 dialogues + quête
  `personal`) dans `arcane-ch2` ; locales core FR/EN (parité) ; doc 13 §5.4 +
  backlog N-ARCS mis à jour. Le smoke gère la particularité du dialogue
  d'ouverture (qui porte déjà un choix Evadne↔Aldric) via une boucle qui résout
  chaque choix jusqu'à ce que le drapeau `evadne-embrace` soit posé.
  - **Vérifs** : typecheck 5/5 ; lint ; content **119** (parité FR/EN) +
    `content:check` 6 paquets / 12 scénarios ; engine inchangé (golden +
    save-shape inchangés) ; build gzip ≈ 305 Ko < 800 ; garde-fou « zéro
    faction » vert ; smoke (à confirmer). Zéro diff moteur/save/golden.
