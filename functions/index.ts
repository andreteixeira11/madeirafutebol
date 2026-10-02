/**
 * Proxy server-side para o site madeirafutebol.com.
 *
 * O site não envia cabeçalhos CORS, por isso o preview web (browser) não
 * consegue ler as páginas de competição nem a API wp-json. Este Worker faz
 * fetch server-side e devolve as respostas com CORS aberto + cache de edge,
 * protegendo também o site de rajadas de pedidos vindos da app.
 */

const SITE_BASE = "https://www.madeirafutebol.com";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "text/html,application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
  });
}

/** Fetch com 1 retry para erros transitórios do site (500 sob rajadas). */
async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let i = 0; i < attempts; i++) {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(25000),
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    if (response.ok) return response;
    lastResponse = response;

    if (response.status >= 500 && i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  return lastResponse as Response;
}

/** Cache de edge por URL com TTL em segundos. */
async function cachedResponse(
  request: Request,
  ttlSeconds: number,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });

  try {
    const hit = await cache.match(cacheKey);
    if (hit) return withCors(hit);
  } catch {
    // cache indisponível — segue para o fetch
  }

  const response = await produce();

  if (response.ok) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
    const cacheable = new Response(response.clone().body, {
      status: response.status,
      headers,
    });
    try {
      await cache.put(cacheKey, cacheable);
    } catch {
      // falha ao cachear não deve quebrar a resposta
    }
  }

  return withCors(response);
}

const SLUG_PATTERN = /^[a-z0-9-]{2,120}$/;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    // GET /fpf/page?slug=<competition-slug> — página HTML de uma competição
    if (url.pathname === "/fpf/page") {
      const slug = (url.searchParams.get("slug") ?? "").toLowerCase();
      if (!SLUG_PATTERN.test(slug)) {
        return jsonResponse({ error: "invalid_slug" }, 400);
      }

      return cachedResponse(request, 30, async () => {
        const upstream = await fetchWithRetry(`${SITE_BASE}/competicoes/${slug}/`);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      });
    }

    // GET /fpf/teams?competition_id=<id> — equipas da API do site (com logos)
    if (url.pathname === "/fpf/teams") {
      const competitionId = url.searchParams.get("competition_id") ?? "";
      if (!/^\d{1,7}$/.test(competitionId)) {
        return jsonResponse({ error: "invalid_competition_id" }, 400);
      }

      return cachedResponse(request, 600, async () => {
        const upstream = await fetchWithRetry(
          `${SITE_BASE}/wp-json/mf/v3/teams?competition_id=${competitionId}`,
        );
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      });
    }

    // GET /fpf/competitions — lista de competições da API do site
    if (url.pathname === "/fpf/competitions") {
      return cachedResponse(request, 300, async () => {
        const upstream = await fetchWithRetry(`${SITE_BASE}/wp-json/mf/v3/competitions`);
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      });
    }

    return jsonResponse({ ok: true, service: "madeirafutebol-proxy" });
  },
};
