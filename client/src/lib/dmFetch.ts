import { withApiCredential } from './apiCredentialBoundary';
export const DM_ACCESS_LOST = 'arcane:dm-access-lost';

/** Attach the existing DM session only to this application's API. */
export async function dmFetch(path: string, init: RequestInit = {}) {
  if (!path.startsWith('/api/') || new URL(path, window.location.origin).origin !== window.location.origin) {
    throw new Error('DM requests must target the local API.');
  }
  const token = localStorage.getItem('dm_token');
  const response = await fetch(path, withApiCredential(path, init));
  if (token && (response.status === 401 || response.status === 403)) {
    const body = await response.clone().json().catch(() => null);
    if (typeof body?.code === 'string' && body.code.startsWith('REST_DM_') && localStorage.getItem('dm_token') === token) {
      window.dispatchEvent(new CustomEvent(DM_ACCESS_LOST, { detail: token }));
    }
  }
  return response;
}
