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
   → Par défaut : **(a)** (minimal, conforme au pattern « stagé en avance »).

## Étapes
1. [x] Proposer le nom (base « Celeste ») → **Céleste** (mononyme, cf. Rumi/Hermione).
   verify: cohérent avec la convention de nommage des héros nommés existants.
2. [x] Rédiger le prompt d'avatar photoréaliste (ChatGPT). → dans la réponse + prompts file.
   verify: prompt autonome, distinct de Rumi, suffixe universel doc 12 §7.
3. [ ] (Après photo) Extraire/détourer en 256² et stager le PNG. verify: QC image.
4. [ ] (Après photo) Documenter dans `assets/prompts/faction-vox-arcana.md` + doc 16.
   verify: cohérence doc = source de vérité.
5. [ ] (Après photo) Trancher/appliquer l'emplacement d'avatar (option a/b).
   verify: typecheck + lint + build + smoke ; garde-fou « zéro faction » vert.
6. [ ] Commit + push branche `claude/vox-arcane-hunter-hero-g9jtcw` + PR draft.
