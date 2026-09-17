import { afterEach, expect, it, vi } from 'vitest';
import { dmFetch, DM_ACCESS_LOST } from './dmFetch';
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it('refuses to send DM credentials to external destinations', async () => {
  const request = vi.spyOn(window, 'fetch');
  localStorage.setItem('dm_token', 'fixture');
  await expect(dmFetch('https://example.com/api/notes')).rejects.toThrow('local API');
  expect(request).not.toHaveBeenCalled();
});
it('does not invalidate a replacement session after an old request fails', async () => {
  localStorage.setItem('dm_token', 'old');
  vi.spyOn(window, 'fetch').mockImplementation(async () => {
    localStorage.setItem('dm_token', 'new');
    return new Response('{"code":"REST_DM_INVALID"}', { status: 401 });
  });
  const dispatch = vi.spyOn(window, 'dispatchEvent');
  await dmFetch('/api/recaps');
  expect(dispatch).not.toHaveBeenCalled();
});
it('reports a rejected current session', async () => {
  localStorage.setItem('dm_token', 'fixture');
  vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{"code":"REST_DM_REQUIRED"}', { status: 401 }));
  const listener = vi.fn(); window.addEventListener(DM_ACCESS_LOST, listener);
  await dmFetch('/api/recaps');
  expect(listener).toHaveBeenCalledOnce();
  window.removeEventListener(DM_ACCESS_LOST, listener);
});
