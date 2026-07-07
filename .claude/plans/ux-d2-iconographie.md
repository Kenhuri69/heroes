# Plan — UXD-2 : iconographie unifiée

> Lot 2 du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Remplace les
> trois langages d'icônes qui cohabitent (emojis ⚙🔔, glyphes unicode ⚔☰⌂▣◆⚒⛺✚✦,
> texte brut) par des icônes **procédurales** (règle P doc 12 : déterministes,
> mipmaps 256→16, silhouette + liseré, lisibles à 16 px), même famille que les
> icônes ressources/stats déjà en production.

## 1. Inventaire des surfaces (audit du code)

| Surface | Actuel | Icône cible |
|---|---|---|
| HUD carte : options | `⚙` (`shell.tsx`) | `act-options` (engrenage) |
| HUD carte : journal | `🔔` + badge | `act-journal` (cloche) |
| HUD carte : tiroir héros | `☰` | `act-hero` (heaume) |
| HUD carte : indice gardien | `⚔` (`guardian-hint`) | `act-combat` (épées croisées) |
| Onglets ville | `⌂ ▣ ◆ ⚒` (`TownScreen`) | `tab-build/recruit/garrison/market` |
| Éditeur : outils | `⛺ ✚ ◆…` (`MapEditor`) | réutilise `act-*`/`res-*` existants |
| SpellBook : écoles | texte seul | `school-<école>` (différé si > 4 recettes) |
| Combat : capacité/consigne | texte seul | — (texte OK, pas d'icône requise) |

Règles d'usage (doc 08 §1/§4) :
- **Icône + libellé** par défaut ; bouton compact (44×44) = `aria-label`
  conservé + libellé au tooltip/appui long (A2).
- Jamais l'icône seule comme unique canal (A5) ; les `data-testid` ne
  changent pas (smokes intacts).

## 2. Étapes

- [x] Recettes `gen_ui_icons.py` : `act-options`, `act-journal`, `act-hero`,
      `act-combat`, `tab-build`, `tab-recruit`, `tab-garrison`, `tab-market`
      (8 recettes — même gabarit que `gold()`/`wood()`).
      → vérif : re-run du script = octets identiques (déterminisme),
      `_preview.png` inspectée, lisible à 16 px.
- [x] Composant `UiIcon` (`ui/UiIcon.tsx`) : résout `ui/<id>_<size>.png` via le
      registre d'assets (`uiIconUrl` existant ou équivalent), repli sur le
      glyphe actuel (`<AssetImg fallback>`), `aria-hidden` (le libellé porte le
      sens).
- [x] Purge des emojis/glyphes : `shell.tsx` (⚙ 🔔 ☰ ⚔) → `UiIcon` avec repli
      glyphe ; onglets `TownScreen.tsx` enrichis (icône + libellé, testids
      inchangés). **Écart** : les onglets de ville n'utilisaient PAS de glyphes
      (texte seul) et les ◆⌂⚒▣✦⛺✚ de `MapEditor.tsx` sont des marqueurs de
      cases (contenu, doublés de teinte+libellé), pas des icônes d'UI — gardés
      tels quels (outil interne, hors périmètre).
- [x] Vérif finale : 0 emoji décoratif restant hors replis/MapEditor, build +
      budget OK, re-passe `ux-audit` 30 captures 0 WARN, smokes 86 verts +
      2 skipped. Déterminisme : double run du générateur = octets identiques
      (les 18 icônes existantes n'ont pas bougé).

## 3. Hors périmètre

- Icônes d'écoles de magie et statuts de combat (arrivent avec UXD-4 combat).
- Toute retouche de style des boutons (fait en UXD-1, consommé tel quel).
