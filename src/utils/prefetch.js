// Tiny in-memory prefetch cache for builder data.
// Dashboard warms it on resume-card hover so opening the builder is instant.
const cache = new Map(); // key -> { promise, at }
const TTL_MS = 30000;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
});

// Returns a promise for the data. Fresh cache entries are reused; expired
// ones are refetched. Failed requests are evicted so the next call retries.
export function getOrFetch(key, url) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < TTL_MS) return entry.promise;

  const promise = fetch(url, { headers: authHeaders() }).then((res) => {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  });
  promise.catch(() => cache.delete(key));

  cache.set(key, { promise, at: Date.now() });
  return promise;
}

// Warm everything the builder needs. Safe to call repeatedly.
export function prefetchBuilderData() {
  getOrFetch('resumes', '/api/resumes');
  getOrFetch('blocks', '/api/blocks');
  getOrFetch('jobtypes', '/api/user/jobtypes');
}

// Drop cached entries (e.g., after the dashboard refreshes its own data).
export function invalidatePrefetch() {
  cache.clear();
}
