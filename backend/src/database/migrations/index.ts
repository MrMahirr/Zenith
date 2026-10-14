import { InitialSchema1760000000000 } from './1760000000000-initial-schema';
import { AppSettings1760000001000 } from './1760000001000-app-settings';

/** Sırayla uygulanacak migration'lar. Yeni migration'ı listenin sonuna ekleyin. */
export const MIGRATIONS = [InitialSchema1760000000000, AppSettings1760000001000];
