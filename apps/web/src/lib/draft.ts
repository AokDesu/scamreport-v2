/**
 * Report drafts survive a session expiry: fields and evidence files are kept in IndexedDB on this
 * device, keyed by the signed-in user's ID so another account never sees them. Once the report is
 * created the draft keeps its ID and the files still to upload, so a retry attaches them to the same
 * report. A deliberate sign-out or a fully completed submit deletes the draft.
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
  sent?: { reportId: string; attached: number };
  step?: 'details' | 'consent';
};

const database = 'scamreport';
const store = 'drafts';

export class DraftStorageError extends Error {
  constructor() { super('Draft storage is unavailable.'); }
}

let connection: Promise<IDBDatabase> | undefined;
let current: IDBDatabase | undefined;
/** Drops a connection that closed, was invalidated or threw, so the next call opens a fresh one. */
function forget(db: IDBDatabase) {
  if (current === db) { connection = undefined; current = undefined; }
  db.close();
}
function open(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new DraftStorageError());
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => {
      const db = request.result;
      current = db;
      db.onclose = db.onversionchange = () => forget(db);
      resolve(db);
    };
    request.onerror = () => reject(new DraftStorageError());
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}
async function run<T>(mode: IDBTransactionMode, action: (objects: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = db.transaction(store, mode); }
      catch (error) { forget(db); throw error; }
      const request = action(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = transaction.onerror = () => reject(new DraftStorageError());
    });
  } catch { throw new DraftStorageError(); }
}

export const drafts = {
  load: (userId: string) => run<Draft | undefined>('readonly', objects => objects.get(userId)),
  save: (userId: string, draft: Draft) => run('readwrite', objects => objects.put(draft, userId)),
  remove: (userId: string) => run('readwrite', objects => objects.delete(userId)),
};
