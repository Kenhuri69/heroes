# E3 — passe 3 : recalage des élites

> Suite de `e3-prereq-elite-sim.md` (arbitrage utilisateur du 2026-10-01) :
> recaler les élites **avant** le pilote E3 (Haven T3). Données pures.

## 1. Constat

- Lecture `faction:sim` « élites contre base, or égal » : Haven 99 %, Vox 100 %,
  Sylvan 82 %, Necropolis 41 %, Dungeon 14 %, AH 0 %.
- Ce chiffre d'armée est un **fil du rasoir** : deux armées miroirs de valeur
  égale basculent en bloc (0 ↔ 100 %) au moindre avantage net, et le budget de
  4 000 or/tier arrondit les T6/T7 à **1 contre 1** (l'élite gagne alors à coup sûr).
- Mesure robuste retenue : le **prix d'équilibre** de chaque élite, tier par tier
  (recherche dichotomique du prix où l'élite gagne 50 % contre la base à or égal,
  budget 40 000 or pour éviter l'arrondi). Banc local, non commité.

## 2. Décisions

- Levier : le **prix en or** de l'élite (les coûts en ressources rares ne bougent
  pas). Nouveau prix = prix d'équilibre arrondi (5 / 10 / 50 or).
- Surcoût borné à **×1,10–×1,80** de la base. Hors de cette bande, le prix est
  plafonné et ce sont les **stats** de l'élite qui sont retouchées.
- T8 hors périmètre (hors panel du sim, comme le duel de base).
- Cible de contrôle : d'abord la lecture d'armée de `faction:sim` dans 35–60 %
  (bande acceptée par l'utilisateur) ; **remplacée en route** par le facteur
  d'égalité ×1,00 ± 5 % (voir §4, la bande de victoires est un fil du rasoir).

## 3. Étapes

1. [x] Banc prix d'équilibre (local) — mesure de départ
2. [x] Nouveaux prix d'élites (6 factions)
3. [x] Haven T7 hors bande : prix plafonné + stats retouchées
4. [x] Re-mesure : prix d'équilibre ≈ prix, lecture d'armée `faction:sim`
5. [x] Tests (recrutement, contenu), docs de faction (tables de coûts), CLAUDE.md
6. [x] Vérifications

## 4. Mesures

Prix d'équilibre de départ (×base, actuel → juste) :

| Faction | T1 | T2 | T3 | T4 | T5 | T6 | T7 |
|---|---|---|---|---|---|---|---|
| haven | 1,25→1,67 | 1,47→1,50 | 1,41→1,60 | 1,44→1,43 | 1,33→1,67 | 1,46→1,58 | 1,69→2,27 |
| arcane-hunters | 1,66→1,55 | 1,71→1,47 | 1,65→1,56 | 1,80→1,48 | 1,72→1,24 | 1,69→1,69 | 1,80→1,34 |
| necropolis | 1,61→1,74 | 1,44→1,47 | 1,63→1,59 | 1,62→1,46 | 1,64→1,63 | 1,65→1,88 | 1,67→1,78 |
| sylvan-court | 1,43→1,42 | 1,45→1,53 | 1,47→1,25 | 1,47→1,22 | 1,46→1,34 | 1,43→1,26 | 1,37→1,16 |
| vox-arcana | 1,29→1,69 | 1,30→1,54 | 1,30→1,25 | 1,22→1,47 | 1,25→1,28 | 1,26→1,42 | 1,16→1,26 |
| dungeon | 1,23→1,40 | 1,23→1,12 | 1,23→1,39 | 1,21→1,23 | 1,19→1,21 | 1,18→1,37 | 1,20→1,27 |

Écarts constatés en route :

- Le prix d'équilibre **pile contre pile** ne suffit pas : en armée complète, le
  contexte (tireurs couverts, marques, symbiose) déplace la valeur de ±10 %. Second
  levier : un **facteur par faction** mesuré en armée (effectif d'élites qui fait
  jeu égal avec la base), appliqué à tous ses prix d'élites. Dungeon a demandé
  deux passes.
- La cible « 35–60 % de victoires à or égal » est **inatteignable de façon stable** :
  à ×1,006 du juste prix, les élites AH ne gagnent que 18 % (fil du rasoir). La
  cible retenue est donc le facteur d'égalité ×1,00 ± 5 %, ajouté à `faction:sim`
  comme lecture (pas de gate).
- Le duel élites contre élites entre factions reste une lecture : il hérite de
  l'équilibre de base et bascule au seuil (à 40 000 or/tier, même le duel de base
  compte 6 béances, contre 1 à 4 000).

Résultat (facteur d'égalité, `faction:sim`) : haven ×1,000 · arcane-hunters ×1,006 ·
necropolis ×1,015 · sylvan-court ×1,005 · vox-arcana ×0,992 · dungeon ×1,003.
Duel de base inchangé : 1 béance (AH contre Vox).

## 5. Vérifications

- [x] typecheck (sans `-s`), lint, build ; budget 387 594 o gzip ; garde-fous faction et couleurs
- [x] tests : moteur 1107, contenu 197, client 113, serveur 10 ; golden inchangé
- [x] Playwright complet : 149 verts ; fluidité @perf de la carte instable (repassée à la relance, hors zone)

## 6. Journal

- 2026-10-01 : plan ouvert ; mesure de départ ; prix recalés (deux leviers), Archange rabotée, lecture « facteur d'égalité » ajoutée à `faction:sim`.
