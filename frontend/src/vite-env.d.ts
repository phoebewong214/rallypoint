/// <reference types="vite/client" />

declare module "*.css";

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_FALLBACK?: string;
}
