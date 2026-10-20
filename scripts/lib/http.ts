const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastCall = 0;

class FatalError extends Error {}

export async function fetchJson<T>(url: string, init: RequestInit = {}, { spacingMs = 1000, retries = 8 } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + spacingMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();

    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": "tierbase-sync/1.0", ...init.headers } });
      const body = await res.json().catch(() => null);
      // Arctic Shift reports overload as a 200/422 with an `error` field
      if (res.ok && !body?.error) return body as T;
      const retryAfter = Number(res.headers.get("retry-after"));
      const transient = res.status === 429 || res.status >= 500 || /timeout|slow down/i.test(body?.error ?? "");
      if (!transient || attempt >= retries) throw new FatalError(`${res.status} ${body?.error ?? res.statusText} for ${url}`);
      // Back off for real when asked to slow down: 5s, 10s, 20s… capped at 5 minutes
      await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(5000 * 2 ** attempt, 300_000));
    } catch (error) {
      if (error instanceof FatalError || attempt >= retries) throw error;
      await sleep(Math.min(5000 * 2 ** attempt, 300_000));
    }
  }
}
