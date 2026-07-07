# Plan — UXD-6 : ambiance sonore

> Lot 6 du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Traite le
> constat §1.5 (« aucun audio dans le client — plus gros écart d'immersion vs
> HoMM/HO ; l'option audio promise doc 08 §2.5 n'existe pas »). Découpé comme
> UXD-3 : **6A** cadrage + prompts (ce lot), **6B** intégration à la réception
> des fichiers audio.

## Décision de sourcing (utilisateur)

Génération via **Gemini** (comme les images). ⚠️ L'utilisateur signale que
Gemini **ne respecte pas les durées** → retravail obligatoire (trim, points de
boucle, normalisation, encodage) inscrit dans les fiches de prompt et la
Règle F (doc 12).

## Étapes

- [x] **Règle F (audio)** dans `docs/12` : cadre sonore, familles & cibles,
      formats (`.ogg` + repli `.m4a`), budgets, staging `assets/audio/`,
      convention de nommage, note « durées Gemini non fiables ».
- [x] `tools/assets/gen_audio_prompts.py` → `assets/prompts/audio-music.md`
      (6 pistes) et `audio-sfx.md` (10 effets), avec commandes ffmpeg de
      retravail.
- [ ] **Utilisateur** : générer les sons dans Gemini, retravailler (trim/loop/
      encode), fournir les `.ogg` (+ `.m4a`).
- [ ] **6B — architecture client** (peut démarrer AVANT les fichiers, jouable
      silencieux) :
  - `render/audio.ts` : registre (`import.meta.glob ?url`, hors bundle, lazy) +
    lecteur Web Audio ; déblocage à la 1ʳᵉ interaction (autoplay policy).
  - Volumes musique/SFX (0-100) persistés `localStorage`, **coupé/modéré par
    défaut** ; section Audio des Options (doc 08 §2.5).
  - Mapping : contexte → musique (`menu`/`adventure`/`combat`/`town`), event
    moteur → SFX (via `eventBus` existant). Le son double un feedback visuel
    (A5), jamais seul.
  - Repli gracieux : fichier absent = silence (pas d'erreur).
- [ ] Vérif : smoke « pas d'erreur autoplay », volumes persistés, budget JS
      intact (audio hors bundle), jouable coupé sans perte d'info.

## Ordre

6A (ce lot) est autonome (prompts + spec). L'**architecture 6B** est du code
indépendant des fichiers (tout est silencieux tant qu'aucun `.ogg` n'est
présent) — peut être livrée en parallèle de la génération audio.
