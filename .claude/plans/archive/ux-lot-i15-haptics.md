# Lot I15 (P3) — Haptique mobile (micro-lot)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 10 (micro-lot glissable). Aucun
> retour tactile mobile. On ajoute `navigator.vibrate` sur **confirmations** et
> **kills**, **opt-in** dans les Options (défaut OFF), persisté. **Client
> uniquement — zéro moteur, zéro asset**, pas de bump save.

## Changement (client)
- `app/haptics.ts` : `hapticForEvent(event, ctx)` **pur** (réutilise `sfxIdForEvent`
  d'audio pour le gating humain : `combat-death` → motif kill, `ui-confirm` → motif
  confirmation, sinon null) ; drapeau `enabled` persisté (`heroes:haptics`, défaut
  OFF) ; `setHaptics`, `initHaptics` (abonné au bus) ; `hapticStats` (hook de test) ;
  `triggerHaptic` incrémente le compteur à chaque tentative (enabled + motif),
  appelle `navigator.vibrate` si dispo.
- `store.ts` : `hapticsEnabled: boolean` (défaut OFF, restauré par `initHaptics`).
- `OptionsPanel.tsx` : bascule On/Off (section Accessibilité) + i18n `options.haptics`.
- `main.ts` : `initHaptics()` au bootstrap + hook `haptic() → { count }`.

## Vérification
- **Unitaire client** (`haptics.test.ts`) : `hapticForEvent` renvoie un motif pour
  kill/confirmation du joueur humain, null sinon (IA / autre événement).
- Smoke @core : activer le retour tactile (Options), une construction ⇒
  `haptic().count > 0` ; persistance `localStorage['heroes:haptics']`.
- typecheck · lint · engine · content · client · build · bundle · smoke @core +
  mobile · gardes.

## Journal
- [x] `haptics.ts` : `hapticForEvent` pur (réutilise `sfxIdForEvent`), `setHaptics`,
      `initHaptics`, `hapticStats`. **Kill gardé au combat AFFICHÉ** (`game.combat`
      non nul) ⇒ pas de vibration pendant un tour d'IA. `store.hapticsEnabled`
      (défaut OFF) ; Options bascule On/Off ; i18n `options.haptics` FR/EN ; hook
      `haptic()` (main.ts) ; `initHaptics()` au bootstrap.
- [x] Unitaire client `haptics.test.ts` (4 tests : kill/confirmation humaine → motif,
      IA/neutre → null) + smoke @core I15 (défaut OFF ⇒ 0 ; opt-in persiste ; kill
      en combat affiché ⇒ `haptic().count > 0`). Recette : typecheck · lint · engine
      910 (client-only ⇒ golden inchangé) · content 154 · **client 27** · build ·
      bundle 344 477 ≤ 819 200 · smoke @core 34 + mobile 13 · gardes faction/couleurs.
