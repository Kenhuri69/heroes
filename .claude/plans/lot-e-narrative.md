# Lot E-narrative — doc sync narratif (E6)

Sous-lot du Lot E (doc sync). Réconcilie `docs/13-plan-narrative-polish.md`
avec le livré réel. **Constat majeur** : la doc 13 s'auto-annote déjà
finement (sections « État N1 → N3c livré ») et le narratif a **dépassé N2**
(campagnes Haven+Necropolis, cutscenes caméra, choix de dialogue câblés).
Plusieurs affirmations du plan E6 étaient donc **périmées** — vérifiées et
corrigées contre le code.

## Écarts plan E6 ↔ réalité (vérifiés)

- « choices/setFlag silencieusement ignorés par le client » → **FAUX** :
  `narrative.ts` `chooseDialogueOption` applique `setFlag`/`next` (livré N3c.2).
- « journal sans centrage caméra ni badge » → **FAUX** : `panCameraTo`
  (mini-carte + cutscenes) et badges d'événement au menu livrés.
- « conditions réduites (4 types) » → **périmé** : `engine/quest` expose
  **11 types** de conditions génériques.
- Confirmés : récompenses `resources`/`artifact`/`units` (**pas** de XP/sort) ;
  quêtes **sans trigger** (démarrage en bloc à `StartGame`) ; prologue =
  **2 quêtes / 2 dialogues** ; `tutorial` intact.

## Édition

Une **note de synthèse « État livré (N1→N3c) »** ajoutée en §4.1, pointant
vers les sections « État Nx » (qui font foi) et corrigeant le point stale de
§4.1 (« les 3 scénarios ré-habillés » → le prologue a été **ajouté**, les 3
existants intacts ; **12 scénarios** au total). Résume : campagnes chapitrées
+ report de héros, moteur de quêtes générique riche, choix de dialogue câblés,
recentrage caméra + badges livrés.

## Vérification
Docs seuls. Suite complète (garde-fou §7) : lint, engine+content,
content:check, guards, build < 800 Ko, smoke desktop+mobile (re-run des
flakes connus si besoin).

## État : livré.
