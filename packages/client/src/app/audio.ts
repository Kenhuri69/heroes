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
  if (!url || musicVolume === 0 || !unlocked) {
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
  if (!unlocked || sfxVolume === 0) return;
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
  if (!unlocked || musicVolume === 0) return;
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

/** Événement moteur → effet ponctuel. Gardé au joueur humain hors combat. */
function sfxForEvent(event: AppEvent): void {
  const game = appStore.getState().game;
  const human = humanId(game);
  switch (event.type) {
    case 'StackAttacked':
      playSfx('combat-hit');
      return;
    case 'StackDied':
      playSfx('combat-death');
      return;
    case 'SpellCast':
      playSfx('combat-spell');
      return;
    case 'TurnEnded':
      if (event.playerId === human) playSfx('end-turn');
      return;
    case 'MoveStepped': {
      const hero = game.heroes.find((h) => h.id === event.heroId);
      if (hero?.playerId === human) playSfx('map-step');
      return;
    }
    case 'ResourcePicked':
    case 'TreasureTaken':
    case 'ArtifactPicked':
      if (event.playerId === human) playSfx('map-pickup');
      return;
    default:
      return;
  }
}

/**
 * Branche l'audio : déblocage à la 1ʳᵉ interaction, musique par contexte (abonné
 * au store), SFX par événement (abonné au bus). Idempotent au bootstrap.
 */
export function initAudio(): void {
  appStore.setState({ musicVolume, sfxVolume });

  const unlock = (): void => {
    if (unlocked) return;
    unlocked = true;
    applyMusic();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
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
