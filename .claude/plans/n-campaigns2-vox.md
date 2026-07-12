# Lot N-CAMPAIGNS2 (tranche) — Prologue de campagne Vox Arcana

> Backlog : `.claude/plans/game-feature-gaps.md` §2.8 **N-CAMPAIGNS2** (campagnes
> Sylvan Court & Vox Arcana, données pures via le pipeline N3a). Design : doc 13
> §8.1 (une faction peut sortir sans campagne ; l'ajouter = test de modularité
> narratif). Ce lot livre **le chapitre 1** d'une campagne Vox Arcana — **4ᵉ test
> de modularité narratif**.

## Objectif

Une **campagne Vox Arcana** apparaît au menu et son **chapitre 1 est jouable**,
**100 % données** (patron `arcane-ch1`/`necropolis-ch1`) — **zéro octet de
moteur/client/save/golden**. Réutilise la carte `proto-01` (comme tous les
chapitres). Prologue : l'Académie tient le Honmoon face à une percée de
morts-vivants ; Hermione (voie de la magie) et Rumi (voie de la puissance)
rallient la garde.

## Contraintes / invariants

- **Données pures** : nouveau scénario + campaign.json + locales + index ;
  **zéro diff moteur/client** (le pipeline scénario/campagne existe déjà).
- **Zéro bump save, golden inchangé** (aucun replay de scénario dans le golden).
- Zone **isolée** (narratif/scénarios), hors zones chaudes.

## Étapes (avec vérif)

1. `data/scenarios/vox-ch1.scenario.json` — human Vox vs IA Necropolis sur
   proto-01, victoire `surviveDays`, dialogue d'ouverture (Hermione/Rumi), 1
   quête primaire `vox-ch1-honmoon` (build fort), 3 barks. → verify: content:check.
2. `data/scenarios/index.json` — += `vox-ch1`. → verify: content:check.
3. `data/factions/vox-arcana/story/campaign.json` — `vox-campaign` (1 chapitre).
   → verify: content:check (« campagne vox-campaign — 1 chapitre(s) »).
4. `data/core/locales/{fr,en}.json` — scenario/campagne/personnages/dialogues/
   quête/barks. → verify: content:check (parité FR/EN, 0 chaîne en dur).
5. `docs/13-plan-narrative-polish.md` + backlog N-CAMPAIGNS2 : tranche livrée.
6. **smoke** : la campagne Vox apparaît + chapitre 1 démarre (héros vox-arcana,
   dialogue, quête active) — patron N4a. → verify: smoke Playwright.

## Vérif finale

- typecheck 5/5, lint, tests moteur (inchangés), content:check (6→ paquets,
  scénarios +1, campagne +1), garde-fou « zéro faction » vert (data seulement),
  bundle < 800 Ko, smoke (+1 cas).
- **golden inchangé, pas de bump save** (données pures, hors replay).

## Journal

- **2026-07-12** — **Livré**. Campagne `vox-campaign` + prologue `vox-ch1`
  « La brèche » (données pures, patron `arcane-ch1`) : scénario (proto-01, Vox
  vs IA Necropolis, `surviveDays 2`, dialogue Hermione/Rumi, quête primaire
  `vox-ch1-honmoon` bâtir le Fort, 3 barks), `data/factions/vox-arcana/story/
  campaign.json` + `manifest.story`, index `vox-ch1`, locales core FR/EN
  (scénario/campagne/personnages/dialogues/quête/barks). doc 13 §8.1 + backlog.
  Écart relevé : la découverte de campagne exige `manifest.story` (ajouté) —
  sinon le `campaign.json` n'est pas chargé (`loadCampaigns`). Vérifs : typecheck
  5/5, lint, 666 tests moteur (inchangés), **content:check** (13 scénarios, 4
  campagnes dont vox), garde-fou « zéro faction » vert (data seulement), bundle
  307 Ko gzip < 800, **smoke** +1 cas (la campagne apparaît + le chapitre 1
  démarre : héros vox-arcana, dialogue, quête active) vert. **Zéro diff
  moteur/client/save/golden.**
