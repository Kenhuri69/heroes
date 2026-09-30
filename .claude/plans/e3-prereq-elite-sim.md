# E3 — prérequis : `faction:sim` lit les élites

> Report E3 du plan `game-experience-enrichment.md` (§3.1 : « pilote 1 maison ×
> 1 tier après C3, une fois le sim capable de lire les élites »). Ce lot ne livre
> que le **prérequis d'outillage** ; le pilote E3 attend un arbitrage (§4).

## 1. Constat

- `faction:sim` n'opposait que les unités de **base** (`manifest.town.dwellings`) :
  il était aveugle aux élites (constat déjà noté au lot Squelette archer).

## 2. Étapes

1. [x] Lecture « élites » dans `faction:sim` (pas de gate) : duel élites contre
   élites, et élites contre la base de la même faction à valeur d'or égale.
   L'élite d'un tier = unité du dernier niveau de son habitation.
2. [x] **Bug trouvé en route** : auto-combat sans fin (« boucle infinie
   suspectée ») — un tireur menacé par une pile plus lente fuyait à chaque round
   sans jamais tirer (règle de repli de l'IA). Correctif : repli borné à
   `KITE_MAX_ROUND` (10) rounds, puis le tireur tire. Test d'instantané réel
   (échoue sans le correctif). Touche aussi une partie réelle : un auto-combat
   pouvait planter.
3. [x] Vérifications.

## 3. Mesures (lecture élites, 120×2 combats/paire)

| Faction | Élites contre la base, valeur d'or égale |
|---|---|
| haven | 99,2 % |
| vox-arcana | 100,0 % |
| sylvan-court | 82,1 % |
| necropolis | 41,3 % |
| dungeon | 13,8 % |
| arcane-hunters | 0,0 % |

Lecture : le surcoût d'or des élites est très inégal (+20 % Dungeon, +40–60 %
Haven, +65–80 % AH) pour des gains de stats qui ne suivent pas. Chez Haven et
Vox, l'élite est meilleure même à or égal ; chez AH, elle ne vaut jamais son
prix. Le duel des élites entre factions montre 11 béances sur 15 paires. Le duel
de base (seul gate) est **inchangé** : 1 béance (AH vs Vox 19,2 %).

## 4. Décision attendue (utilisateur)

- Recaler les élites (passe 3, données pures) avant le pilote E3 ? Cible
  proposée : élites contre base à valeur égale dans 35–60 % (l'élite coûte une
  prime, mais la vraie limite du joueur est la croissance hebdomadaire).
- Pilote E3 : quelle maison × quel tier.

## 5. Vérifications

- [x] moteur 1107 (+1), golden inchangé ; `faction:sim` va au bout (plus de throw)
- [ ] typecheck, lint, build, suite complète, Playwright

## 6. Journal

- 2026-09-30 : plan ouvert ; lecture élites ajoutée ; bug de repli trouvé et corrigé.
