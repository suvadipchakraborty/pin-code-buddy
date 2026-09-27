/**
 * PIN Code Buddy — Cloudflare Worker
 *
 * The app itself is fully static (HTML/CSS/JS in /public) and the PIN
 * lookup calls api.postalpincode.in directly from the browser, so this
 * Worker's only job is to serve those static files and attach a couple
 * of sane headers (caching for hashed/static assets, a light security
 * header set, and a fallback so deep links still resolve to index.html).
 */

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
};

// Cache static, rarely-changing files aggressively; keep HTML fresh.
function cacheHeaderFor(pathname) {
  if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(pathname)) {
    return "public, max-age=604800, immutable"; // 7 days
  }
  if (/\.(css|js)$/i.test(pathname)) {
    return "public, max-age=3600"; // 1 hour
  }
  if (pathname.endsWith(".webmanifest") || pathname === "/sw.js") {
    return "public, max-age=0, must-revalidate";
  }
  return "public, max-age=0, must-revalidate"; // index.html and friends
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    let response = await env.ASSETS.fetch(request);

    // Static asset handler falls back to a 404. Serve the SPA shell for
    // any unknown, non-file path so client-side routing (tab deep links
    // like /?tab=about) still resolves nicely.
    if (response.status === 404 && !url.pathname.includes(".")) {
      response = await env.ASSETS.fetch(new URL("/index.html", url), request);
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(key, value);
    }
    headers.set("Cache-Control", cacheHeaderFor(url.pathname));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
