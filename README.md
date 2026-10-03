# MomentalConsole

Google Search Console dashboard: website groups, aggregate charts, individual site cards, period comparison, country/device/search-type filters, detailed query/page/country/device reports, CSV export.

Site: https://oleksiiholovanov.github.io/momentsalconsole/

## Google connection

Public OAuth Client ID is configured in `config.js`. No Client Secret is needed or included. Enable Google Search Console API for its Google Cloud project and add `https://oleksiiholovanov.github.io` to Authorized JavaScript origins. Redirect URIs are not used by the GIS popup token flow.

While the OAuth application is in Testing, add every allowed Gmail account in Google Auth Platform → Audience → Test users. For broad access use Production and complete any verification Google requires. Users need access to verified Search Console properties.

Scopes: `openid email profile https://www.googleapis.com/auth/webmasters.readonly`. Google userinfo identifies each user by stable `sub`; workspaces are namespaced by this identifier. The email shown in the account selector comes from Google, not from a user-entered identifier.

## Multiple users and accounts

Each user signs in with Google and sees the Search Console properties available to that account. Several accounts can be connected in one browser tab and switched through the top bar. Each has separate groups and assignments; switching does not combine portfolios. Leaving an account clears its in-memory token and statistics, but keeps its local group configuration. Login hints are only a convenience; workspace identity always comes from Google's userinfo response.

Tokens, profiles, site lists and statistics are kept in memory only. Reloading requires signing in again. Groups and assignments persist in this browser's localStorage per Google user, with a separate demo workspace. This is browser-local separation, not a server-backed multi-tenant system: local device users can inspect localStorage. There is no cross-device group sync or shared workspace. API access is enforced by Google. GitHub Pages is static hosting and does not provide a user database or backend.

Old asynchronous responses cannot apply after switching or logout. Dashboard requests use the captured account token and are aborted on workspace changes.

## Running and checking

No build or dependencies are required. Run `python3 -m http.server 8080` in this directory. For local OAuth, add `http://localhost:8080` to Google Authorized JavaScript origins.

Run `npm test` and `npm run check`. Tests simulate Google responses and cover account separation, login hints, token expiry, logout, and stale-response isolation. Real Google consent and live GSC requests require user interaction and enabled Google APIs.

GitHub Pages publishes the root of `main`. `.nojekyll` preserves the static files. Relative asset URLs work under `/momentsalconsole/`.

## Data and scope

CTR uses total clicks / total impressions. Average position is weighted by impressions. The date range excludes the latest three days for GSC reporting latency. Detail queries fetch up to 50,000 rows; Google may return only top rows. Failed sites are listed and a warning marks partial aggregate results.

This implements the requested GSC portfolio dashboard, not all SEOGets features. GA4, indexing monitoring, scheduled emails, content-change tracking and shared client portals are not implemented.
