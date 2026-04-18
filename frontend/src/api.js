import { API_BASE_URL, REALTIME_BASE_URL } from './config';

export function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function getRealtimeBaseUrl() {
  if (REALTIME_BASE_URL) {
    return REALTIME_BASE_URL;
  }

  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    // In dev, CRA runs on :3000 while the backend runs on :4000.
    // Socket.IO does not use CRA's proxy, so point directly at the backend.
    if (window.location.port === '3000') {
      return 'http://localhost:4000';
    }

    return window.location.origin;
  }

  return undefined;
}

async function readJsonOrThrow(response) {
  const contentType = response.headers?.get?.('content-type') || '';

  // Many mocks and some servers omit content-type; prefer JSON when a json() method exists.
  if (typeof response.json === 'function' && (!contentType || contentType.includes('application/json'))) {
    try {
      return await response.json();
    } catch {
      // Fall through and attempt text parsing for better error messages.
    }
  }

  const text = await response.text().catch(() => '');

  // If we got HTML, this is almost certainly the frontend dev server responding with index.html.
  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.includes('<div id="root">')) {
    const error = new Error(
      'Unexpected HTML response (got the app shell instead of JSON). Check API base URL / proxy configuration.'
    );
    error.name = 'UnexpectedHtmlResponse';
    error.html = text.slice(0, 300);
    throw error;
  }

  const error = new Error(`Unexpected non-JSON response (content-type: ${contentType || 'unknown'}).`);
  error.name = 'UnexpectedNonJsonResponse';
  throw error;
}

export async function apiJson(path, { token, headers = {}, ...options } = {}) {
  const requestHeaders = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  };

  const attemptFetch = async (url) => {
    const response = await fetch(url, {
      ...options,
      headers: requestHeaders
    });

    const data = await readJsonOrThrow(response);
    return { response, data };
  };

  let result;
  try {
    result = await attemptFetch(buildApiUrl(path));
  } catch (err) {
    // Self-heal in dev if someone configured REACT_APP_API_URL to the frontend origin (e.g. :3000),
    // which would return index.html and break JSON parsing.
    if (err?.name === 'UnexpectedHtmlResponse' && API_BASE_URL && typeof window !== 'undefined') {
      result = await attemptFetch(path);
    } else {
      throw err;
    }
  }

  const { response, data } = result;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed with status ${response.status}.`);
  }

  return data;
}
