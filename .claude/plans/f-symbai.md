# F-SYMBAI — La Symbiose pèse en simulation (backlog §2.3, 🧩 S)

Doc 14 §9 (État 5.4) : l'IA de combat ne Défend presque jamais — la règle
imposée « progression » fait toujours avancer la pile la plus rapide vers
l'ennemi. Or la signature Sylvan (`symbiosis`) ne rapporte qu'en s'enracinant :
Défendre = +1 palier (attaque/défense cumulées), bouger = remise à zéro,
attaquer = dépense les paliers sur la frappe. Résultat en simulation : la
signature est inerte, l'IA gaspille l'enracinement en avançant.

## Décision (heuristique déterministe, bornée)

Dans `chooseAction` (règle imposée 2, quand RIEN n'est attaquable ce tour-ci) :
une pile `symbiosis` **s'enracine** (Défend) plutôt que d'avancer si :
- (a) ses paliers sont **sous le plafond** (`symbiosisStacks < maxStacks`) —
  borne anti-blocage : au plafond, progression normale ⇒ deux armées Symbiose
  face à face ne peuvent pas se défendre indéfiniment ;
- (b) **le combat vient à elle** : au moins un ennemi peut atteindre son
  adjacence au tour prochain (`isThreatenedAt`, approximation stable
  existante) — sinon défendre ne prépare rien, elle avance.

Zéro RNG (déterminisme IA préservé), zéro donnée de faction dans le moteur
(`symbiosis` est une capacité générique du catalogue). Golden inchangé (les
unités golden n'ont pas `symbiosis` ⇒ branche morte).

## Étapes

1. [x] `combat/ai.ts` : condition d'enracinement dans la règle imposée 2
   (import `symbiosisParams`).
2. [x] Tests (`combat-ai.test.ts`) : pile symbiosis la plus rapide, rien à
   attaquer, ennemi menaçant ⇒ `defend` (avant : `move`) ; au plafond ⇒
   `move` (progression) ; sans menace ⇒ `move` ; pile sans symbiosis ⇒
   comportement inchangé.
3. [x] Backlog : F-SYMBAI ⬜ → ✅ ; doc 14 §9 mis à jour (signature pèse en sim).
   → vérif : typecheck, lint, tests moteur (dont property « IA vs IA se
   termine » et golden), build, smoke combat ciblé.

## Constat empirique (faction:sim, 120×2 combats/paire)

- Une variante PLUS agressive a été testée puis **rejetée** : « défendre aussi
  quand la seule frappe possible exige un déplacement ». Résultat : Sylvan
  s'effondre (63/37 → 93/7 vs Haven ; 77/23 → 99/1 vs Necro ; 27/73 → 10/90 vs
  Vox) — avec le profil agile-verre (doc 14 §9), temporiser = donner la première
  frappe. La règle livrée (défendre seulement quand RIEN n'est frappable) est
  neutre-positive (+0,5 pt vs Arcane), zéro régression. Rejet consigné en
  commentaire dans `ai.ts`.
- Au passage : 2 blowouts PRÉEXISTANTS mesurés hors bande 20–80 (haven/necro
  18,8 % ; necro/vox 90 %) — indépendants de ce lot (mesurés identiques sans le
  diff), conséquence de la vague de capacités du jour (Nécromancie graduée,
  spellcaster, fear, charge, bonus de faction). À traiter par l'item A10
  « re-passe faction:sim post-capacités » du backlog.
