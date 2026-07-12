# Plan — génération LLM des assets manquants (tas de ressources & vignettes orphelines)

> Branche : `claude/llm-asset-generation-plants-c5asp7`
> Déclencheur utilisateur : « identifie les assets nécessitant une génération LLM
> comme les tas de ressources, prépare des prompts par planche de 4 ou 8 pour
> Gemini ; je te redonne l'image, tu découpes et intègres. »

## Contexte / audit

`assets/resources/` est **vide** : les 9 tas de ressources n'ont jamais été
générés, bien que `resource_piles_sheet()` (gen_prompts.py) et les prompts
`resource-piles-p1/p2.md` existent déjà (PR #233).

Familles LLM manquantes, hors différés-par-design :
- **Tas de ressources** (`assets/resources/`) : 9 (gold, wood, ore, crystal,
  gems, mercury, essence, sulfur, resonance). Cible de l'utilisateur.
- **Mine** (`assets/mines/`) : `mine-resonance` (8/9 déjà là).
- **Bâtiments** : `haven-stables`, `haven-statue`, `haven-cloister`,
  `arcane-hunters-contracts`, `test-faction-dwelling-t1`.

Différés-par-design (**hors périmètre** de ce lot, sauf demande) :
- ~40 variantes d'unités `*-elite` → repli élite→base (doc 12 §10.2).
- Faction **Sylvan Court** complète (14 unités + 8 bâtiments + 2 avatars).
- Avatars Vox Arcana (hermione/rumi) et props-forest (autre famille/pipeline).

`buildings/core` est **complet** (le « town » de mon 1er audit était un artefact
de regex). Vérifié par `ls`.

## Regroupement retenu — « planches de 4 ou 8 »

`sheet_extract.py` n'exige que `len(ids) ≤ cols*rows` → on peut poser 7 sujets
sur une grille 4×2 (cellule 8 vide). Deux planches de grille 8 :

- **Planche A (8)** — les 8 tas cœur : `resource-piles-p1.md` (généré, déjà bon,
  inchangé). gold, wood, ore, crystal, gems, mercury, essence, sulfur.
- **Planche B (7 sur 4×2, cellule 8 vide)** — les orphelines de style « vignette
  carte d'aventure », fichier **hand-authored** `orphans-map-vignettes.md` :
  pile-resonance, mine-resonance, haven-stables, haven-statue, haven-cloister,
  arcane-hunters-contracts, test-faction-dwelling-t1.

`resource-piles-p2.md` (généré, 1 cellule solo `pile-resonance`) est **supersédé**
par la planche B → à ignorer (on ne l'édite pas : fichier tool-owned).

## Étapes

1. [x] Audit staging vs prompts → identifier le manquant réel. Vérifié : cible.
2. [x] Créer `assets/prompts/orphans-map-vignettes.md` (planche B, prompt Gemini
   prêt + extraction 7 ids sur 4×2 + copie par-id vers les dest). Vérifié :
   `sheet_extract --cols 4 --rows 2` accepte 7 ids (len ≤ 8, OK).
3. [ ] Livrer les 2 prompts à l'utilisateur (chat). Vérifier : coller-prêt.
4. [ ] **Au retour des images** (par l'utilisateur) : `sheet_extract` → QC verte
   obligatoire → copier vers `assets/resources/`, `assets/mines/`,
   `assets/buildings/<faction>/`. Vérifier : QC PASS, aucune image cassée.
5. [ ] Intégration : le registre `render/assets.ts` auto-découvre les PNG
   (`import.meta.glob ?url`, hors bundle) → aucun câblage. Vérifier : smoke
   « assets servis sans 404 » + budget bundle vert.
6. [x] Commit + push + PR draft (#287).
7. [x] **Anti-flake CI** : le check `quality` échouait sur `ai-adventure.test.ts`
   (test de déterminisme IA sans timeout explicite → défaut 5000 ms dépassé sur
   runner CI, mesuré 5160 ms ; échec par timeout, pas assertion ; sans lien avec
   la PR). Fix : `20_000` ms aligné sur le test frère. Local vert (3,5 s). Commit
   f55bd5e.

## Notes de décision

- La question de périmètre (AskUserQuestion) a échoué (flux fermé) → défaut
  raisonnable retenu : lot cohérent « tas + vignettes orphelines non-différées ».
  Élites + Sylvan Court laissés de côté, signalés à l'utilisateur.
- On **n'édite pas** les fichiers de prompt générés (tool-owned) ; la planche B
  est un fichier hand-authored séparé, ignoré par `gen_prompts.py`.
