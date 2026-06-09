# Content Finder - SitecoreAI Marketplace App

Content Finder is a custom **SitecoreAI Marketplace** app (Full Screen extension
point) that gives content authors a fast, dedicated way to **find content items**
across a SitecoreAI (XM Cloud) environment.

Authors type a query, optionally scope it to specific fields, templates, or tags,
and get back a results list that **highlights why each result matched**. From each
result they can jump straight into editing the item in **Pages** (Edit mode) or
**Content** mode (a.k.a. Explorer), or copy the item's ID / path.

Search runs against the **Authoring & Management GraphQL `search` query**
(`sitecore_master_index`) - no separate search index or content delivery layer is
required.

## Features

- **Full-text search** across an item's text fields (substring match, so `simon`
  finds `simons-sai-playground`).
- **Field-scoped search** - restrict the query to chosen fields.
- **Filters** - content-type (template) filter and tag filter, with tag
  match-ALL / match-ANY.
- **Match highlighting** - each result shows the matched snippet and which field
  it matched in.
- **Deep links** - *Open in Pages* (only for items with presentation/layout),
  *Open in Content/Explorer* (any item), and *Copy ID / Copy path*.
- **Scope-driven config** - the admin only configures the search root(s); the
  available templates and searchable fields are derived from what actually exists
  in that scope.

## How it works

```
SitecoreAI (Full Screen iframe)
        │  postMessage (Marketplace Client SDK)
        ▼
Next.js app
  ├─ MarketplaceProvider → application.context (Context ID, organization)
  ├─ ConfigProvider → reads the "Content Finder Config" item, derives scope, loads tags
  └─ Search UI → client.mutate("xmc.authoring.graphql", …) → Authoring search
```

The app runs **entirely client-side** inside the Full Screen iframe and talks to
SitecoreAI through the Marketplace Client SDK. There is no custom server layer or
custom authentication - the SDK handles auth via the host.

**Tech stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 ·
Blok/shadcn UI · `@sitecore-marketplace-sdk/client` + `/xmc`.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
npm run typecheck
```

The app only renders meaningfully **inside** the SitecoreAI Full Screen extension
point (it needs the Marketplace handshake to obtain a Context ID). To develop
against a live environment, point your app's deployment URL in App Studio at your
local/dev URL and open it from within SitecoreAI.

Set the config-item GUID via an environment variable (see
[Required Sitecore configuration](#required-sitecore-configuration)):

```bash
# .env.local
NEXT_PUBLIC_CONTENT_FINDER_CONFIG_ID={8C5...your-config-item-guid...}
```

## Installing in SitecoreAI

Done once, by an admin, in the Cloud Portal **App Studio**:

1. **App Studio → Create app → Custom.**
2. **Extension point: Full Screen** (in SitecoreAI). Set a route URL (e.g. `/`).
3. **Deployment URL:** the app's hosted URL 
4. **API access:** enable **SitecoreAI APIs** (Authoring & Management GraphQL) so
   the app can run the `search` query.
5. **Permissions:** enable **pop-ups** (to open Pages / Content in a new tab) and
   **clipboard** (to copy item ID / path).
6. **Install** the app into the target environment.

> The app is hosted on Netlify; `netlify.toml` configures the official Next.js
> runtime. After the first deploy, set the production URL as the deployment URL in
> App Studio.

## Required Sitecore configuration

The app reads its settings from a single admin-maintained **Content Finder Config**
item in the `master` database. Everything degrades gracefully: if the item or any
individual field is missing, sensible defaults apply (scope = `/sitecore/content`,
a default searchable-field list, tag field `Tags`).

### 1. Create the Content Finder Config template + item

Define a template (e.g. `Content Finder Config`) with these fields, then create one
item from it:

| Field         | Type             | Purpose                                                                 |
| ------------- | ---------------- | ----------------------------------------------------------------------- |
| `Search Roots`| Treelist         | Root item(s) to scope search to. The search covers all descendants. Multiple roots are OR-combined. |
| `Tag Field`   | Single-Line Text | Name of the multilist tag field on content items. Defaults to `Tags`.   |
| `Tags Root`   | Droptree         | Root item of the tag taxonomy - its direct children populate the tag filter. |
| `Tenant Name` | Single-Line Text | XM Cloud tenant-name slug, used in deep links (see below).              |

### 2. Point the app at the config item

Copy the config item's GUID and expose it to the app as the
`NEXT_PUBLIC_CONTENT_FINDER_CONFIG_ID` environment variable (in `.env.local` for
local dev, and in the hosting platform site's environment variables for production). If this
is unset, the app runs on defaults and skips the config read.

### 3. Set up the tag taxonomy (optional)

Tags are **plain Sitecore items** - they need no special fields. Create a folder to
act as the **Tags Root**, then add one item per tag as a **direct child** of it. The
app uses each child item's **name** as the filter label and its **GUID** as the
value. (Only the first level of children is read; tags nested deeper won't appear.)

To tag content, add the multilist field named in `Tag Field` (default `Tags`) to
your content templates and reference the tag items from it.

### 4. Set the Tenant Name for deep links

The *Open in Pages* and *Open in Content* deep links require the **XM Cloud
tenant-name slug** to resolve directly to the target item. This slug is **not**
available from the Marketplace app context, so the admin must supply it on the
`Tenant Name` field.

It has the form `<org>-<project>-<environment>` (each with a hash suffix) - the same
slug used in Experience Edge URLs

If `Tenant Name` is left empty, deep links are still built but omit the slug; Pages
then shows a tenant picker and opens the default Home item instead of the target.

## Defaults & graceful degradation

| Setting           | Default                                                        |
| ----------------- | ------------------------------------------------------------- |
| Search root       | `/sitecore/content` (`0de95ae441ab4d019eb067441b7c2450`)       |
| Searchable fields | `Title`, `Text`, `Content`, `Description`, `Summary`           |
| Tag field         | `Tags`                                                         |
| Search index      | `sitecore_master_index`                                       |
| Tenant name       | none (deep links omit it - tenant picker appears)             |

Templates and the full searchable-field list are **derived from the configured
scope** at runtime and cached for the session, so the content-type and field
filters reflect what actually lives under your search roots.
