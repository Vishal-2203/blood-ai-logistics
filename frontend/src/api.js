import { API_BASE_URL } from './config';

export function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function getRealtimeBaseUrl() {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return undefined;
}

export async function apiJson(path, { token, headers = {}, ...options } = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  const data = typeof response.json === 'function' ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed with status ${response.status}.`);
  }

  return data;
}
