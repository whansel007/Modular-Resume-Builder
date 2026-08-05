// Tiny in-memory prefetch cache for builder data.
// Dashboard warms it on resume-card hover so opening the builder is instant,
// and back-navigation to the dashboard reuses the same entries.
// The TTL is generous because every mutation (save/delete in dashboard or
// builder) invalidates the affected keys explicitly.
const cache = new Map(); // key -> { promise, at }
const TTL_MS = 5 * 60 * 1000;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
});

// Returns a promise for the data. Fresh cache entries are reused; expired
// ones are refetched. Failed requests are evicted so the next call retries.
export function getOrFetch(key, url) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < TTL_MS) return entry.promise;

  const promise = fetch(url, { headers: authHeaders() }).then((res) => {
    if (!res.ok) {
      const err = new Error(`Request failed (${res.status})`);
      err.status = res.status; // lets callers detect 401 session expiry
      throw err;
    }
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

// Drop one cached endpoint (e.g., after mutating that resource) or the
// whole cache when no key is given.
export function invalidatePrefetch(key) {
  if (key) cache.delete(key);
  else cache.clear();
}
