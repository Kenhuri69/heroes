# Lot H-SPELLS.3 — Sort d'aventure « Vision » (révélation de brouillard)

> Backlog : `game-feature-gaps.md` §2.4 (H-SPELLS.3+). Doc source : **doc 02 §1.4**.
> Branche `claude/map-design-issues-jhjdy6` (repart de `origin/main`).

## Constat

Un seul sort d'aventure existe (`townPortal`). Le doc 02 §1.4 liste **Vision**
comme sort d'aventure attendu. Le sous-système est déjà ouvert (`kind: adventure`,
commande `CastAdventureSpell`, `AdventureEffect` union extensible, client
générique qui liste et lance tout sort d'aventure connu).

## Spec (point d'extension moteur GÉNÉRIQUE additif, zéro faction)

- `AdventureEffect` union += **`{ type: 'vision'; radius: number }`**.
- `handleCastAdventureSpell` : branche `vision` ⇒ `revealAround(explored, map,
  hero.pos, radius)` (le brouillard s'ouvre autour du héros, rayon du sort).
  `validate` inchangé (le cas `townPortal` reste spécifique ; `vision` passe par
  les gardes génériques : connu, kind `adventure`, mana suffisante).
- Content : `adventure` schéma → **union discriminée** `{townPortal} | {vision, radius}`.
- Données : sort **`clairvoyance`** (air, cercle 2, `adventure`, `vision` radius).
  Locales FR/EN.
- Client : **aucun changement** (`AdventureSpellbook` dispatche déjà tout sort
  d'aventure sans cible).
- **Additif** : `AdventureEffect` vit dans le catalogue (embarqué par `StartGame`),
  handler dégrade gracieusement pour un vieux moteur ⇒ **pas de bump save**
  (précédent H-SPELLS.1 `area:'all'`). Golden **inchangé** (replay inline ne lance
  pas Vision).

## Étapes / vérif

1. Engine `types.ts` (union) + `hero/index.ts` (handler vision) → nouveau cas dans
   `hero-adventure-spell.test.ts` (Vision révèle le brouillard au rayon).
2. Content `schemas.ts` (union discriminée) → content test.
3. Données `spells.json` + locales FR/EN → content:check, parité.
4. Vérifs : typecheck 5/5, lint, engine (golden + save-shape inchangés), content,
   build (< 800 Ko), garde-fous zéro-faction + couleurs, smoke (non-régression
   sort d'aventure / spellbook).
5. Doc 02 §1.4 : Vision livrée. Backlog H-SPELLS.3 partiel (Vision ✅ ; Rappel =
   `townPortal` déjà couvert ; invocation/chaîne/résurrection de pile ⬜).

## Journal

- Plan créé ; exploration : `handleCastAdventureSpell` (townPortal), `revealAround`
  (rectangle rayon), client `AdventureSpellbook` générique (aucune cible requise).
- **Livré** : `AdventureEffect` union += vision (types.ts) ; branche vision du
  handler (hero/index.ts) ; schéma content union discriminée ; sort `clairvoyance`
  (spells.json, jq append) + locales FR/EN (jq, accents préservés) ; 2 tests
  moteur (Vision révèle le brouillard au rayon sans déplacer + refus sans mana).
- Vérifs vertes : typecheck 5/5, lint, engine **619** (+2, golden + save-shape
  inchangés), content **119** (parité), content:check 6 paquets, build (gzip
  ≈ 302 Ko < 800), garde-fous zéro-faction (client inchangé) + couleurs (aucun
  CSS), smoke sort d'aventure 2/2. **Pas de bump save, golden inchangé.**
- Doc 02 §1.4 mise à jour ; backlog H-SPELLS.3 ✅.
