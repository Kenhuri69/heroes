# Lot L6 — campagnes Sylvan Court (3 chapitres) & Vox Arcana chapitre 2

> Lot 6 du plan `.claude/plans/missing-features-2026-08.md` (**G4**). **Données
> pures** : le pipeline de campagne (N3a) est prouvé 4× (Haven, Necropolis,
> Arcane Hunters, Dungeon) — un 5ᵉ/6ᵉ passage ne doit toucher **aucune ligne**
> de moteur ni de client.

## 1. Constat

| Maison | Campagne | Chapitres |
|---|---|---|
| Haven / Necropolis / Arcane Hunters / Dungeon | ✅ | 3 / 2 / 2 / 3 |
| Vox Arcana | 🧩 | **1** |
| **Sylvan Court** | 🕳️ | **aucune** — `data/factions/sylvan-court/story/` n'existe pas |

La Cour Sylvestre est la seule maison jouable sans une ligne de narration, alors
que doc 14 §8 en écrit déjà le programme : « La forêt se referme / La lisière
brûle / L'Aïeul s'éveille ».

## 2. Étapes

1. **Campagne Sylvan** : `story/campaign.json` + `manifest.story`, 3 chapitres.
2. **Scénarios `sylvan-ch1/2/3`** sur le patron des campagnes existantes :
   ch1 `proto-01` (survivre / bâtir), ch2 `proto-01` (éliminer), ch3 `proto-02`
   (carte dédiée, comme `haven-ch3`) → verify: `content:check` + test contenu.
3. **Vox chapitre 2** : scénario `vox-ch2` + entrée de chapitre.
4. **Locales FR/EN** (core, comme les autres campagnes) : noms, dialogues,
   quêtes, barks → verify: parité FR/EN et résolution des `@loc:` (tests contenu
   existants `loc-refs-resolve`, `faction-locale`).
5. **Index des scénarios** mis à jour.
6. Docs 13 (§8) et 14 (§8) alignées : la campagne n'est plus « hors 1ᵉʳ lot ».
7. Vérification complète.

## 3. Invariants

Zéro diff moteur/client · aucune faction en dur dans `packages/` · les ids
d'unités/bâtiments viennent des manifestes réels · pas de bump de sauvegarde ·
golden inchangé.

## 4. Journal

- **2026-08-31 — livré**. 4 scénarios (`sylvan-ch1/2/3`, `vox-ch2`), 2 campagnes
  touchées, **56 clés de locale × 2 langues**, **zéro ligne** de moteur ou de
  client — le pipeline N3a tient son cinquième et sixième passage.
  - **Arcs promis par doc 14 §8 honorés** : Sylwen choisit entre *tenir la
    lisière vivante* et *la brûler* (ch2), Faelar entre *réveiller l'Aïeul* et
    *le laisser rêver* (ch3) — « l'Écoutant apprend à agir, la Gardefronde à
    défendre la lisière plutôt que la forêt entière ».
  - **Vox ch2** oppose la Scène à l'Académie des chasseurs (« La tournée des
    sceaux ») et se clôt sur un choix Hermione : ouvrir les archives ou les
    sceller.
  - Adversaires variés à dessein : Necropolis (ch1/ch3 Sylvan), **Dungeon**
    (ch2 Sylvan — les cousins souterrains de doc 17), **Arcane Hunters**
    (Vox ch2). Les ids d'unités adverses ont été lus dans les manifestes
    (`t2-familier`/`t3-prefet` et non les noms devinés).
  - **Aucun test ajouté** : les tests de contenu existants sont **génériques et
    itèrent sur `data/`** (validité de tous les scénarios, chapitres qui
    référencent un scénario chargé, factions/unités connues, unicité et
    complétude des drapeaux de choix). Ils couvrent donc le nouveau contenu —
    et le skill `test-authoring` interdit d'écrire un test nommant une faction
    dans `packages/`.
  - `data/scenarios/index.json` réécrit à la main pour **conserver son style**
    (tableau sur une ligne) après ajout.

## 5. Vérification (rejouée en entier le 2026-08-31)

- [x] `pnpm typecheck` (5 projets) · `pnpm lint`
- [x] tests moteur 968/968, contenu 167/167, client 85/85
- [x] `pnpm content:check` — **7 paquets, 2 cartes, 20 scénarios**, 6 campagnes
      (dont `sylvan-campaign` 3 chapitres et `vox-campaign` 2)
- [x] parité FR/EN vérifiée par différence d'ensembles de clés : **0 écart**
- [x] garde-fou faction (aucun id dans `packages/`) · build + bundle
      **367 795 o gzip**
- [x] smoke `@core` **55/55** · `@e2e` **3/3**
- [x] **golden inchangé** (aucun fichier moteur touché)
