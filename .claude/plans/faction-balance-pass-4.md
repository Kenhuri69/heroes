# Équilibrage passe 4 — après que le sim a vu la magie des unités

> Suite du lot R1 (`r1-sim-unit-spells.md`), décision D-R1a du plan
> `game-experience-enrichment.md` : la mesure après R1 justifie une passe 4.
> Choix utilisateur du 2026-10-08 : **juste après R1**, avant R3.

## 1. Constat (mesure après R1, duel de base, winrate moyen %)

| Haven | AH | Necro | Sylvan | Vox | Dungeon | Béances |
|---|---|---|---|---|---|---|
| 61,4 | 51,9 | 44,6 | 55,4 | 38,8 | 47,8 | 1 (Haven-Vox 81,7) |

- Haven gagne 8 pts en jouant ses soigneurs à bon escient : sans la Résurrection
  de l'Ange elle retombe à 55,7, sans le Soin de la Prêtresse à 57,4.
- Vox, déjà la plus basse, perd 2,6 pts avec le Maître (la pile qui lance ne frappe
  pas ce tour-là).
- Passes 2 et 3 calées sans les lanceurs.

## 2. Objectifs

- Duel de base : **0 béance** (20–80 %), écart max entre factions nettement sous les
  22,6 pts actuels (cible ≤ 12, l'écart d'avant R1 était 10).
- Facteur d'égalité des élites : ✓ (±5 %) partout, prix d'élites retouchés si besoin.
- Leviers **données seules** ; identité des factions préservée (Haven reste la
  faction du soin, Vox celle du soutien).

## 3. Méthode

Banc jetable `packages/tools/scratch/duel.ts` (duel de base seul, mêmes armées et
terrains que `faction:sim`, 46 s ; essais via `PATCH` sans toucher aux données),
puis `faction:sim` complet pour valider. Pas positifs gardés, les autres annulés.

## 4. Étapes

1. [x] Essais de leviers (banc), choix
2. [x] Données, `faction:sim` complet, facteur des élites
3. [x] Docs de faction (tables de stats), doc 06, CLAUDE.md, plan d'enrichissement
4. [x] Vérifications

## 5. Vérifications

- [x] typecheck, lint, build ; garde-fous ; budget 388 468 o gzip
- [x] tests : moteur 1117, contenu 201, client 113, serveur 10 (dont `balance.test`, parité des élites) ; golden inchangé
- [x] Playwright comme en CI : 149 verts hors @perf, @perf mono-worker 2/2 (9,0 fps)

## 6. Journal

- 2026-10-08 : plan ouvert.
- 2026-10-08 : essais au banc (winrate moyen, écart max, béances) :

  | Essai | Haven | AH | Necro | Sylvan | Vox | Dungeon | Écart | ✗ |
  |---|---|---|---|---|---|---|---|---|
  | Réf. (après R1) | 61,4 | 51,9 | 44,6 | 55,4 | 38,8 | 47,8 | 22,6 | 1 |
  | A Prêtresse 1 charge | 60,3 | 51,8 | 45,7 | 55,4 | 39,1 | 47,7 | 21,2 | 1 |
  | B Ange Pouvoir 2 | 56,1 | 52,0 | 47,2 | 55,3 | 40,4 | 49,0 | 15,7 | 0 |
  | C = A + B | 54,6 | 52,0 | 48,5 | 55,3 | 40,4 | 49,2 | 14,9 | 0 |
  | D = C + Maître 70 PV | 52,8 | 51,7 | 48,8 | 54,3 | 43,9 | 48,4 | 10,4 | 0 |
  | E = C + Maître 76 PV | 52,3 | 50,7 | 47,8 | 54,6 | 46,6 | 48,0 | 8,0 | 0 |
  | F = A + Ange Pouvoir 3 + Maître 70 | 55,6 | 51,8 | 46,8 | 54,3 | 43,0 | 48,4 | 12,6 | 0 |
  | G = B + Maître 70 | 54,1 | 51,7 | 47,5 | 54,3 | 44,2 | 48,3 | 10,1 | 0 |
  | H = D + Maître dégâts 11–17 | 51,8 | 51,5 | 48,9 | 54,3 | 45,3 | 48,3 | 9,0 | 0 |
  | **I = B + Maître 76 PV** | 53,6 | 50,7 | 46,5 | 54,6 | 46,8 | 47,8 | **8,1** | 0 |

  - **Retenu : I** — même écart que E avec un levier de moins : la Prêtresse garde
    ses 2 Soins (le Soin à 1 charge ne valait qu'un point).
  - Élites alignées : Archange Pouvoir 5 → 3, Maître élite 78 → 92 PV (écart à la
    base conservé). Facteur d'égalité ✓ partout (Haven ×1,024, Vox ×1,050 en limite,
    inchangé).
  - `faction:sim` complet : 0 béance, 13 à surveiller ; gauntlet Vox 2,0 vagues
    (dernier ; la Résonance reste hors du sim, limitation connue).
  - Test `faction-recruit` : Pouvoir de l'Ange figé 4 → 2.
