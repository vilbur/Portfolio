# Cloudflare configuration for the portfolio

The repository reduces repeat transfers and guarantees that source videos are not deployed. Cloudflare is still required to challenge abusive traffic before it reaches Firebase Hosting.

Replace `portfolio.example.com` below with the real public custom hostname.

## 1. Connect and proxy the custom domain

1. Add the custom domain in Firebase Hosting and use exactly the DNS records Firebase provides.
2. During Firebase ownership and TLS-certificate provisioning, keep the relevant Cloudflare DNS record **DNS only**.
3. After Firebase reports that the custom domain and certificate are active, change the record to **Proxied** (orange cloud).
4. Set Cloudflare **SSL/TLS encryption mode** to **Full (strict)** and enable **Always Use HTTPS**.

Do not replace Firebase's DNS target with a guessed hostname or IP. The `*.web.app` and `*.firebaseapp.com` hostnames remain functional and cannot be put behind this Cloudflare zone.

## 2. Bot and browser checks

- **Security > Settings > Bot traffic > Bot Fight Mode:** On.
- **Security > Settings > Browser Integrity Check:** On. It is normally on by default.
- **Security Level:** Medium as a starting point.
- Keep verified/known bots allowed. Do not challenge or rate-limit requests where `cf.client.bot` is true.
- Leave blanket **Block AI bots** off unless intentionally opting out of those crawlers. It is separate from protecting against abusive traffic.
- Do not enable Hotlink Protection initially; it can interfere with image search, social previews, and legitimate links to portfolio images.

Review **Security > Events** after enabling these settings. If Bot Fight Mode affects a legitimate integration, note that basic Bot Fight Mode cannot be skipped with a WAF rule; a more configurable bot product is needed for exceptions.

## 3. Cache Rules

Keep the default cache key, including the complete query string. The site uses `?v=<content-hash>` URLs so a new deployment gets a new cache entry.

Create these Cache Rules in this order:

### Rule 1 — Bypass portfolio HTML

Expression:

```text
(http.host eq "portfolio.example.com" and (http.request.uri.path eq "/" or http.request.uri.path.extension in {"html" "htm"}))
```

Action:

- Cache eligibility: **Bypass cache**

Do not add a broad Cache Everything rule for HTML. Firebase sends HTML with `Cache-Control: no-cache,max-age=0,must-revalidate`.

### Rule 2 — Cache versioned static assets

Expression:

```text
(http.host eq "portfolio.example.com" and http.request.uri.path.extension in {"jpg" "jpeg" "png" "webp" "gif" "avif" "svg" "ico" "woff" "woff2" "ttf" "otf" "eot" "css" "js" "mjs"})
```

Action:

- Cache eligibility: **Eligible for cache**
- Edge TTL: **Override origin — 1 year**
- Browser TTL: **Respect origin**
- Cache key / Query string: **Include all** (the default); never ignore the `v` parameter

After deployment, request one JPG, one GIF, one CSS file, and one JS file twice through the custom domain. Expect `CF-Cache-Status: HIT` on a repeat request once that edge is warm. HTML should remain `DYNAMIC` or `BYPASS`.

## 4. Rate limiting

Start conservatively and tune from Security Analytics rather than setting a low gallery-breaking threshold.

Suggested rule:

```text
(http.host eq "portfolio.example.com" and http.request.method in {"GET" "HEAD"} and not cf.client.bot)
```

Settings:

- Counting characteristic: **IP**
- Threshold: **300 requests per 60 seconds**
- Action: **Managed Challenge**
- Mitigation timeout: **10 minutes**

If the plan supports a Log action, run the rule in Log for 24–48 hours first. Raise the threshold if normal visitors, shared office/mobile IPs, or accessibility tools approach it. Prefer a managed challenge over an immediate block; only block patterns confirmed as abusive.

Optional WAF custom rule for plainly automated clients:

```text
(http.host eq "portfolio.example.com" and not cf.client.bot and (http.user_agent eq "" or lower(http.user_agent) contains "python-requests" or lower(http.user_agent) contains "scrapy" or lower(http.user_agent) contains "wget"))
```

Action: **Managed Challenge**. Omit this rule if command-line access to the public portfolio is desirable.

## 5. SEO and Firebase-origin limitation

- Do not challenge or rate-limit `cf.client.bot` verified crawlers. Test Googlebot and Bingbot in Cloudflare events after rollout.
- `robots.txt` allows the site and its gallery images to be indexed. Its disallow entries only describe development/source paths that are also absent from the deployment.
- Once the custom hostname is known, change the canonical URL and Open Graph URLs in `index.html` from the Firebase hostname to the Cloudflare-proxied custom hostname.
- Do not add a Firebase Hosting redirect from `*.web.app` to the custom domain in this static configuration. Firebase serves the same redirect rules on both hostnames, so a host-independent redirect can loop on the custom domain.
- Firebase Hosting cannot restrict its default hostname to Cloudflare IPs and cannot apply hostname-specific redirects in `firebase.json`. Anyone who knows the Firebase URL can bypass Cloudflare. Use the custom hostname everywhere public and monitor Firebase usage/budget alerts, but keep the default hostname functional for deployment and recovery.

Cloudflare protects only traffic that reaches the proxied custom hostname. It does not reduce requests sent directly to the Firebase-provided hostnames.
