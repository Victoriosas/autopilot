/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __EDITORIAL_REVIEW__: boolean;

declare const __SERVICE_REVIEW__: boolean;
