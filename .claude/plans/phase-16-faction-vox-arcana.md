# Phase 16 — Nouvelle faction : Vox Arcana (Poudlard × KPop Demon Hunters)

> Plan vivant (guidelines §5). Faction #6, **test de modularité #4**.
> État : **cadrage — validation de l'identité par les assets** (aucun code moteur, aucune donnée jouable encore).

## Concept validé (chat)

- **Fantasme** : une académie de magie où l'on chasse le démon par l'**incantation** (héritage Poudlard) *et* la **scène** (héritage HUNTR/X / KPop Demon Hunters). Ton **sérieux, mythologique**.
- **Signature** : **Les 5 Maisons** — allégeance choisie (héros/ville) qui applique un profil de bonus **déclaratif** → 1 seul point d'extension moteur générique `houseAllegiance` (jamais `if maison === …`).
- **Ressource de faction** : **Résonance (Honmoon)** — montée en combat par les unités « qui chantent », dépensée dans l'**École de la Scène**.
- **Différenciation vs Arcane Hunters** (doc 05, déjà « académie × chasse ») : AH = **Marques + Cercles + traque** ; K-MAGIX = **Maisons + Résonance + scène/Honmoon**. Palette et bestiaire distincts (néon pop + glycine + oni coréen vs runes de traque).

## Direction artistique (dérivée des visuels fournis)

- Pierre noire gothique + filigrane d'argent/or ; **cyan électrique + magenta/violet néon** ; **glycine (wisteria)** ; château gothique **+ toits de pagode coréens** ; masque d'**oni** ; chouettes/corbeaux spectraux, gargouilles.
- Nom de faction **verrouillé** : **Vox Arcana** (id `vox-arcana`) — « la voix arcane » (le sort *et* la voix). Ex-titre « K-MAGIX / Demon Tour ».

## Les 5 Maisons (signature)

| Maison | Archétype | Bonus déclaratif (à chiffrer) |
|---|---|---|
| Le Lion | courage | +Att mêlée, +Moral |
| Le Serpent | ambition | +Or/jour, accès malédictions |
| L'Aigle | savoir | +Mana, coût de sort réduit |
| Le Blaireau | loyauté | +Croissance hebdo, +Déf/PV |
| **Venari** (HUNTR/X) | scène/Honmoon | +Gain de Résonance, buffs de performance renforcés |

## Roster T1–T8 (dosage Poudlard + hunter)

T1 Chœur d'apprentis · T2 Duelliste · T3 Hippogriffe · T4 Chasseuse-Idole (HUNTR/X) ·
T5 Sombral *(validé ; swap Kumiho/Haetae possible plus tard)* · T6 Maître de Sortilèges · T7 Phénix ·
T8 Avatar du Honmoon (débloqué à Résonance max).

## Héros nommés

- **Hermione** — héroïne **Magic**, Maison de l'Aigle (savoir/incantation).
- **Rumi** — héroïne **Might/Hunter**, Maison Venari (double lame, scène/Honmoon).

## Étapes

1. Cadrage identité (ce plan) → **vérif** : validé en chat. ✅
2. Nom de faction verrouillé → **vérif** : **Vox Arcana** (`vox-arcana`). ✅
3. Base d'assets : prompts avatars Hermione & Rumi + blasons 5 Maisons + planche d'unités → **vérif** : `assets/prompts/faction-vox-arcana.md`, prompts conformes doc 12. ✅
4. Génération des visuels **(externe/Gemini — côté utilisateur)** + QC → **vérif** : QC verte `sheet_extract`, staging `assets/`. ⏳
5. Verrouillage du plan par les assets → **vérif** : accord utilisateur sur DA + roster.
6. Rédaction `docs/16-faction-vox-arcana.md` (source de vérité, guidelines §8.6) → **vérif** : doc complet façon doc 05.
7. Découpage en sous-lots data-only + points d'extension (`houseAllegiance`, Résonance) → **vérif** : garde-fou « zéro faction dans le moteur » vert.

## Écarts / décisions

- **Génération d'images indisponible dans l'environnement Claude Code** : HF Spaces `invoke` désactivé (`gradio=none`), et le procédural du projet ne couvre que tuiles/icônes — pas les personnages painterly. Les planches sont donc générées **hors environnement** (Gemini/Nano Banana), puis je fais QC + détourage + staging (`sheet_extract.py`, deps installées).
- Nom : « Vox Arcana » retenu parmi 4 propositions (vs L'Ordre du Honmoon / Sonarium / Le Chœur d'Ébène).
- T5 = Sombral (validé).
