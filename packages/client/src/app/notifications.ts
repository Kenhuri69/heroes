import type { GameState } from '@heroes/engine';
import { appStore, type JournalEntry } from './store';
import { humanId } from './game';
import { type AppEvent } from './events';
import {
  t,
  resolveUnitName,
  resolveSpellName,
  resolveSkillName,
  resolveBuildingName,
  resolveFactionResourceName,
} from './i18n';

/** Plafond d'entrées conservées dans le journal (doc 08 §3) — ring buffer léger. */
const MAX_JOURNAL = 100;

let nextJournalId = 1;

/**
 * Traduit un événement moteur/app en message de notification, ou `null` s'il
 * n'est pas notifié (doc 08 §3). Source UNIQUE des toasts ET du journal (DRY).
 *
 * **Filtre joueur humain** : les événements « possédés » (ville → propriétaire,
 * héros → joueur, `playerId`) ne sont notifiés que pour le joueur humain — sans
 * ça, la boucle IA (`runAiLoop`) inonderait toasts et journal des revenus /
 * recrutements des adversaires. Les événements globaux (semaine, fin de combat /
 * partie) restent affichés.
 *
 * NB victoire/défaite : `event.winner` est un CAMP ; le joueur est toujours
 * l'attaquant (`combat.playerSide === 'attacker'`). Rendre ça générique
 * demanderait de porter `playerSide` dans `CombatEnded` (reporté R7c) ; les
 * combats IA-vs-neutres restent donc affichés — écart mineur documenté.
 */
export function notify(event: AppEvent, game: GameState): string | null {
  const human = humanId(game);
  const ownTown = (townId: string): boolean =>
    game.towns.find((tw) => tw.id === townId)?.ownerPlayerId === human;
  const ownHero = (heroId: string): boolean =>
    game.heroes.find((h) => h.id === heroId)?.playerId === human;

  switch (event.type) {
    case 'ResourcePicked':
      return event.playerId === human
        ? t('toast.resourcePicked', { amount: event.amount, resource: t(`resource.${event.resource}`) })
        : null;
    case 'WeekStarted':
      return t('toast.weekStarted', { week: event.week });
    case 'CombatEnded':
      return event.winner === 'attacker' ? t('toast.combatWon') : t('toast.combatLost');
    // Nécromancie (doc 04 §2) : relève post-victoire (effet de faction).
    case 'UndeadRaised':
      return ownHero(event.heroId)
        ? t('toast.undeadRaised', { count: event.count, unit: resolveUnitName(event.unitId) })
        : null;
    // Ressource de faction gagnée post-victoire (doc 05 §3.3).
    case 'FactionResourceGained':
      return event.playerId === human
        ? t('toast.factionResourceGained', {
            amount: event.amount,
            resource: resolveFactionResourceName(event.resource),
          })
        : null;
    case 'HeroLevelUp':
      return ownHero(event.heroId) ? t('toast.heroLevelUp', { level: event.level }) : null;
    case 'SpellCast':
      return ownHero(event.heroId)
        ? t('toast.spellCast', { hero: t('hero.genericName'), spell: resolveSpellName(event.spellId) })
        : null;
    case 'SkillLearned':
      return ownHero(event.heroId)
        ? t('toast.skillLearned', {
            skill: resolveSkillName(event.skillId),
            rank: t(`skill.rank.${event.rank}`),
          })
        : null;
    case 'GameLoaded':
      return t('toast.gameLoaded');
    // Échec de stockage d'une sauvegarde (doc 07 §4) — évite la perte silencieuse.
    case 'SaveFailed':
      return t('toast.saveFailed');
    // Villes (doc 02 §4) — revenu / croissance / construction / recrutement / capture.
    case 'TownIncome':
      return event.playerId === human
        ? t('toast.townIncome', { amount: event.amount, resource: t(`resource.${event.resource}`) })
        : null;
    case 'TownGrowth':
      return ownTown(event.townId)
        ? t('toast.townGrowth', { added: event.added, unit: resolveUnitName(event.unitId) })
        : null;
    case 'TownBuilt':
      return ownTown(event.townId)
        ? t('toast.townBuilt', { building: resolveBuildingName(event.buildingId) })
        : null;
    case 'UnitsRecruited':
      return ownTown(event.townId)
        ? t('toast.unitsRecruited', { count: event.count, unit: resolveUnitName(event.unitId) })
        : null;
    case 'TownCaptured':
      return event.playerId === human ? t('toast.townCaptured') : null;
    // Fin de partie (doc 02 §6) — l'overlay porte le message principal, ce toast
    // n'est qu'un signal immédiat.
    case 'GameEnded':
      return event.status === 'won' ? t('toast.gameWon') : t('toast.gameLost');
    default:
      return null;
  }
}

/**
 * Ajoute une entrée au journal consultable (doc 08 §3), datée du jour courant.
 * Incrémente le compteur de non-lus SAUF si la modale journal est déjà ouverte
 * (l'utilisateur la lit en direct).
 */
export function appendJournal(message: string): void {
  appStore.setState((s) => {
    const journalOpen = s.modals.some((m) => m.kind === 'journal');
    const entry: JournalEntry = { id: nextJournalId++, day: s.game.calendar.day, message };
    return {
      journal: [...s.journal, entry].slice(-MAX_JOURNAL),
      journalUnread: journalOpen ? s.journalUnread : s.journalUnread + 1,
    };
  });
}
