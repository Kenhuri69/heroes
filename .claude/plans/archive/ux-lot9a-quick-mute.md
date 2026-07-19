# Lot 9a (P2) — Audio d'identité : mute rapide (I8)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 9, item 1. Aucun moyen de
> couper vite le son. On ajoute un **bouton haut-parleur** (TurnBar + Options) qui
> coupe musique **et** SFX, **persisté**, icône barrée + `aria-pressed` (second
> canal non chromatique). **Client uniquement — zéro moteur, zéro asset**, pas de
> bump save. Le mute est un OVERRIDE : les volumes réglés aux Options sont
> conservés et restaurés au dé-mute.

## Changement (client)
- `audio.ts` : drapeau `muted` persisté (`heroes:audio:muted`), gate playback
  (`applyMusic`/`playSfx`/`playJingle` ⇒ silence si `muted`), `isMuted()` +
  `toggleMute()` (miroir `store.audioMuted`, ré-applique la musique).
- `store.ts` : `audioMuted: boolean` (défaut depuis localStorage via `initAudio`).
- `shell.tsx` : bouton `mute-toggle` dans `.actions` de la TurnBar (🔊/🔇,
  `aria-pressed`, cible ≥ 44 px).
- `OptionsPanel.tsx` : même bascule dans la section Audio.
- i18n : `options.audioMute` / `options.audioMuteAria` (FR/EN).

## Vérification
- Smoke @core : bouton `mute-toggle` visible, `aria-pressed=false` → clic →
  `aria-pressed=true` + `store.audioMuted=true` ; re-clic revient. Persistance
  `localStorage['heroes:audio:muted']`.
- typecheck · lint · engine (client-only) · content (i18n) · client · build ·
  bundle · smoke @core + mobile · gardes.

## Journal
- [x] `muted` dans audio.ts (gate `applyMusic`/`playSfx`/`playJingle`, `setMuted`
      + `toggleMute`, persist `heroes:audio:muted`) + `store.audioMuted` (défaut
      via `initAudio`).
- [x] Bouton `mute-toggle` (🔊/🔇, `aria-pressed`) dans `.actions` de la TurnBar
      + bascule segmentée On/Off dans la section Audio des Options ; i18n
      `options.audioMute`/`audioUnmute` FR/EN ; CSS `.mute-toggle`.
- [x] Smoke @core I8 (toggle `aria-pressed` + persistance `localStorage`). Recette :
      typecheck · lint · engine 906 (client-only ⇒ golden inchangé) · content 154 ·
      client 13 · build · bundle 342 594 ≤ 819 200 · smoke @core 32 + mobile 13 ·
      gardes faction/couleurs propres.
