# Lot N-ARCS.2 — Arc personnel de Vhalen (Necropolis)

> Sous-lot de **N-ARCS** (backlog §2.8, doc 13 §5.4). Arcs livrés : Aldric
> (`haven-ch2`), Séraphine (`haven-ch3`, N-ARCS.1). Ce lot livre le **1ᵉʳ arc
> Necropolis — Vhalen** (doc 13 §5.4 : liche-archiviste doctrinaire — découvrir
> que le sceau nourrit Heresh en âmes depuis toujours, et que le réparer
> affamerait son peuple), en **données pures**, patron identique à Séraphine.

## Périmètre — données pures

- **Zéro diff moteur/client/save/golden** : réutilise le sous-système livré
  (quêtes `kind: personal`, `dialogBefore`, `choices`/`setFlag`, drapeaux). Aucune
  modif de schéma (Aldric/Séraphine exercent déjà tout).
- **Zone isolée** : `data/scenarios/necropolis-ch2.scenario.json` + locales core.
  Ne touche AUCUN `packages/*/src` ⇒ pas de collision avec les sessions F-SCHOOLS
  (combat) ni les héros nommés (code).
- Hôte = **necropolis-ch2** : Vhalen y est déjà personnage déclaré, aucun arc
  perso existant.

## Changements

1. `necropolis-ch2.scenario.json` : 3 dialogues (`dlg-vhalen-1/-2/-choice`, le
   dernier à 2 `choices` posant `vhalen-doctrine` / `vhalen-people`) + quête
   `vhalen-archives` (`kind: personal`, 3 étapes ; les 2 premières pré-satisfaites
   par l'armée de départ — `t3-spectre` ×6, `t4-vampire` ×3 ⇒ l'arc atteint son
   nœud de choix dès l'ouverture, comme Séraphine ; 3ᵉ étape = `defeatHero`).
2. `data/core/locales/{fr,en}.json` : clés `quest.vhalen-archives.*` +
   `dlg.vhalen.arc.*` (parité FR/EN, ton doctrinaire/archiviste).
3. `docs/13-plan-narrative-polish.md` §5.4 : arc de Vhalen livré. Backlog N-ARCS.

## Vérification

1. `pnpm --filter @heroes/content test` + `content:check` → scénario/locales
   valides, parité FR/EN.
2. `pnpm -r typecheck` ; `pnpm lint` → verts (aucun code touché).
3. Engine + golden + save-shape **inchangés** (aucune modif moteur).
4. `pnpm build` → bundle < 800 Ko gzip.
5. Garde-fou « zéro faction dans le moteur » (données, pas de code moteur).
6. Smoke Playwright : dérouler l'arc de Vhalen dans `necropolis-ch2` jusqu'au
   nœud de choix (2 boutons) → clic → drapeau `vhalen-doctrine` posé & persistant.

## Journal

- Plan créé ; template = arc Séraphine (`haven-ch3`) ; hôte `necropolis-ch2`
  (Vhalen déjà déclaré) ; thème doc 13 §5.4 (sceau nourricier vs peuple affamé).
- **Livré** : quête `vhalen-archives` (`personal`, 3 étapes) + 3 dialogues
  (`dlg-vhalen-1/-2/-choice`, choix `vhalen-doctrine`/`vhalen-people`) dans
  `necropolis-ch2` ; locales core FR/EN (parité, ton doctrinaire) ; doc 13 §5.4 +
  backlog mis à jour ; smoke `necropolis-ch2` → nœud de choix → drapeau posé.
- Vérifs vertes : typecheck 5/5, lint, content **119** (parité), content:check
  6 paquets / 12 scénarios, build (gzip ≈ 302 Ko < 800). **Zéro diff moteur/
  client/save/golden** (données pures). Smoke Vhalen + Séraphine 4/4.
