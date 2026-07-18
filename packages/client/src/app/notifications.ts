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
  resolveArtifactName,
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
 * NB victoire/défaite : comparée au camp du joueur porté par l'événement
 * (`event.playerSide`, R7c) — correct même en combat défensif, plus l'hypothèse
 * « le joueur est l'attaquant ». Les combats IA-vs-neutres restent affichés
 * (le filtrage par joueur du combat est un écart mineur documenté).
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
    // Objets de carte (doc 02 §2.2) : mine capturée / revenu, trésor, artefact.
    case 'MineCaptured':
      return event.playerId === human
        ? t('toast.mineCaptured', {
            resource: t(`resource.${event.resource}`),
            amount: event.amount,
          })
        : null;
    case 'MineIncome':
      return event.playerId === human
        ? t('toast.mineIncome', { amount: event.amount, resource: t(`resource.${event.resource}`) })
        : null;
    // Obélisque visité (T-GRAIL) : progression, puis message de révélation du Graal.
    case 'ObeliskVisited':
      return event.playerId === human
        ? event.grailRevealed
          ? t('toast.grailRevealed')
          : t('toast.obeliskVisited', { visited: event.visited, total: event.total })
        : null;
    case 'GrailFound':
      return event.playerId === human ? t('toast.grailFound') : null;
    case 'TreasureTaken':
      return event.playerId === human
        ? t(event.choice === 'gold' ? 'toast.treasureGold' : 'toast.treasureXp', {
            amount: event.amount,
          })
        : null;
    case 'ArtifactPicked':
      return event.playerId === human
        ? t('toast.artifactPicked', { artifact: resolveArtifactName(event.artifactId) })
        : null;
    // Butin de gardien (doc 02 §2.2) : or toujours, ressource/artefact selon la
    // force — message composé (seuls les gains effectifs sont mentionnés).
    case 'GuardianVanquished': {
      if (event.playerId !== human) return null;
      const parts = [t('toast.guardianRewardGold', { gold: event.gold })];
      if (event.resource && event.resourceAmount > 0)
        parts.push(
          t('toast.guardianRewardResource', {
            amount: event.resourceAmount,
            resource: t(`resource.${event.resource}`),
          }),
        );
      if (event.artifactId)
        parts.push(t('toast.guardianRewardArtifact', { artifact: resolveArtifactName(event.artifactId) }));
      return parts.join(' ');
    }
    // Lieux de bonus & habitations (doc 02 §2.2, lot 2 du comblement).
    case 'BonusVisited': {
      if (event.playerId !== human) return null;
      const effect = event.effect;
      if (effect.kind === 'luck') return t('toast.bonusLuck', { amount: event.amount });
      if (effect.kind === 'morale') return t('toast.bonusMorale', { amount: event.amount });
      if (effect.kind === 'movement') return t('toast.bonusMovement', { amount: event.amount });
      if (effect.kind === 'levelXp' || effect.kind === 'experience')
        return t('toast.bonusXp', { amount: event.amount });
      if (effect.kind === 'vision') return t('toast.bonusVision', { amount: event.amount });
      if (effect.kind === 'permanentStat')
        return t('toast.bonusPermanentStat', {
          attribute: t(`attribute.${effect.attribute}`),
          amount: event.amount,
        });
      if (effect.kind === 'learnSpell')
        // amount 0 = sort déjà connu ⇒ pas de toast (rien appris).
        return event.amount > 0 ? t('toast.bonusSpell', { spell: resolveSpellName(effect.spellId) }) : null;
      if (effect.kind === 'grantSkill')
        // amount 0 = compétence déjà connue ⇒ pas de toast (rien appris).
        return event.amount > 0 ? t('toast.bonusSkill', { skill: resolveSkillName(effect.skillId) }) : null;
      if (effect.kind === 'grantWarMachine')
        // amount 0 = machine déjà possédée ⇒ pas de toast (rien donné).
        return event.amount > 0
          ? t('toast.bonusWarMachine', { machine: resolveUnitName(effect.machineId) })
          : null;
      if (effect.kind === 'restoreMana')
        // amount 0 = mana déjà pleine ⇒ pas de toast (rien restauré).
        return event.amount > 0 ? t('toast.bonusMana', { amount: event.amount }) : null;
      if (effect.kind === 'grantArtifact')
        return t('toast.bonusArtifact', { artifact: resolveArtifactName(effect.artifactId) });
      return t('toast.bonusResource', {
        amount: event.amount,
        resource: t(`resource.${effect.resource}`),
      });
    }
    case 'DwellingRecruited':
      return event.playerId === human
        ? t('toast.dwellingRecruited', { count: event.count, unit: resolveUnitName(event.unitId) })
        : null;
    case 'HeroTeleported':
      return ownHero(event.heroId) ? t('toast.teleported') : null;
    case 'WeekStarted':
      return t('toast.weekStarted', { week: event.week });
    // Événement de calendrier (M-CALENDAR, doc 02 §2.3) : annoncé seulement si sa
    // croissance diffère de la normale (les semaines « normales » ne toastent pas
    // — décidé par le facteur, pas un id en dur).
    case 'CalendarEventStarted': {
      const def = game.config?.calendar?.events.find((e) => e.id === event.eventId);
      // « Semaine de X » d'une unité (doc 18 A4) : toast avec le nom de l'unité
      // tirée — affiché même à facteur global 1 (le ciblage EST l'événement).
      if (def?.growthUnit) {
        const unitId = game.calendar.weekEventUnitId;
        return unitId
          ? t('toast.calendarEvent', {
              event: t(`calendar.event.${event.eventId}.name`, { unit: resolveUnitName(unitId) }),
            })
          : null;
      }
      return def !== undefined && def.growthFactor !== 1
        ? t('toast.calendarEvent', { event: t(`calendar.event.${event.eventId}.name`) })
        : null;
    }
    // Événement de MOIS (doc 18 A4, lot 2.5) : même gate que la semaine.
    case 'CalendarMonthStarted': {
      const factor = game.config?.calendar?.monthEvents?.find((e) => e.id === event.eventId)?.growthFactor;
      return factor !== undefined && factor !== 1
        ? t('toast.calendarMonth', { event: t(`calendar.month.${event.eventId}.name`) })
        : null;
    }
    // Semaine de ruée (M-CALENDAR) : ressource créditée — notifiée au seul humain.
    case 'CalendarResourceGranted':
      return event.playerId === human
        ? t('toast.calendarResource', {
            amount: event.amount,
            resource: t(`resource.${event.resource}`),
          })
        : null;
    // Semaine du savoir (M-CALENDAR) : XP créditée — notifiée au seul humain.
    case 'CalendarXpGranted':
      return event.playerId === human ? t('toast.calendarXp', { amount: event.amount }) : null;
    // Trigger de carte (doc 02 §2.1 + doc 18 A5) : message global localisé, ou
    // effet notifié au seul joueur humain (comme un ramassage). Une embuscade
    // n'a pas de toast — l'ouverture du combat EST le feedback.
    case 'TriggerFired':
      switch (event.effect.kind) {
        case 'message':
          return t(event.effect.textKey);
        case 'grantResource':
          return event.playerId === human
            ? t('toast.triggerResource', {
                amount: event.effect.amount,
                resource: t(`resource.${event.effect.resource}`),
              })
            : null;
        case 'grantArtifact':
          return event.playerId === human
            ? t('toast.triggerArtifact', { artifact: resolveArtifactName(event.effect.artifactId) })
            : null;
        case 'grantArmy':
          return event.playerId === human
            ? t('toast.triggerArmy', {
                count: event.effect.count,
                unit: resolveUnitName(event.effect.unitId),
              })
            : null;
        case 'ambush':
          return null;
      }
      return null; // inatteignable (switch exhaustif) — satisfait no-fallthrough
    case 'CombatEnded':
      return event.winner === event.playerSide ? t('toast.combatWon') : t('toast.combatLost');
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
    case 'HeroAttributeChosen':
      return ownHero(event.heroId)
        ? t('toast.heroAttributeChosen', { attribute: t(`attribute.${event.attribute}`) })
        : null;
    case 'SpellCast':
      return ownHero(event.heroId)
        ? t('toast.spellCast', { hero: t('hero.genericName'), spell: resolveSpellName(event.spellId) })
        : null;
    // Sort d'aventure (doc 02 §1.4, Alpha 4.16) — lancé hors combat sur la carte.
    case 'AdventureSpellCast':
      return ownHero(event.heroId)
        ? t('toast.adventureSpellCast', { spell: resolveSpellName(event.spellId) })
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
    case 'UnitsUpgraded':
      return ownTown(event.townId)
        ? t('toast.unitsUpgraded', { count: event.count, unit: resolveUnitName(event.toUnitId) })
        : null;
    case 'WarMachineBought':
      return ownHero(event.heroId)
        ? t('toast.warMachineBought', { machine: resolveUnitName(event.unitId) })
        : null;
    case 'TownCaptured':
      return event.playerId === human ? t('toast.townCaptured') : null;
    // Caravanes inter-villes (T-CARAVAN, doc 02 §4.1) — notifiées au joueur humain.
    case 'CaravanSent':
      return event.playerId === human ? t('toast.caravanSent', { days: event.days }) : null;
    case 'CaravanArrived':
      return event.playerId === human
        ? t('toast.caravanArrived', { count: event.count, unit: resolveUnitName(event.unitId) })
        : null;
    case 'CaravanLost':
      return event.playerId === human ? t('toast.caravanLost') : null;
    // Contrats de chasse (doc 05 §3.3) — cible neutre hebdomadaire.
    case 'HuntContractAssigned':
      return event.playerId === human ? t('toast.huntContractAssigned') : null;
    case 'HuntContractCompleted':
      return event.playerId === human
        ? t('toast.huntContractCompleted', {
            gold: event.gold,
            amount: event.amount,
            resource: resolveFactionResourceName(event.resource),
          })
        : null;
    // Fin de partie (doc 02 §6) — l'overlay porte le message principal, ce toast
    // n'est qu'un signal immédiat.
    case 'GameEnded':
      return event.status === 'won' ? t('toast.gameWon') : t('toast.gameLost');
    default:
      return null;
  }
}

/**
 * Agrège les revenus RÉCURRENTS du jour (E9) — `MineIncome` + `TownIncome` du
 * joueur humain d'un même lot — en UN message « Revenus du jour : +N or, +X bois… »
 * (somme par ressource, or en tête). Renvoie `null` si le lot n'en contient aucun.
 * Pur (testable) : remplace la pluie de toasts un-par-source à l'aube.
 */
export function sumDailyIncome(
  events: readonly AppEvent[],
  humanPlayerId: string,
): Array<{ resource: string; amount: number }> {
  const sums = new Map<string, number>();
  for (const e of events) {
    if ((e.type === 'MineIncome' || e.type === 'TownIncome') && e.playerId === humanPlayerId)
      sums.set(e.resource, (sums.get(e.resource) ?? 0) + e.amount);
  }
  const order = (r: string): number => (r === 'gold' ? 0 : 1); // or en tête, reste stable
  return [...sums.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([resource, amount]) => ({ resource, amount }));
}

export function aggregateDailyIncome(events: readonly AppEvent[], game: GameState): string | null {
  const parts = sumDailyIncome(events, humanId(game));
  if (parts.length === 0) return null;
  const list = parts.map((p) => `+${p.amount} ${t(`resource.${p.resource}`)}`).join(', ');
  return t('toast.dailyIncome', { list });
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
