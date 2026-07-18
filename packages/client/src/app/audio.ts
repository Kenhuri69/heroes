import { appStore } from './store';
import { eventBus, type AppEvent } from './events';
import { humanId } from './game';

/**
 * Ambiance sonore (UXD-6B). Architecture **jouable silencieuse** : tant qu'aucun
 * fichier n'est présent sous `assets/audio/` (staging Règle F, doc 12), tout se
 * dégrade en silence — aucun son, aucune erreur. À la réception des `.ogg`/
 * `.m4a` (lot d'intégration audio), le contenu se branche sans câblage.
 *
 * Invariants (doc 12 Règle F / doc 08 §4) :
 * - **Hors bundle** : `import.meta.glob ?url` — seules des URLs entrent dans le
 *   JS ; les octets sont fetchés à la demande (comme les images).
 * - **Autoplay** : rien ne joue avant la 1ʳᵉ interaction utilisateur (déblocage).
 * - **Volumes persistés** (`localStorage`), modérés par défaut ; le son **double**
 *   toujours un feedback visuel existant — jamais le seul canal d'information.
 */

// Registre hors bundle : `music/<id>` | `sfx/<id>` → URL hashée. On préfère
// l'OGG (Vorbis) et retombe sur le M4A (AAC, Safari) si l'OGG manque.
const modules = import.meta.glob('../../../../assets/audio/**/*.{ogg,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const registry = new Map<string, string>(); // clé → url (ogg prioritaire)
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/\/assets\/audio\/(.+)\.(ogg|m4a)$/);
  if (!m || !m[1]) continue;
  const key = m[1];
  if (m[2] === 'ogg' || !registry.has(key)) registry.set(key, url);
}

const K_MUSIC = 'heroes:audio:music';
const K_SFX = 'heroes:audio:sfx';
const K_MUTED = 'heroes:audio:muted';

function readMuted(): boolean {
  try {
    return localStorage.getItem(K_MUTED) === '1';
  } catch {
    return false;
  }
}

// Mute rapide (I8) : OVERRIDE global — coupe musique ET SFX sans toucher aux
// volumes réglés aux Options (restaurés au dé-mute). Persisté.
let muted = readMuted();

function readVolume(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
  } catch {
    return fallback;
  }
}

let musicVolume = readVolume(K_MUSIC, 0.35); // modéré par défaut
let sfxVolume = readVolume(K_SFX, 0.6);

let unlocked = false;
let currentContext: string | null = null; // clé de piste musicale voulue
const music = typeof Audio !== 'undefined' ? new Audio() : null;
if (music) {
  music.loop = true;
  music.volume = musicVolume;
}

/** Contexte → piste musicale (fichier `music/<retour>`). null = silence. */
function musicContextKey(): string | null {
  const s = appStore.getState();
  if (s.screen === 'menu') return 'music/menu';
  if (!s.game.started) return null;
  // Fin de partie : on coupe la boucle de fond pour laisser respirer le jingle
  // victoire/défaite (joué en one-shot par `playJingle` sur `GameEnded`).
  if (s.game.outcome) return null;
  if (s.game.combat) return 'music/combat';
  if (s.modals.some((m) => m.kind === 'town')) return 'music/town';
  if (s.screen === 'adventure') return 'music/adventure';
  return null;
}

function applyMusic(): void {
  if (!music) return;
  const want = currentContext;
  const url = want ? registry.get(want) : undefined;
  music.volume = musicVolume;
  if (!url || musicVolume === 0 || muted || !unlocked) {
    if (!music.paused) music.pause();
    return;
  }
  const desired = url;
  // Change de piste uniquement si nécessaire (évite de couper une boucle en cours).
  if (music.dataset.key !== want) {
    music.src = desired;
    music.dataset.key = want ?? '';
  }
  if (music.paused) void music.play().catch(() => undefined); // autoplay refusé : silencieux
}

/** Joue un effet ponctuel (`sfx/<id>`) — no-op si absent, muet ou non débloqué. */
export function playSfx(id: string): void {
  if (!unlocked || sfxVolume === 0 || muted) return;
  const url = registry.get(`sfx/${id}`);
  if (!url || typeof Audio === 'undefined') return;
  const a = new Audio(url); // instance jetable : autorise les recouvrements
  a.volume = sfxVolume;
  void a.play().catch(() => undefined);
}

/**
 * Joue un jingle de fin de partie (`music/<id>` : `victory`/`defeat`) en
 * **one-shot** (pas de boucle), au volume musique. La boucle de fond est déjà
 * coupée par `musicContextKey` (outcome ⇒ null). No-op si absent/muet/non débloqué.
 */
function playJingle(id: string): void {
  if (!unlocked || musicVolume === 0 || muted) return;
  const url = registry.get(`music/${id}`);
  if (!url || typeof Audio === 'undefined') return;
  const a = new Audio(url);
  a.volume = musicVolume;
  void a.play().catch(() => undefined);
}

export function setMusicVolume(v: number): void {
  musicVolume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(K_MUSIC, String(musicVolume));
  } catch {
    /* quota / navigation privée : le volume n'est jamais critique */
  }
  appStore.setState({ musicVolume });
  applyMusic();
}

export function setSfxVolume(v: number): void {
  sfxVolume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(K_SFX, String(sfxVolume));
  } catch {
    /* ignore */
  }
  appStore.setState({ sfxVolume });
}

/** Fixe le mute rapide (I8) : coupe/rétablit musique + SFX, persisté. */
export function setMuted(v: boolean): void {
  if (muted === v) return;
  muted = v;
  try {
    localStorage.setItem(K_MUTED, muted ? '1' : '0');
  } catch {
    /* quota / navigation privée : le mute n'est jamais critique */
  }
  appStore.setState({ audioMuted: muted });
  applyMusic();
}

/** Bascule le mute rapide (bouton haut-parleur de la TurnBar). */
export function toggleMute(): void {
  setMuted(!muted);
}

/** Contexte de résolution d'un SFX (injecté ⇒ `sfxIdForEvent` reste pur/testable). */
export interface SfxContext {
  humanId: string;
  townOwner: (townId: string) => string | null | undefined;
  heroPlayer: (heroId: string) => string | null | undefined;
}

/**
 * Effet ponctuel associé à un événement moteur (`null` = aucun) — **pur**, gardé
 * au joueur humain. Les accomplissements (construction/recrutement/montée de
 * niveau/amélioration) réutilisent `ui-confirm` (Lot 9b, aucun asset dédié requis).
 */
export function sfxIdForEvent(event: AppEvent, ctx: SfxContext): string | null {
  const { humanId: human } = ctx;
  switch (event.type) {
    case 'StackAttacked':
      return event.ranged ? 'combat-shoot' : 'combat-hit';
    case 'StackDied':
      return 'combat-death';
    case 'SpellCast':
      return 'combat-spell';
    case 'TurnEnded':
      return event.playerId === human ? 'end-turn' : null;
    case 'MoveStepped':
      return ctx.heroPlayer(event.heroId) === human ? 'map-step' : null;
    case 'ResourcePicked':
    case 'TreasureTaken':
    case 'ArtifactPicked':
      return event.playerId === human ? 'map-pickup' : null;
    // Lot 9b : retour sonore des accomplissements (réutilise `ui-confirm`).
    case 'TownBuilt':
    case 'UnitsRecruited':
    case 'UnitsUpgraded':
      return ctx.townOwner(event.townId) === human ? 'ui-confirm' : null;
    case 'DwellingRecruited':
    case 'HeroRecruited':
      return event.playerId === human ? 'ui-confirm' : null;
    case 'HeroLevelUp':
      return ctx.heroPlayer(event.heroId) === human ? 'ui-confirm' : null;
    default:
      return null;
  }
}

/** Événement moteur → effet ponctuel (branche `sfxIdForEvent` sur l'état courant). */
function sfxForEvent(event: AppEvent): void {
  const game = appStore.getState().game;
  const id = sfxIdForEvent(event, {
    humanId: humanId(game),
    townOwner: (townId) => game.towns.find((t) => t.id === townId)?.ownerPlayerId,
    heroPlayer: (heroId) => game.heroes.find((h) => h.id === heroId)?.playerId,
  });
  if (id) playSfx(id);
}

/**
 * Branche l'audio : déblocage à la 1ʳᵉ interaction, musique par contexte (abonné
 * au store), SFX par événement (abonné au bus). Idempotent au bootstrap.
 */
export function initAudio(): void {
  appStore.setState({ musicVolume, sfxVolume, audioMuted: muted });

  const unlock = (): void => {
    if (unlocked) return;
    unlocked = true;
    applyMusic();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    // Retour tactile : un tap discret à l'appui d'un bouton d'UI (jamais sur le
    // canvas de jeu — les taps carte/combat ont déjà leurs propres SFX).
    window.addEventListener('pointerdown', (e) => {
      const el = e.target as Element | null;
      if (el?.closest('button, [role="button"]')) playSfx('ui-tap');
    });
  }

  appStore.subscribe(() => {
    const want = musicContextKey();
    if (want !== currentContext) {
      currentContext = want;
      applyMusic();
    }
  });

  eventBus.on((event) => {
    sfxForEvent(event);
    // Jingle de fin de partie : victoire/défaite selon le camp du joueur humain.
    if (event.type === 'GameEnded') {
      playJingle(event.status === 'won' ? 'victory' : 'defeat');
    }
  });
}
