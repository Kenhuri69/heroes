import { appStore } from './store';

/**
 * Télémétrie **locale, opt-in** (doc 09 ligne 50, Alpha 4.19) : mesure la durée
 * des tours et le taux de combats auto-résolus (« abandon »), stockée **seulement
 * dans le `localStorage`** du navigateur — jamais envoyée nulle part. Désactivée
 * par défaut ; aucun enregistrement tant que le joueur n'a pas donné son accord.
 * Exportable/effaçable depuis les Options.
 */

const K_ENABLED = 'heroes:telemetry:enabled';
const K_DATA = 'heroes:telemetry:data';

export interface TelemetryData {
  /** Tours humains terminés (fin de tour). */
  turns: number;
  /** Somme des durées de tour (ms) — moyenne = turnMsTotal / turns. */
  turnMsTotal: number;
  /** Combats vus par le joueur. */
  combats: number;
  /** Combats délégués à l'auto-combat (« abandon » de la conduite manuelle). */
  combatsAuto: number;
}

const ZERO: TelemetryData = { turns: 0, turnMsTotal: 0, combats: 0, combatsAuto: 0 };

function read(): TelemetryData {
  try {
    const raw = localStorage.getItem(K_DATA);
    if (!raw) return { ...ZERO };
    const p = JSON.parse(raw) as Partial<TelemetryData>;
    return {
      turns: Number(p.turns) || 0,
      turnMsTotal: Number(p.turnMsTotal) || 0,
      combats: Number(p.combats) || 0,
      combatsAuto: Number(p.combatsAuto) || 0,
    };
  } catch {
    return { ...ZERO };
  }
}

function write(d: TelemetryData): void {
  try {
    localStorage.setItem(K_DATA, JSON.stringify(d));
  } catch {
    /* quota / navigation privée : la télémétrie n'est jamais critique */
  }
}

export function isTelemetryEnabled(): boolean {
  try {
    return localStorage.getItem(K_ENABLED) === '1';
  } catch {
    return false;
  }
}

export function setTelemetryEnabled(on: boolean): void {
  try {
    localStorage.setItem(K_ENABLED, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  appStore.setState({ telemetryEnabled: on });
}

export function getTelemetry(): TelemetryData {
  return read();
}

export function resetTelemetry(): void {
  write({ ...ZERO });
  // Force un re-render des Options (les stats sont lues hors store).
  appStore.setState((s) => ({ telemetryTick: s.telemetryTick + 1 }));
}

/** Appelé au clic « Auto » du combat — délégation = « abandon » de la conduite manuelle. */
export function recordCombatAuto(): void {
  if (!isTelemetryEnabled()) return;
  const d = read();
  d.combatsAuto += 1;
  write(d);
}

let turnStart: number | null = null;
let turnKey = '';
let wasCombat = false;

/**
 * Branche la collecte sur le store (durée de tour + apparition de combat). Pur
 * client (`Date.now()` navigateur) ; no-op tant que la télémétrie est désactivée.
 */
export function initTelemetry(): void {
  appStore.setState({ telemetryEnabled: isTelemetryEnabled() });
  appStore.subscribe(() => {
    if (!isTelemetryEnabled()) {
      turnStart = null;
      turnKey = '';
      return;
    }
    const g = appStore.getState().game;
    const active = g.players[g.currentPlayer];
    // Un combat NE coupe PAS le tour : on ne change de tour qu'au passage à un
    // nouveau tour humain (jour/joueur), sinon le combat le fractionnerait.
    if (g.started && !g.combat && !g.outcome && active?.controller === 'human') {
      const key = `${g.calendar.day}:${active.id}`;
      if (key !== turnKey) {
        if (turnStart !== null && turnKey !== '') {
          const d = read();
          d.turns += 1;
          d.turnMsTotal += Math.max(0, Date.now() - turnStart);
          write(d);
        }
        turnStart = Date.now();
        turnKey = key;
      }
    }
    const nowCombat = g.combat !== null;
    if (nowCombat && !wasCombat) {
      const d = read();
      d.combats += 1;
      write(d);
    }
    wasCombat = nowCombat;
  });
}
