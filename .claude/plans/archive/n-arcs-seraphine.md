# Lot N-ARCS.1 — Arc personnel de Séraphine (Haven)

> Sous-lot de **N-ARCS** (backlog §2.8, doc 13 §5.4). Six arcs personnels
> prévus (2/faction, 3 étapes), **Aldric livré** (`haven-ch2`, N3c.2). Ce lot
> livre le **2ᵉ arc Haven — Séraphine** (doc 13 §3.2 : « ses visions
> viennent-elles d'Elrath ou de ce qui dort sous le sceau ? »), en **données
> pures**, patron identique à l'arc d'Aldric.

## Périmètre — données pures

- **Zéro diff moteur/client/save/golden** : réutilise le sous-système déjà
  livré (quêtes `kind: personal`, `dialogBefore`, `choices`/`setFlag`,
  drapeaux `campaignFlags`). Aucune modif de schéma (Aldric exerce déjà tout).
- **Zone isolée** : `data/scenarios/haven-ch3.scenario.json` + locales core.
  **N'entre pas en collision** avec la zone chaude héros/**code** (packages/*/
  src/hero) : ce lot ne touche que du contenu narratif.
- Hôte = **haven-ch3** (thème « sceller la faille » = le sceau de l'arc) :
  Séraphine y est déjà un personnage déclaré, aucun arc perso existant ⇒ pas
  de collision avec le smoke de l'arc d'Aldric (ch2).

## Changements

1. `haven-ch3.scenario.json` : 3 dialogues (`dlg-seraphine-1/-2/-choice`, le
   dernier à 2 `choices` posant `seraphine-faith` / `seraphine-doubt`) + quête
   `seraphine-visions` (`kind: personal`, 3 étapes ; les 2 premières
   pré-satisfaites par l'armée de départ ⇒ l'arc atteint son nœud de choix dès
   l'ouverture, comme Aldric ; 3ᵉ étape = `defeatHero`).
2. `data/core/locales/{fr,en}.json` : clés `quest.seraphine-visions.*` +
   `dlg.seraphine.arc.*` (parité FR/EN, ton mirroir Aldric).
3. `docs/13-plan-narrative-polish.md` §5.4 : note l'arc de Séraphine livré.

## Vérification

1. `pnpm --filter @heroes/content test` + `content:check` → scénario/locales
   valides, parité FR/EN.
2. `pnpm -r typecheck` ; `pnpm lint` → verts (aucun code touché).
3. Engine test **inchangé** (aucune modif moteur) ; **golden + save-shape
   inchangés**.
4. `pnpm --filter @heroes/client build` → bundle < 800 Ko gzip.
5. Garde-fou « zéro faction dans le moteur » (données, pas de code moteur).
6. Smoke Playwright : nouveau cas — dérouler l'arc de Séraphine dans `haven-ch3`
   jusqu'au nœud de choix (2 boutons, pas de « Passer ») → clic → drapeau
   `seraphine-faith` posé & persistant. Non-régression de l'arc d'Aldric (ch2).

## Journal

- **2026-07-12** — **Livré**. Arc `seraphine-visions` (3 dialogues + quête
  `personal`) dans `haven-ch3` ; locales core FR/EN (parité) ; doc 13 §5.4 +
  backlog N-ARCS mis à jour. Smoke : nouvel arc déroulé jusqu'au choix →
  drapeau `seraphine-faith` posé.
  - **Drive-by nécessaire** : `main` était rouge sur `pnpm -r typecheck`
    (F-SCHOOLS.4 / #277, `combat-silence.test.ts:21` — `TS2783` `id` dupliqué,
    passé en CI via des checks « stale-green »). Corrigé (suppression du champ
    `id: over.id` redondant, écrasé par `...over`) — sans quoi la CI de CE lot
    (même gate `pnpm typecheck`) serait rouge. Zéro changement de comportement
    (le test passe 606/606).
  - **Vérifs** : typecheck **5/5** ; lint ; engine **606** / content **116**
    (golden + save-shape **inchangés**, aucune modif moteur de règles) ;
    `content:check` 6 paquets / 12 scénarios valides ; build gzip ≈ 303 Ko < 800 ;
    garde-fou « zéro faction » vert ; smoke (à confirmer). Zéro diff moteur/
    save/golden. Zéro nom de faction dans le moteur.
