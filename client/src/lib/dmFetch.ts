export function dmFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = localStorage.getItem('dm_token');
  if (token) headers.set('X-DM-Token', token);
  return fetch(input, { ...init, headers });
}
