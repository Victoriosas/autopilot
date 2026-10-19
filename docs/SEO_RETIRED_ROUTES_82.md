# SEO retired routes (#82)

Current Vercel SPA fallback rewrites every non-API path to `/index.html`, potentially returning HTTP 200 for removed pages.

## Required verification before changing routing

- Confirm `/servicios` is the correct canonical equivalent for `/tratamientos` before using a 301 redirect.
- Confirm `/tienda` and `/checkout` are definitively retired before returning 410. Do not use redirects that expose commerce.
- Test GET and HEAD on production and preview, including trailing slashes, query strings, and deep links.
- Verify homepage, service details, contact, sitemap and robots remain correct.
- Add an HTTP integration test asserting status codes from the Vercel routing layer. Client-side React 404 content does not set HTTP status.
- Keep `/api/*` rewrite and security headers intact.

No production change authorized; implement only after confirming canonical routes and routing semantics. Avoid blindly adding a Vercel redirect to a nonexistent destination.
