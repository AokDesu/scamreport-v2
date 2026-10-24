import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function storage() {
  const transactions: Array<{ oncomplete?: () => void; onabort?: () => void; onerror?: () => void; objectStore: () => unknown }> = [];
  const requests: Array<{ result: unknown; onsuccess?: () => void }> = [];
  const db = {
    transaction: () => {
      const request = { result: undefined };
      requests.push(request);
      const transaction = { objectStore: () => ({ put: () => request, get: () => request, delete: () => request }) };
      transactions.push(transaction);
      return transaction;
    },
  };
  const open: { result: typeof db; onsuccess?: () => void; onerror?: () => void } = { result: db };
  vi.stubGlobal('indexedDB', { open: () => open });
  return { open, transactions, requests };
}

describe('device draft transaction boundary', () => {
  test('request success alone does not acknowledge a save; transaction completion does', async () => {
    const fake = storage();
    const { drafts } = await import('./draft');
    let completed = false;
    const saving = drafts.save('citizen', { description: 'latest submitted answers' }).then(() => { completed = true; });
    fake.open.onsuccess!();
    await vi.waitFor(() => expect(fake.transactions).toHaveLength(1));
    fake.requests[0]!.onsuccess?.();
    await Promise.resolve();
    expect(completed).toBe(false);
    fake.transactions[0]!.oncomplete!();
    await saving;
    expect(completed).toBe(true);
  });
  test('an abort after request success rejects the checkpoint', async () => {
    const fake = storage();
    const { drafts, DraftStorageError } = await import('./draft');
    const saving = drafts.save('citizen', { sent: { reportId: 'sent', attached: 0 } });
    const rejected = expect(saving).rejects.toBeInstanceOf(DraftStorageError);
    fake.open.onsuccess!();
    await vi.waitFor(() => expect(fake.transactions).toHaveLength(1));
    fake.requests[0]!.onsuccess?.();
    fake.transactions[0]!.onabort!();
    await rejected;
  });
  test('load and removal failures reject instead of pretending no draft exists', async () => {
    const fake = storage();
    const { drafts, DraftStorageError } = await import('./draft');
    const loading = drafts.load('citizen');
    const rejected = expect(loading).rejects.toBeInstanceOf(DraftStorageError);
    fake.open.onerror!();
    await rejected;
    const removing = drafts.remove('citizen');
    const removalRejected = expect(removing).rejects.toBeInstanceOf(DraftStorageError);
    fake.open.onsuccess!();
    await vi.waitFor(() => expect(fake.transactions).toHaveLength(1));
    fake.transactions[0]!.onerror!();
    await removalRejected;
  });
});
