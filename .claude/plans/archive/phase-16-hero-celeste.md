# Plan — Héros nommé Vox Arcana : Céleste (Hunter, protégée de Rumi)

## Contexte
Ajout d'un 3ᵉ héros nommé à la faction **Vox Arcana** (doc 16) :
- Archétype : **Hunter / Might** (comme Rumi, sa mentore).
- Avatar : **photoréaliste** (choix utilisateur — diverge de la DA painterly
  doc 12 §7 « NOT photorealistic » ; assumé et documenté).
- Photo générée hors-outil (ChatGPT / GPT-image) par l'utilisateur ; je finalise
  l'intégration une fois le PNG fourni.

## Décisions ouvertes (à trancher à la finalisation)
1. **Emplacement d'avatar.** Convention actuelle = `heroes/<factionId>-<might|magic>`
   (`packages/client/src/render/assets.ts:98`), 2 slots/faction, déjà pris par
   Rumi (might) + Hermione (magic). Céleste (might) entre en collision.
   Options :
   - (a) Stager en avance sous une clé nommée dédiée `heroes/vox-arcana-celeste`
     (asset-only, pas encore affiché in-game — comme Hermione/Rumi l'étaient avant
     leur slot). Zéro diff moteur/client.
   - (b) Étendre la convention client d'un slot de héros nommé (petit diff client).
   - (c) Attendre le système de héros nommés du moteur (différé — hors périmètre).
   → **Décision : (a)** — stagé sous `heroes/vox-arcana-celeste` (minimal,
     conforme au pattern « stagé en avance » ; affichage in-game = système de
     héros nommés, différé pour toutes les factions).

## Étapes
1. [x] Proposer le nom (base « Celeste ») → **Céleste** (mononyme, cf. Rumi/Hermione).
2. [x] Rédiger le prompt d'avatar photoréaliste (ChatGPT) → réponse + prompts file §1b.
3. [x] Redimensionner la photo grimée en 256² RGBA → `assets/heroes/vox-arcana-celeste.png`.
4. [x] Documenter : `assets/prompts/faction-vox-arcana.md` (§1b + staging) + doc 16 (État 16.8).
5. [x] Emplacement d'avatar : option (a) retenue et appliquée.
6. [ ] Vérifs : typecheck + build client + budget ; garde-fou « zéro faction » vert.
7. [ ] Commit + push branche `claude/vox-arcane-hunter-hero-g9jtcw` + PR draft.
