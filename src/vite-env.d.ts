/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SISENSE_URL: string;
  readonly VITE_SISENSE_TOKEN: string;
  readonly VITE_SISENSE_DATASOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}