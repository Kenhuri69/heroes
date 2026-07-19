# Lot E-factions — doc sync docs de faction (E5)

Sous-lot du Lot E (doc sync). Corrige docs **03/04/05/14** vers le code.
La **table des élites** d'E5 était déjà livrée en D12 (§3bis/§4bis) — non
refaite ici. Reste d'E5 traité, chaque fait vérifié contre données/code.

## doc 03 (Haven) — F1
- « moteur MVP à 6 capacités » → **9** capacités génériques (catalogue
  `abilities.json`), listées ; Haven n'en exerce que `flying`/`shooter`.
- Réf. à l'interface `AbilityModule` (inexistante) retirée → mécanisme réel
  = capacités inline (doc 06 §4) ; note « élite = habitation niveau 2 ».

## doc 04 (Necropolis) — F6 / F5(D7)
- « −1 moral infligé aux vivants adverses » (aura non interprétée) → **différé**.
- Cap de Nécromancie déjà formulé « effectif **restant** » (D7) — inchangé.

## doc 05 (Arcane Hunters) — F8 / F9 / F3 + placeholders
- **F8** : coût **60 Essence** du Portail = différé (le bâtiment livré coûte
  4000 or + 3 gemmes + 3 mercure, sans Essence ; l'Essence est dépensée au
  **recrutement** du T8, 40). Salle des Reliques = différée (jamais livrée).
- **F9** : diagramme corrigé — T8 **requiert le T7** (chaîne, D8), pas une
  branche depuis le T6.
- **F3** : `sharedGrowthGroups` apex **ni déclaré** (manifeste `{}`) **ni
  câblé** → acté « différé » (T7/T8 ont chacun leur croissance).
- Cercles : bonus **placeholder** livrés (Vigile +250 or/j, Sceau +400 or/j,
  Traque +20 % croiss., Abîme +40 % croiss.) ; passifs de design différés.
- Contrat : **300 or + 15 Essence** livrés (placeholder).

## doc 14 (Sylvan Court) — F15
- §4 : prérequis d'habitations corrigés — **T1 requiert le Fort**, **T5 la
  Guilde des mages** (comme les 3 maisons), pas « hôtel de ville → T1 ».

## Vérification
Docs seuls. Suite complète (garde-fou §7) : lint, engine+content,
content:check, guards, build < 800 Ko, smoke desktop+mobile.

## État : livré.
