-- Schéma D1 (Cloudflare) du backend Heroes — doc 07 §5, doc 15 (Live 7.1).
-- Source de vérité : ce fichier. Appliqué à la base D1 `heroes` (wrangler d1
-- execute heroes --file=server/schema.sql). Timestamps = epoch millisecondes.

-- Comptes (magic-link) — un profil par utilisateur authentifié.
CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY,          -- uuid
  handle     TEXT UNIQUE NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

-- Jetons magic-link : à usage unique, expirants (auth sans mot de passe).
CREATE TABLE IF NOT EXISTS auth_tokens (
  token      TEXT PRIMARY KEY,          -- aléatoire (envoyé par e-mail)
  email      TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

-- Sessions émises après vérification du magic-link.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,          -- jeton de session (cookie / bearer)
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  expires_at INTEGER NOT NULL
);

-- Sauvegardes cloud : un slot par joueur — état sérialisé du moteur
-- (serializeState) + version de forme (CURRENT_SAVE_VERSION).
CREATE TABLE IF NOT EXISTS saves (
  profile_id   TEXT NOT NULL REFERENCES profiles(id),
  slot         TEXT NOT NULL,
  save_version INTEGER NOT NULL,
  state        TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (profile_id, slot)
);

-- Parties asynchrones : graine + setup (StartGame sérialisé) + statut.
CREATE TABLE IF NOT EXISTS matches (
  id         TEXT PRIMARY KEY,
  seed       INTEGER NOT NULL,
  setup      TEXT NOT NULL,             -- commande StartGame (JSON)
  status     TEXT NOT NULL DEFAULT 'open',   -- open | active | finished
  created_by TEXT NOT NULL REFERENCES profiles(id),
  created_at INTEGER NOT NULL
);

-- Sièges d'une partie (ordre = ordre de tour du moteur). profile_id NULL = libre.
CREATE TABLE IF NOT EXISTS match_players (
  match_id   TEXT NOT NULL REFERENCES matches(id),
  seat       INTEGER NOT NULL,
  profile_id TEXT REFERENCES profiles(id),
  player_id  TEXT NOT NULL,             -- id moteur ('player-1'…)
  PRIMARY KEY (match_id, seat)
);

-- Journal APPEND-ONLY des tours : une ligne = un lot de commandes d'un joueur.
-- Le serveur valide chaque lot par re-simulation (engine/net appendTurn) avant
-- insertion — seq contigu, tour du bon joueur, commandes légales.
CREATE TABLE IF NOT EXISTS moves (
  match_id   TEXT NOT NULL REFERENCES matches(id),
  seq        INTEGER NOT NULL,          -- 0,1,2… contigu
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  commands   TEXT NOT NULL,             -- Command[] (JSON)
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_moves_match     ON moves(match_id, seq);
CREATE INDEX IF NOT EXISTS idx_matches_status  ON matches(status);
CREATE INDEX IF NOT EXISTS idx_match_players_p ON match_players(profile_id);
