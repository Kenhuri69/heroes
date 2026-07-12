# Héros original — Agathe (Sylvan Court)

Nouveau héros nommé **original** de la Cour Sylvestre : une **Druide soigneuse**
(archétype `magic`), orientée soin/guérison, elfique. Avatar photoréaliste fourni
par l'utilisateur (conserve un visage réel — divergence assumée vs painterly).

## Contexte / conventions vérifiées
- Héros nommés = **données pures**, non consommés par le moteur au staging
  (`heroIdentitySchema`, doc 16 §16.9). Zéro diff moteur, pas de bump save.
- Format : `data/factions/sylvan-court/heroes/<id>.json` (cf. `faelar`, `sylwen`).
- Avatar dédié : clé `avatar` → registre client `heroes/<clé>` →
  `assets/heroes/<clé>.png` (cf. `haven-anton` → `assets/heroes/haven-anton.png`).
- `avatarStyle: 'photoreal'` documente honnêtement la divergence (doc 12 §3/§7).
- `origin: 'original'` **interdit** le champ `source` (refine du schéma).
- Effets de spécialité résolubles : `heroEffectFields` (dont `manaCostReductionPct`).
- Sorts de soin dispo : `soin` (water c1), `grande-guerison` (water c3).
- Compétences dispo : `wisdom`, `magic-water`, …

## Étapes
1. **Stager l'avatar** → `assets/heroes/sylvan-court-agathe.png`
   (redimensionné 256×256, < 150 Ko). → vérif : `ls -la`, poids < 150 Ko.
2. **Fiche héros** `heroes/agathe.json` : magic / original, avatar dédié
   photoréaliste, attributs à dominante Savoir (mana de soin), spécialité
   soigneuse (`manaCostReductionPct`), compétences `magic-water`+`wisdom`,
   sort de départ `soin`. → vérif : `content:check` vert.
3. **Manifeste** : ajouter `"agathe"` au tableau `heroes`. → vérif : loader OK.
4. **Locales** FR/EN : `hero.agathe.name|bio|specialty`. → vérif : parité FR/EN,
   0 clé manquante (`content:check`).
5. **Validation** : typecheck, lint, `content:check`, tests engine/content,
   garde-fou faction, budget bundle, smoke Chromium. → vérif : tout vert.
6. **Commit + push** branche `claude/agathe-hero-character-kb160v` + PR draft.

## Décisions
- **Spécialité** : `guerisseuse` — `manaCostReductionPct: 15` (« sa magie de soin
  coule sans effort » — résoluble, thématique healer ; pas de nouveau point
  d'extension). Alternative conditionnelle écartée (Agathe soigne, ne buff pas une
  unité précise).
- **Attributs** (total 7, aligné sur Faelar) : atk 0 / déf 1 / pouvoir 2 / savoir 4
  — gros pool de mana = plus de soins.
- **Sort de départ** : `soin` (guérison de base). **Compétences** : `magic-water` 1
  (école de soin) + `wisdom` 1.

## Écarts constatés
- Avatar reçu en 1024×1024 → redimensionné 256×256 Lanczos (117 Ko < 150 Ko).
- Env sandbox : révision Playwright 1194 (le config pin 1228 absent) → smoke lancé
  via `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (point d'extension déjà prévu par `playwright.config.ts`).

## État — LIVRÉ
- ✅ Avatar stagé `assets/heroes/sylvan-court-agathe.png` (256², 117 Ko).
- ✅ `heroes/agathe.json` (magic/original, spécialité `guerisseuse` +15 % mana,
  attrs 0/1/2/4, `magic-water`+`wisdom`, sort `soin`).
- ✅ Manifeste : `"agathe"` ajouté.
- ✅ Locales FR/EN `hero.agathe.*`.
- ✅ Vérifs : `content:check` (6 paquets), typecheck, lint, **595 tests** engine,
  build, smoke héros-nommé + assets-no-404 (desktop) verts. Zéro diff moteur
  (grep faction en dur vide), pas de bump save.

## Suivi PR #278 — CI
- CI PR (merge avec `main`) rouge : bug **préexistant sur `main`**
  `combat-silence.test.ts:21` (TS2783 — `id: over.id` redondant avant `...over`),
  sans rapport avec Agathe. `main` cassé pour toutes les PR.
- **Décision utilisateur** : corriger + merger `main` dans cette PR.
- ✅ `main` mergé (résolution auto, 0 conflit) ; correctif 1 ligne (retrait du
  `id:` redondant, aligné sur les helpers `unit()` voisins). Revérifié :
  typecheck/lint/content:check verts, **602 + 116 tests**, build, smoke
  héros/assets verts.
