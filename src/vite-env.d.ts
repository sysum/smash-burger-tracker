/// <reference types="vite/client" />

/**
 * Typed build-time configuration.
 *
 * `vite/client` types `import.meta.env` with an index signature, so without
 * these declarations a typo in a variable name is `any` rather than an error.
 * Both are optional: the app runs against IndexedDB when they are absent.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
