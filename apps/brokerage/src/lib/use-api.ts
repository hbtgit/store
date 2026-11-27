import { useAppBridge, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import { useCallback, useEffect, useState } from "react";

/** JSON fetch against this app's API, authenticated as the dashboard user. */
export function useApi() {
  const fetchWithAuth = useAuthenticatedFetch();
  return useCallback(
    async <T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      const res = await fetchWithAuth(path, {
        method: init?.method ?? "GET",
        headers: { "content-type": "application/json" },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const data = res.status === 204 ? null : await res.json();
      if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
      return data as T;
    },
    [fetchWithAuth]
  );
}

/** Loads a resource once the dashboard handshake is done; `reload` refetches it. */
export function useResource<T>(path: string | null) {
  const api = useApi();
  const { appBridgeState } = useAppBridge();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path || !appBridgeState?.ready) return;
    let cancelled = false;
    api<T>(path)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, path, appBridgeState?.ready, version]);

  return { data, error, reload: () => setVersion((v) => v + 1) };
}
