/**
 * Report drafts survive a session expiry: fields and evidence files are kept in IndexedDB on this
 * device, keyed by the signed-in user's ID so another account never sees them. A deliberate sign-out
 * or a successful submit deletes the draft.
 */
export type Draft = {
  scam_type?: string;
  channel?: string;
  amount?: string;
  no_loss?: boolean;
  description?: string;
  organization_id?: string;
  consent?: 'yes' | 'no';
  contact_email?: string;
  contact_phone?: string;
  files?: File[];
  step?: 'details' | 'consent';
};

const database = 'scamreport';
const store = 'drafts';

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  const { promise, resolve } = Promise.withResolvers<IDBDatabase | null>();
  const request = indexedDB.open(database, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(store);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
  return promise;
}
async function run<T>(mode: IDBTransactionMode, action: (objects: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  const { promise, resolve } = Promise.withResolvers<T | undefined>();
  const request = action(db.transaction(store, mode).objectStore(store));
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(undefined);
  return promise;
}

export const drafts = {
  load: (userId: string) => run<Draft | undefined>('readonly', objects => objects.get(userId)),
  save: (userId: string, draft: Draft) => run('readwrite', objects => objects.put(draft, userId)),
  remove: (userId: string) => run('readwrite', objects => objects.delete(userId)),
};
