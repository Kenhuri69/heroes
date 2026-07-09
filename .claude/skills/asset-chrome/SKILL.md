---
name: asset-chrome
description: Générer/regénérer le chrome décoratif de l'UI — cadres de panneau (9-slice) et rubans d'en-tête (3-slice) dans le style « laiton & parchemin » (doc 08 §5), déterministe (gen_chrome.py), à appliquer via CSS `border-image`. Utiliser pour renforcer l'identité visuelle du jeu dans l'UI interactive (« donne un cadre orné aux modales », « le ruban d'en-tête manque de laiton », « ajoute un séparateur ornementé »). Ne PAS utiliser pour les tuiles/icônes UI (skill asset-procedural), les illustrations unités/bâtiments/avatars (skill asset-sheet), ni pour un audit d'ergonomie (skill ux-audit).
---

# Chrome décoratif d'UI (cadres & rubans)

Comble le trou d'identité : l'art plein cadre (fonds, logo, illustrations) porte
la gouache, mais l'UI **interactive** (panneaux, en-têtes) était plate/tokenisée.
Ce skill génère l'**habillage** — cadres de panneau et rubans d'en-tête — dans le
style **laiton & parchemin** du `docs/08-ui-ux.md` §5, appliqué via CSS
`border-image` (donc **hors bundle**, budget intact).

Source de vérité : `docs/12-assets-style-guide.md` — **Règle G** : déterminisme
absolu (formes vectorielles fixes, aucun aléa → re-run = octets identiques),
découpe **9-slice** (bords à section constante = répétables sans couture, coins
ornés), rampe laiton **dans le script** (les `.css` restent aux tokens — le
garde-fou couleurs ne vise que les feuilles de style).

## Prérequis
```bash
python3 -c "import PIL" 2>/dev/null \
  || python3 -m pip install -r tools/assets/requirements.txt
```

## Génération
```bash
python3 tools/assets/gen_chrome.py
```
→ `assets/ui/chrome/panel-frame.png` (160², **slice 40**) — cadre à rails laiton
  + rivets de coin, **centre transparent** (le fond tokenisé du panneau reste
  visible).
→ `assets/ui/chrome/ribbon.png` (320×72, **slice horizontal 72**) — bandeau à
  face **encre** (le texte clair d'en-tête y reste lisible) + rails laiton + caps
  « fanion ».
→ `assets/ui/chrome/_preview.png` — rendu témoin (cadre étiré autour d'un
  panneau sombre + ruban) : **contrôler à l'œil** avant de committer.

- **Ajouter/retoucher une pièce** = une fonction `build_<pièce>()` (formes PIL
  sur canvas, bords à profil constant) + un appel dans `main()`. Garder les
  bords **tileables** (section constante) : un motif qui « tourne » sur un bord
  crée une couture en `round`/`repeat`.

## Intégration client (registre auto-découvert)
Le registre `render/assets.ts` (`import.meta.glob('assets/**/*.png', ?url)`)
enregistre déjà tout PNG déposé (`_preview.png` exclu). On expose des résolveurs
`chromeFrameUrl()` / `chromeRibbonUrl()` et on applique le chrome en **style
inline** `border-image` (repli gracieux : URL absente ⇒ bordure tokenisée). Voir
le **panneau témoin** = modale de ville (`ui/TownScreen.tsx`) : cadre sur
`.town-screen`, ruban sur le bandeau « Chantier du jour ». Toujours mettre
`box-sizing: border-box` sur la surface habillée (le cadre ne doit pas
l'agrandir — la zone de contenu se réduit, pas l'inverse).

```tsx
const frame = chromeFrameUrl();
const style = frame
  ? { borderWidth: '16px', borderStyle: 'solid', borderColor: 'transparent',
      borderImage: `url(${frame}) 40 round` }
  : undefined;
```

## Vérification
1. Exécution sans erreur, relire `_preview.png` (cadre net, coins ornés, ruban
   lisible).
2. **Déterminisme** : relancer le script, `git status` ne montre **aucun** PNG
   modifié (octets identiques).
3. Si branché sur un écran : capturer via `ux-audit` (`capture.mjs`) l'écran
   témoin avant/après, vérifier qu'aucune mise en page ne casse (border-box) aux
   3 crans de police.
4. Committer les PNG regénérés AVEC la modification du script (même commit).

## Pièges
- **Bord non tileable** : un motif dessiné hors profil constant coud en
  `round`/`repeat` — dessiner les bords en rectangles à section fixe, réserver
  l'ornement aux **coins** (9-slice) ou aux **caps** (3-slice horizontal).
- **Contraste du texte** : un ruban à face claire (parchemin) sous un texte clair
  = illisible. La face du ruban est **encre** par défaut ; garder une face sombre
  sous du texte clair (ou basculer le texte en sombre).
- **Layout** : sans `box-sizing: border-box`, `border-image` agrandit la boîte et
  décale le contenu.
- PNG **hors bundle** (registre `?url`) : ne jamais les inliner dans le JS/CSS.
