/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du backend Cloudflare (Live 7.3) — absente ⇒ mode hors-ligne. */
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
