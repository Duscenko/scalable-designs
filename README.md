# Escala Tokens

**Token generator.** A configurator for design token systems.

You define a palette, type scale, spacing, radius and the rest once. Escala derives the full scales, keeps light and dark in step, and ships the result as `tokens.json`, `variables.css` and a README — plus a [Figma plugin](https://github.com/Duscenko/escala-figma-plugin) that imports all of it as real Variables.

The point is **no bloat**: you export the tokens you actually chose, not a framework’s opinion of a design system. Everything on screen derives from one payload, so the preview, the export and what lands in Figma can’t disagree.

**Hosted instance:** [www.escalatokens.com](https://www.escalatokens.com) — that site runs this repo. Nothing is held back.

## What you get

| Destination | Output |
|---|---|
| Code | `tokens.json` · `variables.css` · generated README |
| Interchange | W3C Design Tokens (DTCG) JSON |
| Figma | Variables (primitives, semantics per theme, type, spacing, radius, component aliases) |
| Agents | Skill zip + live MCP at `/api/mcp` |

There are **no accounts**. The editor lives in the browser. Durable save is the GitHub repo you connect (`.escala/system.json` + the export). `/api/tokens` is only a live-sync cache so the plugin can poll.

The systems you build are yours — no licence or attribution requirement on the tokens.

## How the tokens work

Every value resolves down a chain. Nothing holds a copy of anything above it, so retinting one family repaints everything that references it.

1. **Primitives** — Radix’s model. Each family is a 1–12 scale where the step means a role, not a lightness. Tone 9 is your input hex, verbatim. Every family ships a light ramp and a dark twin. `accent-9` · `neutral-dark-3` · `error-11`
2. **Semantics** — named roles that point *at* a primitive tone, per theme. A theme stores which family fills each slot, never a hex of its own. `text-primary → neutral-12`
3. **Components** — created by the plugin in Figma: one variable per component property, aliasing its semantic role. `button/bg → action/primary → accent-9`

The semantic layer is projected as **Categorical** — a grouped DTCG tree. Contrast for text tones is solved against the page, targeting WCAG AA.

A sample of the *generated* README (an old default named DS.by.MD) lives in [`examples/generated-system/`](examples/generated-system/README.md).

## Figma plugin

Source: [Duscenko/escala-figma-plugin](https://github.com/Duscenko/escala-figma-plugin). Download the zip from the site or from [`public/escala-figma-plugin.zip`](public/escala-figma-plugin.zip).

1. Unzip the plugin.
2. Figma desktop → **Plugins → Development → Import plugin from manifest…**
3. Pick the unzipped `manifest.json`, then run **Escala DS**.
4. Import variables, styles, components, documentation — or use **Live Sync** against `https://www.escalatokens.com/api/tokens?project=<slug>`.

The plugin reads the same `tokens.json` this app exports. The plugin’s `code.ts` is the source of truth for the 58-component catalogue; this repo mirrors it.

## Run it locally

```bash
npm install     # postinstall builds the icon catalog; do not skip
npm run dev
```

`src/generated/untitled-icons.ts` is gitignored on purpose (Untitled UI: use in a product, do not redistribute). `predev` / `prebuild` regenerate it.

```bash
npm test
npm run build   # typechecks tests; a green `npm test` does not
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Use a published system from a product repo

The installer lives in this repo as `@escala/cli` (`npm run cli`). It is not on the public npm registry yet.

```bash
npm run cli -- skill --from <published-slug> --client cursor
npm run cli -- mcp init --client cursor --url https://escalatokens.com/api/mcp
```

The system must already be published (Escala → Figma → Sync). Unzip the AI assistant export by hand if it is not published yet.

## Architecture

| Need | File |
|---|---|
| Hard rules / where code lives | [AGENTS.md](AGENTS.md) |
| Frozen HTTP + schema | [docs/agent-native/CONTRACTS.md](docs/agent-native/CONTRACTS.md) |
| Token payload shape | [docs/agent-native/tokens.schema.json](docs/agent-native/tokens.schema.json) |
| MCP | [docs/agent-native/MCP.md](docs/agent-native/MCP.md) |

`src/lib/tokenGenerator.ts` emits the JSON. `api/tokens.ts` is the live-sync cache. `api/mcp.ts` is agent access. Do not invent a second token pipeline.

## Deploy your own

This is a Vite app hosted on Vercel. Publish and MCP need [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) on that project. After you change the public origin, point the plugin and the MCP snippet at *your* host — not `*.vercel.app` in user-facing copy. The public product URL is always [www.escalatokens.com](https://www.escalatokens.com).

## License and credits

[MIT](LICENSE) © 2026 Cesar Durango (Duscenko). Third-party notices: [NOTICE](NOTICE). Security model (no accounts, claim-on-first-publish): [SECURITY.md](SECURITY.md).

Standards referenced for defaults: Radix Colors (12-step scales), W3C Design Tokens, WCAG. Escala is not affiliated with those projects. Figma is a trademark of Figma, Inc.

Built by [Cesar Durango](https://duscenko.com) (Duscenko).
