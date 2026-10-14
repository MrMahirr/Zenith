import { buildEndpoints } from './endpoints';

/** Uygulama genelinde kullanılan adresler (tek kaynak). */
export const { backendUrl: BACKEND_URL, apiUrl: API_URL, streamUrl: STREAM_URL } =
  buildEndpoints(window.location, import.meta.env);
