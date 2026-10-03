# MomentalConsole

Google Search Console dashboard: website groups, aggregate charts, individual site cards, period comparison, custom date ranges, device/search-type filters, detailed query/page/country/device reports, CSV export.

Site: https://oleksiiholovanov.github.io/momentsalconsole/

## Google connection

Public OAuth Client ID is configured in `config.js`. No Client Secret is needed or included. Enable Google Search Console API for its Google Cloud project and add `https://oleksiiholovanov.github.io` to Authorized JavaScript origins. Redirect URIs are not used by the GIS popup token flow.

While the OAuth application is in Testing, add every allowed Gmail account in Google Auth Platform → Audience → Test users. For broad access use Production and complete any verification Google requires. Users need access to verified Search Console properties.

Scopes: `openid email profile https://www.googleapis.com/auth/webmasters.readonly`. Google userinfo identifies each user by stable `sub`; workspaces are namespaced by this identifier. The email shown in the account selector comes from Google, not from a user-entered identifier.

## Multiple users and accounts

Each user signs in with Google and sees the Search Console properties available to that account. Several accounts can be connected in one browser tab and switched through the top bar. Each has separate groups and assignments; switching does not combine portfolios. Leaving an account clears its in-memory token and statistics, but keeps its local group configuration. Login hints are only a convenience; workspace identity always comes from Google's userinfo response.

OAuth tokens and account profiles are saved in sessionStorage for this browser tab, so a page reload restores the selected account until its Google token expires. Logout removes its saved credentials. Site lists and statistics are fetched again after reload. Tokens are never stored in localStorage or Git. Groups and assignments persist in this browser's localStorage per Google user, with a separate demo workspace. This is browser-local separation, not a server-backed multi-tenant system: local device users can inspect localStorage. There is no cross-device group sync or shared workspace. API access is enforced by Google. GitHub Pages is static hosting and does not provide a user database or backend.

Old asynchronous responses cannot apply after switching or logout. Dashboard requests use the captured account token and are aborted on workspace changes.

## Running and checking

No build or dependencies are required. Run `python3 -m http.server 8080` in this directory. For local OAuth, add `http://localhost:8080` to Google Authorized JavaScript origins.

Run `npm test` and `npm run check`. Tests simulate Google responses and cover account separation, login hints, token expiry, logout, and stale-response isolation. Real Google consent and live GSC requests require user interaction and enabled Google APIs.

GitHub Pages publishes the root of `main`. `.nojekyll` preserves the static files. Relative asset URLs work under `/momentsalconsole/`.

## Data and scope

CTR uses total clicks / total impressions. Average position is weighted by impressions. The date range excludes the latest three days for GSC reporting latency. Detail queries fetch up to 50,000 rows; Google may return only top rows. Failed sites are listed and a warning marks partial aggregate results.

This implements the requested GSC portfolio dashboard, not all SEOGets features. GA4, indexing monitoring, scheduled emails, content-change tracking and shared client portals are not implemented.

Inside each group, use “Add sites” to choose its member sites. Creating a group opens the same picker. A site belongs to one group; assigning it to another moves it. The previous comparison period always has the same length as the selected range.

Before publishing changed assets, run `npm run version-assets`. The HTML uses content hashes in asset URLs to prevent old JavaScript from running against a newer DOM. The remembered account identity stays selected if a Google token needs renewal; the app does not silently switch a signed-in user to demo data. Version r3 also exposes site membership controls in the group management dialog and beside each sidebar group.

Charts support concurrent clicks, impressions, CTR and position series. Main metric cards toggle portfolio/group series; each site has its own toggles. Each series has its own scale, and hover/tap/arrow-key tooltips show exact daily values and the corresponding previous-period date. Choices persist per Google workspace.

The “All” search tab combines web, image, video, news, Discover and Google News using separate API requests. Clicks and impressions are summed; CTR is recalculated; position is weighted by impressions only where Google supplies position (Discover and Google News have no position). Query detail omits Discover/Google News because those sources do not expose query dimensions, and the report explicitly notes that limitation.

Dashboard loading queries the combined current-plus-comparison interval once per source and splits rows by their actual Google dates. Date responses are cached in memory for five minutes per account, property, search type and device filter; narrower date windows reuse cached coverage. “Refresh” clears the account cache and reloads. Cache is discarded on account removal and page reload. Results are rendered progressively with a partial-summary indicator, then marked complete. Previous-period detail lists the exact properties and dates contributing clicks. Date responses outside the requested range are rejected.
