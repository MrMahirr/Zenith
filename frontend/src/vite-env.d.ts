/// <reference types="vite/client" />

/** Build zamanında verilebilen isteğe bağlı adres ayarları (bkz. config/endpoints.ts). */
interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_BACKEND_PORT?: string;
  readonly VITE_STREAM_URL?: string;
  readonly VITE_STREAM_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
