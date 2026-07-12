# Lot N-ARCS.2 — Arc personnel de Vhalen (Necropolis)

> Sous-lot de **N-ARCS** (backlog §2.8, doc 13 §5.4). Aldric ✅ + Séraphine ✅
> (Haven, N-ARCS.1). Ce lot livre le **1er arc Necropolis — Vhalen** (doc 13
> §3.3 : « découvrir que le sceau nourrit Heresh en âmes depuis toujours, et
> que le réparer affamerait son peuple »), en **données pures**, patron
> identique aux arcs d'Aldric/Séraphine.

## Périmètre — données pures

- **Zéro diff moteur/client/save/golden** : réutilise quêtes `kind: personal`,
  `dialogBefore`, `choices`/`setFlag`, drapeaux `campaignFlags`. Aucune modif de
  schéma.
- **Zone isolée** : `data/scenarios/necropolis-ch2.scenario.json` + locales core.
  N'entre pas en collision avec la zone chaude héros/**code**.
- Hôte = **necropolis-ch2** (Vhalen & Mère Corbeau y sont déjà des personnages
  déclarés ; **aucun smoke ne pilote ch2** — le smoke N3b ne démarre que le
  chapitre 0/ch1 ⇒ pas de collision).

## Changements

1. `necropolis-ch2.scenario.json` : 3 dialogues (`dlg-vhalen-1/-2/-choice`, le
   dernier à 2 `choices` posant `vhalen-repair` / `vhalen-feed`) + quête
   `vhalen-sceau` (`kind: personal`, 3 étapes ; 2 premières pré-satisfaites par
   l'armée de départ ⇒ nœud de choix dès l'ouverture ; 3ᵉ = `defeatHero`).
2. `data/core/locales/{fr,en}.json` : clés `quest.vhalen-sceau.*` +
   `dlg.vhalen.arc.*` (parité FR/EN, ton mirroir Aldric/Séraphine).
3. `docs/13-plan-narrative-polish.md` §5.4 + backlog N-ARCS mis à jour.

## Vérification

1. `pnpm --filter @heroes/content test` + `content:check` → valides, parité FR/EN.
2. `pnpm -r typecheck` ; `pnpm lint` verts (aucun code touché).
3. Engine test inchangé ; **golden + save-shape inchangés**.
4. `pnpm --filter @heroes/client build` → bundle < 800 Ko gzip.
5. Garde-fou « zéro faction dans le moteur ».
6. Smoke Playwright : nouveau cas — dérouler l'arc de Vhalen dans `necropolis-ch2`
   jusqu'au nœud de choix (2 boutons, pas de « Passer ») → drapeau
   `vhalen-repair` posé & persistant.

## Journal

- **2026-07-12** — **Livré**. Arc `vhalen-sceau` (3 dialogues + quête
  `personal`) dans `necropolis-ch2` ; locales core FR/EN (parité) ; doc 13 §5.4
  + backlog N-ARCS mis à jour. Smoke : nouvel arc déroulé jusqu'au choix →
  drapeau `vhalen-repair` posé.
  - **Vérifs** : typecheck 5/5 ; lint ; content **119** (parité FR/EN) +
    `content:check` 6 paquets / 12 scénarios ; engine **inchangé** (golden +
    save-shape inchangés) ; build gzip ≈ 303 Ko < 800 ; garde-fou « zéro
    faction » vert ; smoke (à confirmer). Zéro diff moteur/save/golden ; zéro
    nom de faction dans le moteur.
