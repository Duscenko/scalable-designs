# Escala — Project Context for Claude Code

This file is the source of truth for Claude Code CLI. Read it before making any change.

---

## What this is

A web configurator that lets product designers build a minimal, custom design token system — no bloat, only what they choose. The output is a `tokens.json`, `variables.css`, and `README.md` that sync directly into Figma via a companion plugin.

**Live URL:** https://www.escalatokens.com
**Stack:** React + Vite + TypeScript + Tailwind CSS v4 + Zustand + Framer Motion + Radix UI

**Platform: desktop/laptop only, not a responsive site.** The user is a design engineer at
a keyboard (see `.impeccable.md`), and the surfaces here — dense token tables, the Export
wizard's collection/component pickers, side-by-side rail + canvas + preview — assume a real
window, not a phone. Below Tailwind's `md` (768px) `App.tsx` renders `DesktopOnlyNotice`
instead of the shell, pure CSS (`md:hidden` / `hidden md:block`, no JS viewport check).
**Don't spend effort making dense editor screens work on a phone layout** — that's
explicitly out of scope. Individual components still adapt between `md` and `xl`
(`SectionRail` becomes a drawer below `md`, `PreviewPanel` hides below `xl`) — that range is
"a smaller laptop window," not a phone, and is as far as responsive work goes here.

> **The mobile screen is not a dead end.** `DesktopOnlyNotice` leads with the
> "optimized for desktop" message and then renders the **entire About drawer** below it —
> what Escala is · how the tokens work · the Figma plugin · what the docs are based on ·
> changelog · legal · contact. That content needs no workspace to be useful, and on a phone
> it used to be unreachable: its only door was `TopNav`'s burger, which lives inside the
> desktop shell. `AboutMenu.tsx` therefore owns the CONTENT, not just the drawer — it
> exports `SECTIONS`, `AboutAccordion` and `AboutContact`, and both surfaces render the same
> array, so the copy can't drift. The drawer keeps its own chrome (72px header, close
> button, `scrollIntoView` on `section`); mobile keeps its own lead + footer. **This is the
> one exception to "don't build phone layouts" — it's a static reading surface, not an
> editor screen.**
> Two consequences worth knowing: `md:hidden` is `display:none`, not an unmount, so **both
> screens are in the DOM at once** — `[data-section]` appears twice, which is why the
> drawer's `scrollIntoView` query is scoped to its own `bodyRef` and must stay that way
> (a document-wide `querySelector` would find the hidden mobile copy first). And the mobile
> accordion starts fully collapsed: nothing can pre-open a section there, since the
> `openAbout(section)` entry point only exists in the shell.

---

## Navigation model — top-nav workspace ("Escala")

The app is a **top-nav workspace**, **not a wizard**. Designers **configure tokens and see
them live at the same time**: tweak the controls on the left, watch the canvas repaint,
then export. **There is no left icon rail** — section switching lives in the top bar.

```
┌ row 1 — TopNav (global, every view) ───────────────────────────────────────┐
│ ◆ Escala          │  Variables Generator · Components · Docs              │
│   Token controls  │              [Figma] [◆ Connect] [☾/☀]                 │
├── LEFT COLUMN ────┼── CANVAS ──────────────────────────────────────────────┤
│  Variables rail   │ Color │ Quick edit · Kits · Export                    │  ← row 2
│ Color · Font      │  · Export                                             │
│ Radius · Spacing  │  the active foundation's editable token table         │
│ Sizes · Icons …   │                                                       │
└───────────────────┴────────────────────────────────────────────────────────┘
```

The brand block's right border is the same divider as the left column's, so it runs
unbroken from the very top. **Every row-2 header is `h-[52px]`** — `CenterHeader`,
`PreviewPanel`, `SaveSidePanel` — so they line up across every column of every section.
Any new panel header uses that height too. Their actions use the shared `ui/HeaderPill`
(Variables' Kits is the one still here — Export moved to `TopNav`, see the note below — New
and Import JSON used to sit here too and are retired, see the Navigation model note below).

> **Export is a guided flow, not a dump — and there is only ONE of it.** `TopNav`'s Export
> pill opens `ExportWizard` (Source → Where → Export), backed by `lib/exportWizard.ts`.
> **It's TRANSVERSAL, not a per-foundation action** — it used to sit in the
> `FoundationIconRail` row beside Kits, which meant it only existed while `tab ===
> 'foundations'` and read as a property of whichever foundation you happened to be editing.
> Exporting isn't scoped like that: it's something you reach for from anywhere, so it moved
> to `TopNav`, next to Plugin/Connect — the same cluster of "get your system out of here"
> actions. `ExportWizard` was already a `fixed inset-0` modal with its own backdrop, so
> opening it doesn't care what's rendered behind it. **It ALWAYS opens with every
> foundation checked** — `initialCollections` defaults to `ALL_WIZARD_COLLECTIONS` and the
> shell no longer overrides it. It used to pre-scope to the section on screen
> (`COLLECTIONS_OF[activeFoundation]` when opened from Variables — since deleted), and
> before that the partial default was a hardcoded `['primitives', 'semantics']`. Both were
> retired for the same reason: a whole-system export is the more common ask, and starting
> partial silently under-shipped anyone who hit Next without first reading the checklist.
> The `initialCollections` prop stays on `ExportWizard` for a future scoped entry point, but
> nothing passes it today. The one narrowing that DOES survive is **`initialModes`**: Theme
> Preview's "Export theme" ships just that theme. And `activeTheme` (the previewed theme)
> is what the wizard checks by default in "My themes" — see the Step-1 note below.
> A separate **Share** pill used to open the same wizard pre-checked to whole-system
> (`ALL_WIZARD_COLLECTIONS`) instead of the active section — it was retired (`HomeActions`,
> `Configurator.tsx`'s `shareOpen` state and second `ExportWizard` instance all removed)
> because two pills opening the identical flow just read as duplication; Export's own
> Step 1 lets you check every collection manually, so whole-system export is still one
> click away, just not a dedicated button for it. Don't re-add a Share pill that does what
> Export already does.
> Step 1 picks **collections** (primitives · semantics · typography · spacing · radius ·
> shadow · grid · sizes · icons — all checked on open) and, for semantics, which **themes**
> ship. That picker is labelled **"My themes"** — the Themes Library's own heading, which is
> also the scope (a System style ships only once it's been added there). Each chip
> identifies its theme the way the rail does: the accent it's built on (`themeBrandRamp`), its
> real `themeDisplayName` (never a `themeOrder` slug), and its light/dark polarity
> (`AppearanceGlyph` — the SAME sun/moon asset + `currentColor` treatment the rail uses;
> `KindIcon`'s amber/indigo tint is only for the Token Details section headers). **Only the
> previewed `activeTheme` is checked by default** — not every theme in the system — so the
> wizard opens saying "this one" and a `text-fg-faint` line ("Shipping this theme only. Tap
> another to include it, or add all N.") says the rest exist; All / None toggle every chip.
> And, for primitives, which **families** ship (Accent · Neutral · Error … + customs —
> `primitiveFamilyMeta()`, derived from the real `colors.primitive` keys so a family can't
> be offered that the payload doesn't contain; picking one ships BOTH its ramps, since
> `accent` and `accent-dark` are one family two ways, exactly like the Primitives table's
> light/dark columns). Every family checked = `primitiveFamilies: undefined` = the
> pre-scoping payload byte-for-byte, so the default export never changed;
> step 2 picks the **destination** (Figma → `escala`, Code → `w3c`, AI → `agent-bundle`;
> Skill is a nested Figma Make toggle, Markdown left the wizard for Save / Copy context)
> and, for W3C only, single-vs-per-collection files; step 3 summarizes and downloads. On
> AI, step 3 shows the same Install panel as Docs → Use in code — `AgentInstallPanel`,
> which now leads with the MCP connection, not the `npx @escala/cli` package (see the
> UPDATE below). Rules that keep it honest:
> - Everything derives from ONE `generateTokenJSON()` call, so wizard output can never
>   disagree with `tokens.json`. Counts on screen are counts in the file.
> - **Primitives' per-column export icon exports one ramp; it doesn't fork the export
>   pipeline.** `ColumnExportMenu` (`ColorPrimitives.tsx`) sits in the **light** and
>   **dark** column headers — per column, deliberately, because an icon there can only
>   mean "this family, this appearance", which is the only scope a single ramp is useful
>   in. It opens a FORMAT popover (`FAMILY_FORMAT_OPTIONS` — W3C, Escala JSON, Markdown;
>   not the wizard's destination radios); each row is a
>   `role="group"` of a plain-text label plus TWO dedicated icon buttons — **copy**
>   (clipboard) and **download** (`downloadOne`, saves to disk) — each running the exact
>   same `buildFamilyExport()` call, just handed to `navigator.clipboard` vs. a Blob/anchor,
>   so the two can never disagree about what "this format, this ramp" means. The row used to
>   be ONE clickable label (click-anywhere-to-copy) with only download getting its own icon
>   — that read as one action with an unrelated icon bolted on, not two real choices; giving
>   copy the same dedicated-icon treatment as download is what makes the row symmetric.
>   Don't re-merge them into a single click target. Copy still auto-closes the popover after
>   its "Copied" flash; download does NOT, on purpose — downloading is the slower action of
>   the two, and someone comparing formats is likely to want a second one right after.
>   `EXPORT_MENU_W` is **420px**, wide enough that no format's hint text truncates with two
>   40px icon columns on the right — measured against the longest hint (Escala JSON's);
>   don't shrink it back down without re-checking that one.
>   **This popover has its own display names, layered on top of `FAMILY_FORMAT_OPTIONS` rather than
>   renaming the wizard** (`MENU_FORMAT_LABEL`/`MENU_FORMAT_BADGE`): W3C Design Tokens reads "W3C
>   Design" here with a "Figma native" badge (mirroring Escala JSON's "Figma plugin" badge —
>   W3C's flat `$value`/`$type` tree is what Figma's own "Import variables" accepts with no
>   plugin, same shape of claim as Escala JSON needing the Escala plugin specifically). The
>   wizard's Where step reads destinations (Figma / Code & other tools / AI assistant) — that
>   view has room and a different job; only this compact, two-icon-per-row popover
>   names file formats. Not a second
>   exporter either way: `buildFamilyExport()` assembles a normal `WizardSelection` and
>   runs it through `buildWizardExport`, so both actions are byte-identical to running the
>   wizard scoped the same way. Escala JSON is the one entry that ISN'T scoped
>   (whole-document contract) and the popover says so inline.
>   **Alpha families (Accent-Alpha, a custom family's `-Alpha` twin) get the icon too now** —
>   it used to be hidden entirely, because alpha values live in `colors.primitiveAlpha`,
>   which `buildFamilyExport`'s pipeline (scoped to `colors.primitive`) never reads; routing
>   an alpha family through it silently exported nothing or the wrong ramp, hence hiding it.
>   Fixed with a SEPARATE builder, `buildAlphaFamilyExport` (`exportWizard.ts`) — takes the
>   `Family`'s own `.light`/`.dark` scale directly (alpha values are solved against a page,
>   see `alphaColorOver`, and aren't independently stored anywhere the normal pipeline could
>   re-derive them from) and flattens it with the SAME `flattenScale` `tokenGenerator` uses
>   for `colors.primitiveAlpha` itself, so `accent-a-1`…`accent-a-12` here can never disagree
>   with what's actually in tokens.json. **Only `ALPHA_EXPORT_FORMATS` (W3C · Escala JSON ·
>   CSS · SCSS) are offered for an alpha family** — `ColumnExportMenu` filters `FAMILY_FORMAT_OPTIONS`
>   down to that list when `isAlpha`. Tailwind and Markdown stay OFF the list on purpose:
>   both delegate to `sectionExport`'s builders, which have zero concept of alpha primitives,
>   and faking support there would reproduce the exact "hands over the wrong thing" bug this
>   fix exists to close — just in two formats instead of six. If `sectionExport` ever learns
>   alpha, revisit `ALPHA_EXPORT_FORMATS`, not before.
>   The popover is **portaled to `<body>` and positioned `fixed`** — the header sits
>   inside the table's `overflow-auto` column, which clipped a ~340px absolute panel on
>   any normal window height (same fix as the family picker's `editPortal`).
>   Separately, the wizard REMOUNTS per open (`key={exportRun}` in `Configurator`) —
>   reopening inside the 0.15s exit animation reused the instance, so a narrowed run
>   handed its scope and its step 3 to the next export.
> - **A family filter has to reach every renderer, not just the JSON ones.** Primitives
>   and semantics collapse onto ONE `sectionExport` 'color' section for Tailwind/Markdown,
>   so `buildWizardExport` passes `{ families, includeSemantics }` (`SectionExportOptions`)
>   down — otherwise an Accent-only run would still render six families plus the whole
>   alias layer in those two formats. Same reason `aliasMap` is scoped: a W3C alias must
>   never reference a token the file left out. `appearance` is in that same options bag:
>   `sectionExport`'s `colorFamilies` only ever knew the LIGHT scales, so a dark-column
>   copy in Tailwind/Markdown would have silently shipped light hexes under a dark name —
>   it now swaps in each family's dark twin under its exported `*-dark` prefix.
> - **W3C ships real aliases**: a semantic value sitting on a primitive tone exports as
>   `{color.neutral.900}`, not a loose hex. That's the point of the format — don't
>   "simplify" it back to hex.
>   **Except when Primitives isn't part of the export at all** — `w3cTreeFor`
>   (`exportWizard.ts`) forces `includeAliases` to resolve-to-hex there regardless of the
>   wizard toggle, because `pickedPrimitives(full, undefined)` falls back to the WHOLE
>   unscoped primitive set when no family filter is given, so a Semantics-only run used to
>   alias `{color.accent.9}` unconditionally into a document that never wrote a `color` tree
>   anywhere — a reference nothing can resolve. That's the reliable, reproducible cause of
>   "W3C export → Figma/Tokens Studio won't read the file": every DTCG-aware importer either
>   throws or drops the token on an alias it can't follow. The wizard's own `includeAliases:
>   false` path already existed for exactly this (see the toggle's "Resolved to hex" label),
>   so the fix reuses it rather than inventing a second fallback. Step 2's Options panel and
>   step 3's Summary row both mirror the SAME condition (`collections.includes('primitives')`)
>   so neither can claim "Included" for a file that will actually ship hex — the toggle
>   itself is left alone (still checked, still savable as the user's preference) since it's
>   still honest for the next export where Primitives IS included.
>   **`$value`/`$type` (with the dollar prefix) is the correct, current W3C DTCG spec** —
>   don't "fix" it to bare `value`/`type` to chase Figma-import compatibility. Bare keys are
>   Tokens Studio's OLD, pre-DTCG legacy format; adopting them would silently break the
>   promise this format's own hint text makes ("Standard format with $value, $type") and
>   de-standardize the export for every DTCG-compliant consumer that isn't that one legacy
>   path. If a real Tokens Studio/Figma import failure shows up again, get the literal error
>   text and confirm which import mode is in use before touching the key names.
> - **Escala JSON is single-file by contract** (it's the plugin payload), so the structure
>   choice is locked there.
> - Tailwind and Markdown delegate to `sectionExport`'s builders — one renderer per format,
>   not two. `SectionExportModal` and the old `ShareModal` were retired into this flow.
> - **Step 3 is delivery-only** for the DOWNLOAD — it summarizes the destination and either
>   downloads the artifact or continues to the GitHub connection screen. It ALSO carries the
>   optional "Save a reusable snapshot" card (the local-registry save), because exporting
>   never saves automatically and this is the moment the user is thinking about persistence;
>   the System library still owns save/restore, this is just a second door to
>   `saveCurrentSystem`. The GitHub handoff (`onConnectGithub`) closes the wizard and opens
>   `GitHubConnectView`; it never reimplements PAT/OAuth or pushes automatically.
> - **The snapshot names itself after the THEME when the wizard was opened for one.**
>   `openThemeExport(previewTheme)` (Theme Preview → "Export theme") passes `themeScope` +
>   `themeScopeLabel`. Step 3's name field then holds the theme's label in LOCAL state
>   (never `setProjectName` — a pre-fill must not rename the project), and Save routes to
>   `saveCurrentSystemAsTheme(themeScope, name)` so the kit files as `local:<theme>`,
>   separate from the whole-system `local:<project>`. The generic entry points (TopNav
>   Export, a foundation's Export) leave `themeScope` null and the field stays bound
>   straight to `projectName` / `saveCurrentSystem`, exactly as before. A one-line hint
>   under the field states the scope so "Neo-Brutalism" in the box isn't mistaken for a
>   typo'd project name.
> - **Step 2's DESTINATION header carries an "Add sync option" link** (`onAddSyncOption`,
>   only rendered when the prop is passed). It's a link-OUT, same pattern as
>   `onConnectGithub`: closes the wizard and opens `FigmaSyncView` (the live-sync URL +
>   auto-publish setup). It is NOT a fifth destination row and NOT a second sync UI — the
>   wizard's four destinations are one-shot exports, live sync is a standing connection, so
>   it belongs in its own flow.

> **UPDATE: `AgentInstallPanel` now leads with the MCP connection; the `npx @escala/cli`
> package is the offline fallback, not the default.** It used to be the reverse — the
> package's install command first, the MCP block last, captioned "Live tokens (optional,
> recommended)". The word "optional" undid "recommended": a reader scanning for what they
> must do stops at "optional."
> - **The reason is specific, not a general live-over-static preference, and it's now
>   measurable.** The border/action solver work in this same session made 5 of Categorical's
>   41 roles resolve to a DIFFERENT PRIMITIVE REF depending on the user's accent hue —
>   `action.primary.default/hover/pressed`, `border.focus`, `content.on-action`. A package
>   generated against a violet system and kept in the repo tells the agent `accent.9` for the
>   primary fill after the brand moves to amber — and `accent.9` is the exact tone the solver
>   REJECTED for that system because its label fails AA. A stale snapshot here doesn't just
>   go out of date; it goes out of date in the direction that reintroduces the accessibility
>   bug the solver exists to prevent. `resolve_token` has no such failure mode — it resolves
>   against the published system at call time, so it always returns what the solver actually
>   chose. This is why Live got promoted and the package didn't get cut: the package still
>   answers "what tokens does this system even have" (names, catalogue, usage prose), which
>   Live can't — an agent with only Live doesn't know what to ask for.
> - **No new MCP tools.** The six that already exist (`get_tokens`, `resolve_token`,
>   `list_components`, `get_component`, `list_icons`, `check_contrast` —
>   `lib/agentAccess/types.ts`) carry the whole argument. This was a framing fix, not a
>   capability build.
> - **Figma Make keeps zero live framing** — `{tab !== 'make' && <McpBlock …>}` is unchanged.
>   Make consumes an uploaded zip and cannot hold a connection; don't imply otherwise there.
> - **Docs' AI sections reordered to match**: Connect → Offline package → Paste only (was
>   Download → Install → Paste only). The old "Download" section existed mainly to send the
>   reader to Export for the zip; that exit moved inside "Offline package" instead of being
>   the page's opening move. Copy Page's markdown leads with the
>   `mcp init`/`.cursor/mcp.json` connection for the same reason — an agent reading the
>   pasted context should be told to connect before it's told to unzip. (**Superseded in
>   placement, not in reasoning**: that whole page merged into Docs → Use in code — see the
>   "TWO destinations" note under the Docs master list. Connect still leads the AI half.)
> - **Every command string still comes from `lib/agentInstall.ts`** — reordering never meant
>   inlining a command. If a path in Docs ever disagrees with what the CLI parses, that
>   module is where it drifted, not the JSX around it.

> **UPDATE: `AgentInstallPanel` is a numbered PROCEDURE now — client tabs + an MCP/PROMPT
> toggle over `[nn] [what + why] | [the command]` rows.** It was a stack of prose blocks
> with two `<details>` disclosures, where the commands were the smallest thing on screen and
> half of them were hidden behind a summary you had to know to open. Connecting an agent IS
> a procedure, and one that doesn't say how many steps it has reads as open-ended.
> - **Four client tabs — Cursor · Claude Code · VS Code · Figma Make — and NOT one more.**
>   That's exactly what `agentInstall.ts` can honestly produce (`McpClient` is
>   `cursor|claude|vscode`; Make takes a zip). A tab whose commands had to be invented is
>   precisely the drift the "every command string comes from `agentInstall.ts`" rule exists
>   to stop — don't add ChatGPT/Codex/Claude Desktop tabs without the CLI learning them
>   first.
> - **A client only gets a step it can actually run.** VS Code has NO offline-package step:
>   `SkillAgent` is `cursor|claude` and Copilot has no skills folder to install one into.
>   Figma Make has no MCP mode at all, and its toggle is **not rendered** rather than
>   disabled — a disabled control still claims the mode exists. (This is the same
>   `{tab !== 'make'}` rule as before, just expressed in the tab row.)
> - **PROMPT is a real second path, not a restatement.** `agentSetupPrompt()` (in
>   `agentInstall.ts`, like everything else) is one message that adds the server, then
>   PROVES it connected by having the agent read the system back. Every claim in it is
>   checked against something real: the endpoint is `mcpEndpoint`, the transport is what
>   `/api/mcp` actually speaks — **plain streamable HTTP with no auth, so never add a
>   "sign in" line** — and the tool names are entries in `agentAccess/types.ts`.
> - **A step with no command spans the whole row** (`split`), instead of keeping a 42%
>   column and leaving 58% blank beside it. The column split exists to give the COMMAND its
>   own space; with no command there's nothing for it to do.
> - **The client tabs carry real vendor logos** — `public/ide-logos/<name>-{dark,light}.svg`,
>   rendered by `ClientLogo` (`AgentInstallPanel.tsx`). This REVERSES an earlier
>   "simple marks, not vendor logos" call — a designer supplied the real marks and a real
>   logo tells the four options apart faster than an abstraction of one. Each mark is two
>   files with a HARDCODED fill: `<name>-dark.svg` is black (for light mode), `<name>-light.svg`
>   is white (for dark mode). They're `<img>` from `public/`, so `currentColor` can't reach
>   them — the two-file swap is done with `dark:hidden` / `hidden dark:block` on the app's
>   `.dark` class, NOT by recolouring. Active vs. inactive is opacity only (100 vs. 55): a
>   logo shouldn't change colour between tab states, just dim when it isn't the selected
>   one. `figma-*.svg` covers the "Figma Make" tab — Figma Make is a Figma product and has
>   no separate mark. If a fifth client is ever added, it needs both files in that folder
>   before its tab can render.
> - **It lives on Docs → Use in code → "Connect your agent" now**, not on a page of its own
>   — see the "TWO destinations" note under the Docs master list. Its step 03 is why that
>   page has no standalone "Offline package" section.

- **Shell = `Configurator.tsx`**. `TopNav` is mounted **once**, above the columns, in
  every view. All nav state is **local** there: `tab` (`about`|`foundations`|`components`|
  `docs`), `activeFoundation`, `activeComponent`, `exportMode` (`null`|`code`|`md`|`figma`|
  `github`|`save`), `semanticFocus`. None persisted — every reload lands on
  **Variables · Color** (`activeFoundation` defaults to `'color'`) — **except a genuinely
  first-time visitor, who lands on About instead** (see the About-tab note right below).
  Leaving a foundation marks it complete (`commitVisit()` → `markFoundationComplete`).
- **FOUR top-nav sections** (`TopNavKey` in `TopNav.tsx`, mapped by `navActive`/
  `handleNav`): **About** (first, `tab 'about'`) — **Variables Generator** — EDIT the system
  (`tab 'foundations'`, entering at Color) — **Components** — browse the catalogue
  (`tab 'components'`, `ComponentsView`) — and **Docs** — read the token reference
  (`tab 'docs'`, `DocsView`). The visible label is shortened to **Variables** in the
  header; the product surface remains the Variables Generator. Export/connect views
  (Figma · GitHub · Export · Save) unlight
  all four.
  > **About is a tab, not a wizard step — and it's the ONE exception to "no separate
  > landing screen" above, deliberately narrow.** It used to be a hidden burger-icon
  > drawer (`AboutMenu.tsx`'s default export — still in the file, unwired, same
  > retirement treatment as `WorkbenchLayout`/`HomeView`/`PickerColor`) whose only door was
  > a small icon in `TopNav`; reported as new visitors never finding it. `AboutHome`
  > (`AboutMenu.tsx`) is the tab's canvas body — reuses the SAME `SECTIONS`/
  > `AboutAccordion`/`AboutContact`/`COPYRIGHT_LINE` every other About surface
  > (`AboutScaffold` for the mobile screen and the shareable `/about` route) already
  > shares, so the pitch can't drift between them — its own hero + CTA
  > (`onStart` → `selectFoundation('color')`, a real in-app action, not a link) is the
  > only thing that differs, because unlike the mobile/`/about` callers this one already
  > IS the app. **Whether it's the LANDING tab is a one-shot, per-browser check** —
  > `hasOnboarded()` (`lib/onboarding.ts`) reads a plain `sd-onboarded` localStorage flag,
  > OR grandfathers any browser that already has the zustand persist key
  > (`scalable-designs-store`) present — so every existing user keeps landing on
  > Variables · Color exactly as before, and only a browser with NEITHER key counts as
  > new. No store field, no version bump: this is a UI-chrome concern kept out of
  > `DesignSnapshot`, the same way `lib/theme.ts`'s `sd-theme` is. Leaving the tab for
  > anything else marks the browser onboarded (a `useEffect` on `tab`, not a stack of
  > call sites to remember) — but the tab itself stays reachable from TopNav at any time
  > afterward, exactly like Components/Docs; it never gates or blocks the workspace.
- **Components and Docs are TWO separate destinations, each a single-purpose rail →
  master list → article, sharing article renderers but NOT a rail.** They used to be one
  "Documentation" destination with a shared rail carrying two groups (Foundations +
  Categories) — reverted, because browsing the component catalogue and reading foundation
  reference are different intents, and a rail that always listed both regardless of which
  one you came for was one more thing to filter past to find what you wanted. What's
  shared is still shared (see below); what differs — the rail, the master list shape, the
  top-nav entry — is now genuinely separate per destination.
  - `ComponentsView.tsx` — Components' own shell: master list (grouped by category, with
    the catalogue's include checkboxes) → `ComponentArticle` → TOC. The category RAIL
    itself is Configurator's outer `SectionRail`, fed straight from `CATEGORIES` (one
    group, no Foundations entry to filter past).
  - `DocsView.tsx` — Docs' own shell: master list (Overview, then the eight foundations) →
    `FoundationArticle`/`OverviewArticle` → TOC. **No outer `SectionRail`** — Docs has only
    ONE group of things to list, so a whole column reserved for a lone "Overview" button
    would be a column spent on one row. It owns its full width under the header instead,
    the same move Variables Generator makes (`outerRailVisible` is `tab === 'components'`
    only now; Docs' master list on the left is its entire "rail").
  - Both still pull from `docs/blocks.tsx` (`CopyButton`, `DocHeader`, `DocTitle`,
    `DocSection`, `Prose`, `CodeBlock`, `PreviewCode`, `ShipsAs`, `CountBadge`,
    `OnThisPage`, `Pager`) so a foundation page and a component page read as the same KIND
    of page — same breadcrumb shape, same Copy Page, same TOC — even though they live under
    different top-nav entries now. `DocHeader` takes an explicit `section` prop
    ("Components" / "Docs") for the first breadcrumb crumb — it used to hardcode
    "Documentation", which was correct back when both shared that one destination and
    became a stale label the moment they didn't.
  - `docs/foundationDocs.tsx` (`useSystemDoc()`, `FOUNDATION_DOCS`) and
    `docs/foundationArticle.tsx`/`docs/componentArticle.tsx` (the article bodies
    themselves) are UNCHANGED by the split — only the shell around them moved. Adding a
    foundation is still ONE entry in `FOUNDATION_DOCS`; the master list, the TOC and
    prev/next all still derive from it.
- **Rules that keep it honest:**
  - **Docs' master list is Get started (Figma / Code), then System reference
    (`OVERVIEW_KEY`), then the foundations in `FOUNDATION_DOCS` order.** Get started is
    destinations, not file formats. Adding a foundation is still automatic; nothing in
    `DocsView.tsx` enumerates them by hand. Guide keys live in `docs/getStarted.ts`.
    **TWO destinations, not three — `GUIDE_AI_KEY` is GONE.** "Use in code" and "Use with
    AI" were separate rail rows answering the SAME question ("how do my tokens reach my
    repo?") and giving the same rule twice in different words: the CSS section said
    "reference roles, never a hex" in prose, the AI page enforced the identical thing
    through `resolve_token`. `variables.css`, W3C JSON, a GitHub remote and the MCP server
    all land in one place — the product repo. Figma is the destination that is genuinely
    different (a design tool, a plugin, variables in a file) and kept its own page.
    Merged shape: **CSS variables · Connect your agent · Other tools · A repo**, in the
    order a reader asks — the file first (the universal answer), then the agent (same rule,
    enforced at call time), then the two exits. The standalone "Offline package" section
    went with the merge because `AgentInstallPanel` carries it as its own step 03 (one
    explanation, in the place you act on it), and "Paste only" became a one-line footnote
    under Connect. The key, the rail row, the TOC branch, the markdown branch and the
    `TITLE` entry were all DELETED, not deprecated; About's "learn AI" CTA points at
    `GUIDE_CODE_KEY` now. Don't re-split them — a reader who wants the agent half lands on
    a page whose first paragraph already tells them everything here goes to one place.
  - **`componentCategory` (Components' rail selection) and `docFoundationKey` (Docs' open
    row) are independent pieces of state in `Configurator.tsx`, one per destination —
    switching Components' category never touches `docFoundationKey` and vice versa.** Both
    are lifted (not local to their view) so leaving a tab and coming back resumes on the
    same place instead of resetting — verified: Docs → Shadow → Next → Grid → Variables
    Generator → Docs → still on Grid; Components → Content & Surfaces → Avatar → Variables
    Generator → Components → still on Avatar. Default Docs landing is Get started
    (`GET_STARTED_KEY`).
  - **Every foundation page carries "Edit tokens" → `selectFoundation(key)`**, opening the
    very editor it documents (and switching to the Variables Generator tab to do it). That
    link is what makes Docs documentation OF the Variables Generator rather than a parallel
    description of it. Keep `FoundationDoc.key` equal to the `FOUNDATIONS` key or it breaks
    silently.
  - **`OVERVIEW_KEY = '__overview'` is the whole-system sheet**, rendering every
    foundation's sections in one column for hand-off/print. It is NOT a foundation and is
    no longer the first rail row. Its TOC is one entry per FOUNDATION, not per section:
    eight foundations × their sections is a crowded rail nobody can scan.
    - **The top-nav Docs destination never renders it** (`allowReference={false}` there),
      so its title is effectively Theme-Preview-only. The Theme Preview hub therefore
      passes `overviewTitle` = the previewed theme's display name
      (`DocsView` → `OverviewArticle`'s optional `title`), so the sheet reads as
      **that theme's** spec — H2, `DocHeader` crumb and the lead ("…of this theme…")
      all follow it — and the hub's rail row is **"Theme reference"** under a **"Theme
      doc"** header, not "System reference" / "System doc". Omit `overviewTitle` (or pass
      blank) and it falls back to "System reference" / "this system" verbatim.
    - **Known gap, not addressed here:** the sheet's BODY still comes from
      `useSystemDoc()` (the global store), so the ramps/values shown are the system's,
      not the previewed theme's — only the title is theme-scoped. Theme-scoping the body
      needs `useSystemDoc` to take a theme, which also touches the top-nav DocsView.
  - **`Prose` renders `inline code` from backticks.** The foundation copy names tokens
    constantly; a `<p>` printing its own backticks reads as an unrendered markdown file.
    One rule only — don't grow it into a markdown parser.
  - **The middle breadcrumb crumb drops below `lg`, never the page's own name.** With rail
    (Components only) + master list + TOC all claiming width it can truncate; the section
    and the page survive at every width, the group in between is already visible in the
    rail/master-list.
  - **The article swaps by REMOUNT (`key` on a plain `motion.div`), never
    `AnimatePresence mode="wait"`.** An earlier version of this shell used `mode="wait"`
    and it hung: the view re-rendered with the new page while the DOM kept the old article
    indefinitely (verified — the render logged the new key, the `<h2>` node never changed).
    The shell's own center swap avoids it for the same reason.
- **What the ORIGINAL Documentation/Components merge fixed, and the later re-split did
  NOT undo:** every `ComponentDef` field used to render twice in two trees (`description`
  twice inside one page alone; `props` in two tables with DIFFERENT columns); two search
  states; two active-item states, so switching sections lost your place; and split
  capabilities for the SAME component — one half owned Examples · TOC · Copy Page ·
  Related · prev/next · Preview/Code, the other owned live axis controls · icon slots ·
  translucent-panel backdrop · "Add to system". All of that stayed unified inside
  `ComponentArticle` through the re-split — only the RAIL that used to sit above both
  Foundations and Components got split back apart, not the component article itself. The
  merged **hero** is still the playground and the preview/code block at once, so the
  snippet you copy is the snippet for the variant on screen, and the variant badge is a
  real index (`variantIndex`), not a hardcoded "1 of N". Don't refuse the article-level
  unification just because the NAVIGATION got split — they're independent decisions.
- **Generator/Preset is retired** — the old `WorkbenchLayout` workbench (a left "Preset ·
  Quick edit" accordion beside a live component playground) was the former landing view
  and is now unreachable as its own screen (the file is kept for reference only; don't wire
  it back up). Its Presets swatch row + the full quick-edit accordion (Color Family ·
  Typography · Shadow · Radius · Icons · Padding · Panel background) survive as a
  **secondary popover**, not a view: the sliders icon in `CenterHeader`'s rightSlot
  (`QuickEditTrigger` in `Configurator.tsx`) opens `QuickFoundationsPanel` — the same
  popover the Components tab already used.
- **`HomeActions.tsx` is now RETIRED — nothing imports it.** It was down to one live
  render: `Configurator`'s `themeWorkspaceActions`, on the Primitives tab, with
  `hideSystems` — i.e. ONLY the whole-system "Reset to defaults" pill (Kits/Systems had
  already moved to Workspace settings; New/Import JSON were retired earlier). That Reset
  pill is gone: a rare, no-undo action given equal billing with GitHub · Figma · Search,
  when the resets anyone actually reaches for are the per-token "reset to standard" icons
  in the tables and the quick-edit strip's per-family reset (all unrelated, all stay).
  `useDesignStore.resetToDefaults` is untouched. The file is kept for reference, same as
  `WorkbenchLayout`/`PickerColor`/`NewTokenWizard`; don't wire it back.

  > **UPDATE — the whole-system reset is REACHABLE again, and the two objections above
  > are what the new shape answers.** It lives in `ResetScopeControl`
  > (`ThemeResetButton.tsx`), in the Themes-library rail footer. It is no longer "a rare
  > action given EQUAL BILLING": the footer button says only "Reset" and the scope is
  > chosen inside a modal, so nothing fires on the click itself — you have to pick
  > "Whole system" by name, next to the far commoner "This theme". And it is no longer
  > "NO-UNDO": both scopes `captureSnapshot` first and the footer becomes a 9s Undo bar,
  > the same affordance `useThemeReset` already gave the theme-scoped reset. The
  > per-token and per-family resets that note lists are unrelated and all still stand.
  > Don't re-add a bare Reset pill — the modal IS the guardrail that makes this
  > acceptable.
- **"New" (guided token creation) and this row's "Import JSON" are RETIRED, not just
  hidden.** Both used to sit in `HomeActions` next to Kits: New opened `NewTokenMenu` → a
  category popover → `NewTokenWizard.tsx` (a 2–4 step Name/Target → Value/Scale →
  Confirm[ → Role, Color only] flow that wrote through the same store actions the
  Foundations editors use, and for Color specifically also asked which ROLE the new family
  should take — Replace the active Accent / Add as a secondary accent / Save as a standalone
  palette, Radix's aliasing split made explicit); Import opened `ImportSystemModal`. Both
  flows shipped without enough guardrails to be self-explanatory (no preview of what "New"
  would actually add, no validation feedback on a bad JSON paste) and read as confusing
  enough in practice that removing the entry points was worth more than the feature.
  `NewTokenWizard.tsx` and `ImportSystemModal.tsx` are NOT deleted — same precedent as
  `WorkbenchLayout`/`PickerColor`/`HomeView` below: kept for reference, not wired up.
  Consequences:
  - `ColorPrimitives.focusFamilyKey` (the prop `NewTokenWizard`'s `onDone` used to switch
    the table to a just-created family) has no caller left — `Configurator.tsx` no longer
    holds the `focusColorFamily` state that fed it. The prop itself stays on `ColorHub`/
    `ColorPrimitives` (harmless, optional, genuinely reusable if something else wants
    cross-component focus later) — don't remove it just because this one caller did.
  - **Import is still reachable** — `SaveView`'s own "+ create/import tile" (a separate
    entry point this row never owned) still opens the same `ImportSystemModal` via its own
    `onImport` prop, wired directly in `Configurator.tsx`, untouched by this retirement.
  - **Color family creation still exists**, just never went through New — it's Semantics'
    "+ Theme" flow (asks for the accent/neutral/status colours a theme needs and files the
    families it mints under that theme's folder automatically; see `familySlotFor()` in
    `themeSources.ts`). "Start a new DESIGN SYSTEM" is a different, unrelated action,
    unaffected — still reachable via `NewSystemModal` from `SaveView`'s saved-systems grid.
- **`HomeView` is retired** — the old hero/collage hub is unreachable (the file is kept
  for reference only). Don't wire it back up.
- **Color is a three-tab hub** (`ColorHub`, default tab `primary`, labeled **Primitives**):
  **Primitives** / **Semantics** / **Gradients**. The tab pill bar is pinned on top for all
  three tabs (`ColorHub` renders it once, above whichever tab's content scrolls beneath it).
  - **Picker Color is retired** — matching the Figma redesign this whole shell now follows
    (see Navigation model's `FoundationIconRail` note), which merges palette DEFINITION back
    into the usage table instead of keeping them on separate tabs. `PickerColor.tsx` is
    unwired (kept for reference only, same treatment as `WorkbenchLayout`/`HomeView` — don't
    wire it back up); its capabilities moved:
    - The **accent · Gray/Neutral quick bar** → **Primitives**' promoted quick-edit strip
      (below), contextual to whichever family is active in the nav instead of two fixed
      dropdowns.
    - **State Colors' "all five ramps visible at once"** comparison view is a real,
      deliberate loss, accepted for matching Figma exactly: each state (Neutral/Error/
      Success/Warning/Info) is still fully editable, just one at a time now — click it in
      the **Groups** nav and its quick-edit strip + table appear, same as any family.
    - **The Transparency scale** (`TransparencyStrip`, checkerboard-backed) → **Accent-Alpha**,
      a first-class nav entry under Accents (`generateAlphaScale(primaryScale/DarkScale,
      page, appearance)`, same helper the export ships as `accent-a*`) rather than a
      bespoke strip on a different tab. It's **read-only everywhere** — `Family.isAlpha`
      guards `changeFamilyBase`, hides the nav pencil and the per-row Token Details button
      — because an alpha value is SOLVED against its page (see "Alpha twins are solved, not
      eyeballed" below), never independently set. **Its nav chip is checkerboard-backed too**
      (`FamilySwatch`, painting the alpha ramp's step 5 — not the step-9 anchor, which
      composites to a near-opaque chip that reads as just another solid): Accent and
      Accent-Alpha sit adjacent under Accents, and with two identical solid chips nothing on
      screen said which one was the translucent ramp. Its table cells use `AlphaHexCell`
      (swatch over checkerboard + static hex text, no input) instead of `HexCell`: the same
      checkerboard `CHECKER` constant the (now-retired, see "Opacity is retired" below)
      `Step6_Opacity.tsx`'s "Opacity Scale" strip used to use, **exported** from
      `colorControls.tsx` so it stayed one pattern rather than two independently-styled
      "this is translucent" cues while both were live. This is the same
      correctness fix the old `TransparencyStrip` comment already explained: an alpha value
      painted on a flat backdrop silently breaks across light/dark preview, since it's only
      correct against the specific page it was solved for — the checkerboard has no "wrong
      theme" to break against.
    - **The scale-settings gear** (algorithm/naming/contrast shift, `ScaleSettingsModal` +
      `ColorControls` from `Step2_ColorPalette.tsx`) → the same promoted quick-edit strip.
  - **Primitives** (`ColorPrimitives.tsx`) — now BOTH definition and usage: the family nav,
    a per-family quick-edit strip, and the families table, all on one screen, stacked as
    **three full-width rows** (own `motion.div className="h-full flex flex-col"` root — was
    a single `flex` row before this pass, which is what left the quick-edit strip and the
    `Groups` header confined to the table's own column instead of spanning the same width as
    the icon-toolbar row above them, a mismatch caught in review against the Figma reference):
    1. the quick-edit strip, full width; 2. `Groups` + the **tab pill bar + search** sharing
    ONE row (`ColorHub` passes its `tabBar` down as a prop instead of pre-wrapping it, so
    `ColorPrimitives` can place it next to `Groups` — same line, per Figma — rather than each
    owning a separate row); 3. the nav+table split. The family nav itself is **promoted to
    the outer-left position** `SectionRail` used to occupy for Variables — flush, full height,
    `w-[198px]` (was a `w-44` sub-nav nested inside a padded, bordered card) — and that same
    198px width is what row 2's `Groups` + **"+ Add" family trigger** (moved here from the
    table's old top bar; same `addOpen`/`addRef` state and popover, new location — the
    popover itself anchors `left-0` off that trigger, not `right-0`, since right-anchoring a
    288px popover off a trigger sitting at the LEFT edge of the row clips it off-screen) sits
    inside, so it lines up with the nav directly below. It's still **foldered by ROLE, not
    insertion order**: `Accents` (now Accent +
    Accent-Alpha) / `Neutrals` / `States` (Error/Success/Warning/Info + custom families a
    theme aliases to a status slot — kept here too, deliberately: this rail is EVERY
    primitive's usage table — Backgrounds/Interactive/Borders/Solid/Text bands — and a state
    color is a primitive same as Accent/Neutral) / `Custom` for free-standing families no
    theme references yet, derived via `familySlotFor()` (`lib/themeSources.ts`) from which
    theme slot references each family — a family minted by "Add theme" files itself under
    the right folder with zero bookkeeping.
    - **That 198px column COLLAPSES to a 56px swatch strip**, handing ~142px to the token
      table. The toggle lives in the `Groups` header's trailing slot — a slot that row's
      `justify-between` already reserved around a lone label. Rules:
      - **56px, not the 32px dead strip `PreviewPanel` collapses to.** That panel is a
        read-only specimen, so collapsing costs only sight; this column is NAVIGATION, and
        at 32px there's no room for the family swatches, i.e. switching families would mean
        expanding first every single time. Keeping the chips is what makes it a collapse
        rather than a hide — the same call `FoundationIconRail` already makes (drop the
        labels, keep the glyphs). Verified: all 7 families stay clickable while collapsed.
      - **Collapsed rows are ONE button that selects the family**, sized `w-10 h-8` — the
        bare 18px swatch is not a target. Editing a colour stays behind the expanded state
        and row 1's swatch, so a click in the strip can't mean two things depending on
        where in the chip it lands. Folder *grouping* survives as a hairline rule between
        groups; only the text headers go.
      - **The state is LIFTED to `Configurator` (`colorRailCollapsed`), never local.**
        TopNav's brand block continues this column's divider up through the header via
        `brandWidth`, so a column that could shrink without the shell knowing would leave
        that rule stopping at the header and restarting one row down. `colorControls`
        exports `COLOR_RAIL_WIDTH`/`COLOR_RAIL_COLLAPSED_WIDTH` and `Configurator` sizes
        `brandWidth` from those constants — a magic 198 in two files is a broken line
        waiting to happen.
      - **`TopNav`'s `railCollapsed` must be set for BOTH narrow-brand cases**, not just
        the Components rail: at 56px the wordmark overflows its own block by ~67px
        (measured) and spills past the divider. Hence
        `(outerRailVisible && railCollapsed) || colorColumnCollapsed`.
      - **Primitives AND Semantics collapse; Gradients does not.** This SUPERSEDES an
        earlier "scoped to Primitives" decision — there is ONE column here that changes
        what it LISTS per tab (families / token categories), so a collapse that held on
        one tab and silently reverted on the next read as two different columns. Semantics
        collapses all three of its 198px cells the same way Primitives does: the `Groups`
        header keeps only the toggle, the `Token architecture` strip keeps only
        `ArchitectureSelect`'s glyph (`compact` prop — same "drop the label, keep the
        glyph" shed, and the popover it opens is untouched, so the architecture is still
        fully selectable while collapsed), and the category nav becomes a strip of `w-10
        h-8` glyph buttons whose tooltip now LEADS with the category name, since the label
        it used to sit beside is gone. Gradients stays wide on purpose: its rail is the
        gradient list, whose rows are named swatches with nothing glyph-sized to collapse
        to — so `colorColumnWidth` re-widens there while the preference is remembered for
        when you come back. Verified end to end: 56 → 198 → 56 on Semantics, brand block
        56px → 198px on Gradients → 56px back on Semantics, and Primitives still 56 after
        the round trip.
      - **`RailToggle` and the two width constants live in `colorControls`**, not in
        either tab. They were `ColorPrimitives`-local while only Primitives collapsed; the
        moment a second tab needed them, the choice was a sibling import (Step3 →
        ColorPrimitives) or a forked copy. Same reason `TokenDetailsModal`/
        `DeleteThemeModal` already live there.
    - **The promoted quick-edit strip** sits above the table, contextual to the active
      family: a `<Family> color` label + hex field in a bordered pill (`HexCell` wrapped in
      a `rounded-[13px] border-line-strong` container — matches the weight of a `ColorSelect`
      dropdown rather than reading as a bare table cell), a full-size `ScaleRow` of the
      family's ramp in the previewed appearance, and the scale-settings gear. No wand lives
      inline here — the gear is where BOTH harmony toggles (Neutral↔Accent, States↔Accent)
      actually live (see the accent↔neutral/states link note further down): a control that
      only renders while Accent is active shifted the ramp beside it 52px on that one
      family, which is why neither toggle is in the strip itself. Read-only (hex field
      hidden, `ScaleRow` still shown) for Accent-Alpha.
      - **A per-family "reset to default" sits at the pill's trailing edge** — the slot
        `pr-1.5`/`gap-1` already reserved, and the same position the token tables put their
        per-row reset, so it's a gesture already learned. Scope is deliberately ONE family,
        not the colour system: `HomeActions`' "reset the whole system to defaults" was
        removed from the UI on purpose (see the Navigation model note) and this does NOT
        reintroduce it — it's the same class as the per-token reset icons that note
        explicitly keeps.
      - **The target comes from `makeDesignDefaults()`**, the same factory a brand-new
        system is seeded from, never a hex table in the component — so "reset" can't drift
        from what "default" means. Built once per mount (`useMemo`): the factory also
        builds gradients and ramps, and there's no reason to redo that per render.
      - **It routes through `changeFamilyBase`, not a direct setter.** A reset has to
        cascade exactly like a hand-edit — the neutral/states links, the page derived from
        the base — or the two paths drift into different results for the same hex.
        Verified: resetting a green accent to `#9522e9` moved the linked neutral
        `#767f6c → #776c7f` and the page `#fdfefb → #fefdff`, left the states alone
        (their link was off), and left `primaryScale[9] === primaryDarkScale[9] ===
        '#9522e9'` — i.e. the ramps genuinely regenerated with tone 9 still the anchor.
      - **No button where there's no default to return to** — a custom family was invented
        by the user, and an alpha twin is solved from its solid rather than set. Those
        render nothing rather than a dead control. At the default the button is *disabled*,
        not hidden: a control that vanishes once used reads as broken, while disabled says
        "nothing to undo" (verified on Error, which ships at `#f04438`).
    - **"Edit in Picker Color" is gone** — with the quick-edit strip living on the same
      screen as the table, selecting a family in the nav already surfaces everything that
      link used to jump to. The `onEditInPicker`/`pickerFocusTarget` prop chain
      (`ColorHub` → `ColorPrimitives`, `Configurator.tsx` state) was removed, not repurposed.
    - Families table: Accent/Accent-Alpha/Neutral/Error/Success/Warning/Info + custom
      families in that side nav, 12 tone rows each with **light/dark** cells (row names are
      the EXACT exported token names — `accent-1`…, matching tokenGenerator's flattenScale
      prefixes — `accent-a-1`… for Accent-Alpha), eye toggles on the column headers driving
      `previewTheme`, a per-row **Token Details** dialog (skipped for Accent-Alpha rows),
      and "+ Add" creating a `customColors` family — EVERY family carries both a light ramp
      and a dark twin (Radix two-scale model), and each column edits its own; **no inversion
      anywhere**, step N means the same role in both.
    - **"+ Add" picks a DESTINATION FOLDER, and that's a role assignment, not a label.**
      The selector (`FAMILY_GROUPS`: Accents · Neutrals · States · Custom) is pre-set from
      the group of the family you opened it on, so adding a second accent while Accent is
      selected lands under Accents instead of Custom. Because folders are derived
      (`familySlotFor`), anything but Custom **mints a theme** identical to
      `DEFAULT_THEME_SOURCES` except the one slot pointing at the new family — the same
      move `NewTokenWizard`'s "secondary accent" makes, and the only non-destructive one
      (re-pointing an existing theme's slot would repaint the user's current accent). The
      popover states that consequence inline rather than hiding it. **States asks which
      intent** (error/warning/success/info) — it's four separate slots, so a single
      "States" destination would be ambiguous.
    - The suggested name follows the destination (`Accent 2`, `Neutral 2`, `Error 2`,
      auto-incrementing past whatever exists) and is fully editable; changing the
      destination re-suggests **only while the user hasn't typed their own** (`addNameDirty`)
      — re-suggesting over a typed name would silently discard it. Custom keeps the empty
      field + "e.g. Teal" placeholder, unchanged.
    - **Consequence worth knowing:** a family created into Accents/Neutrals/States is then
      referenced by that minted theme, so `removeCustomColor` refuses it (the nav's trash
      shows "In use by theme X — remove the theme first"). That's the pre-existing
      in-use rule, not a special case, but it does mean a non-Custom family isn't deletable
      in one click the way a Custom one is. The nav's per-row pencil (hidden for
      Accent-Alpha, see above) is a deliberate SINGLE-family change and never cascades to
      Neutral (`changeFamilyBase` → `applyAccentColor(hex, false, …)`) — the quick-edit
      strip's wand is the "move several together" affordance now, not a usage-table
      side effect.
  - **The "Background" swatch is REMOVED, not disabled.** It used to sit in the quick bar
    as `DerivedBackgroundField` — a read-only readout of `pageBackground`/`darkBackground`
    for calibrating tones 1–2 — but it looked exactly like its interactive `ColorSelect`
    neighbors (same trigger shape) while doing nothing on click, which read as broken. Cut
    entirely rather than left disabled, so the UI doesn't promise interactivity it doesn't
    have; a real background picker is still out of scope (see "Base drives the page" above
    — independent editability there is what caused page/ramp drift before).
  - **Semantics** (`Step3_SemanticTokens`). **Categorical is the only
  architecture** (`semanticArchitecture: 'flat' | 'categorical'`,
  `lib/semanticArchitectures.ts`) — Astryx, shadcn/ui, Apple-HIG Vibrancy,
  Material-3 Tonal and IBM Carbon were each implemented here as alternative
  projections, retired from the picker in store v50, and DELETED outright
  (code, tests, vendor deps, migration bucket) once nothing pointed at them —
  see the note further down. There is no `ArchitecturePicker` radio-card UI
  any more; `semanticArchitecture` exists mainly so `'flat'` (the underlying
  89-role matrix `themes[theme]` holds) and `'categorical'` (the projection)
  stay distinguishable types. Selecting Categorical re-derives the WHOLE
  view from its projection via `buildArchitectureView` — sidebar groups,
  counts and a value table mirror the exported schema exactly. The table is
  **editable**, through the row's sliders icon (description + CSS var + a ramp
  per mode with the current tone ringed), exactly like the flat matrix — one
  interaction to learn, not two. A family row above each ramp re-points the slot
  to another family. Edits are stored as REFs in
  `architectureOverrides[arch]['category.token'][mode]` (`mode` is a THEME KEY,
  see below) so an edited token still resolves through the ramps. "Reset to
  schema" clears it; the export applies the same overrides, so tokens.json
  can't disagree with the table. Switching architectures resets category/search
  state.
    - **"+ Theme" works in Flat and Categorical.** `ArchitectureView.modeKeys`
      is the authoritative column list: Categorical gets one column per entry
      in `themeOrder` (adding a theme genuinely grows the table, resolved
      per-theme via `scaleLookup(scales, themePalettes[key], kind)`), same as
      the flat matrix. (The deleted Vibrancy/Tonal architectures always
      reported a fixed `['light','dark']` regardless of `themeOrder` — their
      math was a binary transform of the global primitives with no per-theme
      concept, so "+ Theme" stayed hidden there. Moot now; every architecture
      that exists supports it.) Each column's header is the SAME
      click-to-preview affordance the flat matrix's columns use (no
      drag-reorder/resize for the arch table though — it's schema-order, not a
      user-arranged matrix).
    - **Exports ADDITIVELY.** `colors.architecture.tokens[group][token]` used to
      be a hardcoded `{light, dark}` pair; it's now `{[themeKey]: ref}` with
      `light`/`dark` always present (any consumer reading `.light`/`.dark` sees
      identical values to before) and extra theme keys only when the system
      actually has them — no schema-version bump, no migration needed for the
      2-theme case. Was ALSO fixed in the same pass: `tokenGenerator.ts`'s call
      to `projectArchitecture()` had been omitting `overrides` entirely, so
      table edits in Categorical never reached the actual export
      — only the live preview table. Both `overrides` and `themeOrder` are now
      passed through.
    - **A solid fill and its ink are ONE decision, solved per theme against real
      hexes.** The curated architectures (Categorical · Astryx · shadcn) all share
      `projectCurated`/`curatedRefs` (`semanticArchitectures.ts`) and two markers that
      never escape that module: `{accent.solid}` → the accessible fill step, and
      `{on:<fam>.<tone>}` → whichever of `INK_REFS` (`{neutral.1}` near-white ·
      `{neutral.12}` near-black) actually clears WCAG AA on that fill, via
      `solidInkPair()` (`colorUtils.ts`). Exported refs are still plain
      `{family.tone}` — the contract and `refToView`'s grammar are unchanged.
      This replaced two independent bugs that both shipped inaccessible pairs:
      **(1) the tone was solved on the wrong ramp** — one
      `accessibleSolidTone(scales.brand)` index computed off the LIGHT ramp was
      reused in every theme column, where `{accent.N}` resolves against THAT
      theme's ramp (measured, accent `#c76aff`: 4.60:1 light / **4.07:1 dark**
      from a single shared index; and since "walk up until white passes" lands on
      11–12, which on any dark twin is the near-WHITE end, white ink there is
      unreadable). **(2) the ink was assumed, never checked** — `accessibleSolidTone`
      searches against literal `#ffffff` while the shipped ink is `{neutral.1}`,
      the page, a hair darker (accent `#fff3b0` measured **4.44:1** in light while
      the search believed it passed). Astryx's hand-patched `on-warning:
      {neutral.12}` was this same rule written once as a special case; it's now
      derived. After: those cases read 17.3 / 6.4 / 11.7 / 13.6 : 1 in BOTH
      columns, and the fill stays on the anchor (step 9 — the user's actual brand
      colour) instead of being darkened toward near-black, because flipping the
      ink solves it more cheaply than deepening the fill.
      **Target is AA (4.5), not AAA (7)** — deliberately: it's what the rest of the
      system already guarantees (ramp step 11 is generated to ≈4.5, `chromeAccent`
      walks to 4.5), and 7:1 would force nearly every brand button to step 12.
      `solidInkPair` returns the ramp's **argmax** when nothing clears the target,
      rather than a fixed step-12 fallback that could be worse than the ramp's own
      best. `accessibleSolidTone` is untouched and still correct for the flat
      catalogue, which does resolve per-ramp — don't reach for it where the ink
      isn't literally white or the ramp isn't the one the tone is read from.
    - **Ink on a same-family TINT is tone 12, not 11.** Tone 11 is generated to
      clear ≈4.5:1 against the **PAGE** (`lightnessForContrast` vs tone 1), so the
      moment it's placed on tone 2–3 — a tint a step or two darker than the page —
      it lands *under* AA. Measured on Categorical's `status.*-bg`/`status.*-fg`
      with tone 11 ink: 4.07 / 4.28 / 4.21 : 1 (error / warning / success). Tone 12
      is Radix's high-contrast text step and survives the tint: ~11:1 in both
      appearances, worst case across three seeds per family. This is why
      `status.*-fg` is tone 12 while `content.secondary` (which sits on the PAGE)
      correctly stays at 11 — the rule is about what the ink SITS ON, not about
      the role's importance.
    - **`status.*-fg` is SOLVED against its own `-bg` (`{ink:<fam>.<tone>}`), not
      pinned to tone 12.** Tone 12 is the right answer for the tone-3 tint the schema
      ships — and ONLY for that. Nothing tied the ink to the fill, so re-pointing a
      `-bg` left the ink behind: measured on a real hand-edited pair (bg `error.5` /
      fg `error.9`) that read **3.30:1**, under AA, with nothing in the system
      objecting. `{ink:…}` is a THIRD marker beside `{accent.solid}` and `{on:…}`,
      substituted in `curatedRefs` and nowhere else.
      - **It is NOT `{on:…}`, deliberately.** `{on:…}` picks between `INK_REFS`
        (near-white / near-black), which is right for a SOLID fill and wrong here: a
        status message is meant to read dark-red-on-pale-red, not black-on-pale-red.
        `{ink:…}` keeps the FAMILY and solves only the step.
      - **Targets AA — but never by falling back on the tone-12 TEXT END, and
        that exception is a deliberate, informed accessibility tradeoff.**
        Walking up, it returns the first tone clearing AA *below* tone 12; if AA
        is only reachable AT 12, it drops to the subtlest tone clearing
        `STATUS_INK_TARGET` (**3:1**) instead of snapping to near-black.
        - **Why the two appearances need different treatment, measured:** on a
          DARK ramp the tint IS the dark end, so a vivid tone clears AA on its
          own — light path never triggers, dark resolves 10 / 9 / 9 at 5.26 /
          6.60 / 5.74. On a LIGHT ramp the tint (3–5) and the vivid tones (9–11)
          sit on the same side with too little luminance between them: tones
          9–11 read **2.39–3.98:1** on the tint, and deepening the tint makes it
          *worse*, not better (fg 11 vs bg 1→5 = 4.50 → 3.01). Nothing but tone
          12 clears AA in light. That's ramp geometry, not a solver bug — don't
          go looking for a bg tone that fixes it, there isn't one.
        - **The owner reviewed those numbers and chose the vivid look over the AA
          guarantee in light.** Result: light resolves 9 / 11 / 11 at **3.1 / 4.0
          / 3.9 : 1** — under AA for body text, over WCAG's 3:1 floor for large
          text and non-text. Dark is unaffected and still clears AA.
        - **`ContrastFlag` still measures against AA, not this target**, so every
          under-4.5 pair keeps reporting itself in the Status preview (verified:
          three flags in light, zero in dark). The lowered target changes what
          the system PICKS, never what it CLAIMS.
        - **Scoped to this solver.** `solidInkPair` (ink on a solid brand fill)
          still targets AA — a button label has no reason to inherit this.
      - **That dark result is also the Astryx alignment.** Astryx's `status.error` is
        tone 9, and solving for AA against the tone-3 tint lands on 9–10 in dark on
        its own — so the two architectures converge without Categorical copying a
        value that would fail as text (tone 9 on tone 3 in LIGHT measures ~3:1, which
        is exactly the trap the earlier `StatusSpecimen` fix documents).
      - **The system assigns, the user still overrides.** `architectureOverrides` are
        applied AFTER the projection, so a hand-picked ref wins over the solved one —
        same "hand-edit wins" contract as `linkNeutralToAccent`/`linkStatesToAccent`,
        and "Reset to schema" hands the row back to the solver. Verified: the markers
        collapse to plain `{family.tone}` refs, so nothing named `ink:` reaches the
        table, the export or `refToView`'s grammar.
    - **Categorical's `status.*` dark column was a `13 − n` mirror, and it was the
      worst live contrast bug in the app**: `bg {error.11} / fg {error.7}` measured
      **1.76 / 1.09 / 1.29 : 1** — a mid-tone ink on a near-text-tone fill, i.e.
      invisible. Same class as the `surface.page` flip this file already documents;
      it just survived that pass because it's a separate pair of rows. Both columns
      are identity now (`scaleLookup` swaps in the dark twin, so tone 2 means "the
      subtle tint of THIS page" in both). If you write `13 − n` in a dark ref,
      that's the bug.
    - **A tone that means "solid" is not a text tone.** shadcn's
      `muted.foreground` was tone **9** in both appearances — fine-ish on the light
      ramp (3.86:1) and broken on the dark one, where tone 9 is a mid-grey on a
      barely-lighter tone 3: **2.89:1**. Now tone 11, the designated low-contrast
      text step (4.22:1 dark). Not 12 — that's `foreground`'s own tone and would
      erase the muted/default distinction shadcn's contract exists to draw.
    - **Known, accepted residuals** (measured, not oversights): text on a step-2/3
      surface runs a little under 4.5 system-wide, because tone 11 is solved
      against the page — flat's own `content-primary` on `background-secondary` is
      4.06 light / 4.47 dark, and shadcn `muted` is 4.22 dark. Categorical's
      `action.secondary`/`content.accent` (the soft "Secondary" button, accent.3 +
      accent.11) is 3.61 / 4.01: fixing it means moving `content.accent` to tone
      12, which also darkens accent text on the PAGE and costs the accent its
      character — a design call, not a bug fix, so it's left alone deliberately.
      **The flat catalogue's own status pairs are worse and NOT fixed here**:
      `background-error-primary`/`content-error` measures 2.48 light / 3.28 dark
      (warning 1.81 / 4.80, success 2.03 / 4.20), because flat pairs a tone-2 tint
      with a tone-**8** ink. Flat roles are MATERIALIZED into `themes[theme]`, so
      re-pointing them needs a `clearSemantics`-style migration (the v43
      precedent) — don't change `Role.tone` without one. ·
  **Gradients** (`StepGradients`). `colorTab` is local `useState` in `Configurator`.

> **A Kit has ALWAYS been the whole system — the popover just never said so, and
> that read as a bug.** `captureSnapshot` copies every key of `makeDesignDefaults()`
> (`SNAPSHOT_KEYS` is derived from it), so typography, radius, spacing, shadows, grid,
> sizes, gradients and icons were in every saved kit from the start. But the only per-kit
> signal on screen was a colour dot pulled from `primaryColor`, and the footer read
> `Active: #9522e9` — both point at colour, so `KitsPopover` *looked* like a palette
> manager. Reported as "Save is only saving the color part", which was never true of the
> data. **Verify before you 'fix' this class of report**: a fresh save measured 54 snapshot
> keys with `typography.fontFamily: Roboto`, all 5 radius steps, 6 spacing, 6 shadow, 9
> grid, 6 sizes, 3 gradients. The bug was the UI's silence, not the store.
> - **A kit row EXPANDS to real values, and that is the ONLY thing that states the scope.**
>   `kitFacts(snapshot)` reads the accent + family count, the font families, radius/spacing
>   steps, the theme list and the icon library straight off that kit's own snapshot, so the
>   facts differ per kit and a kit named after a font can be SEEN to carry it. Only the open
>   kit's facts are built (`openKit === kit.id ? kitFacts(...) : null`).
>   **A header sentence saying "saves all 8 foundations: Color · Typography · …" was tried
>   and REMOVED — don't re-add it.** It's the weaker half of the same fix: a static line
>   that never changes is one more claim to take on faith, and it said exactly what the
>   first kit's own open summary proves with real values two rows below. Shipping both was
>   the over-explaining this file's design principles warn about; the evidence won.
> - **The FIRST kit starts open, the rest collapsed, with a chevron to toggle.** With the
>   scope sentence gone this summary is the only thing distinguishing a kit from a palette,
>   so it can't be something you have to go looking for — but opening all of them would
>   bury the list. One at a time: the list scrolls inside its own region (sized by
>   `usePopoverPlacement`, see below — not a fixed box any more), and a second open kit
>   pushes the one you just opened's actions out of view. The popover unmounts on close, so
>   every open re-seeds on the top kit. The chevron LEADS and the colour dot moved inside
>   the same button behind it — the glyph is what says the row discloses something (the
>   position `AboutAccordion` and the preview panel's `DocRow` both use), the dot is the
>   kit's identity, not a control, and putting both in one target means no half of the row
>   looks clickable without being so.
> - **Clicking a row expands; it no longer loads.** Two reasons, and the second is the
>   load-bearing one: the row now owns three destinations (edit · review · sync), so "the
>   row" can't mean one of them — and loading REPLACES the system on screen, unsaved edits
>   and all, which used to happen on a single unlabelled click on a row you were only
>   trying to read. `Load & edit` (→ Variables · Color) and `Load & review` (→ Docs'
>   whole-system Overview) say the word "Load" for exactly that reason. Both must load:
>   the editor and the docs both render the LIVE store, so there is no way to show a kit
>   without making it current.
>
> **Saving a Kit asks "all themes or just one" — but only when that's a real
> question.** `KitsPopover` (`HomeActions.tsx`) used to always save the FULL
> current snapshot via `saveCurrentSystem()`, silently carrying every theme
> the system had. Reported as: needs to ASK, since "save this kit" and "save
> this one theme" are genuinely different intents once a system has more than
> the default light/dark pair (e.g. a client hands you three brand themes and
> you want ONE of them as its own standalone kit).
> - **The choice only renders when `themeOrder.length > 1`.** With one theme
>   there's nothing to choose between — showing a segmented control anyway
>   would be a confirmation dialog for a decision that was never in doubt,
>   which is exactly the kind of over-explaining CLAUDE.md's own design
>   principles already warn against ("labels should be identifiers, not
>   tutorials... skip the description when it's obvious from context").
> - **"Just one theme" defaults to the PREVIEWED theme**, not always 'light'
>   — `previewTheme` is threaded into `HomeActions`/`KitsPopover` as a prop
>   (it's local state in `Configurator.tsx`, not store state, so it has to be
>   passed down rather than read via `useDesignStore()`).
> - **`scopeSnapshotToTheme(snapshot, themeKey)`** (`useDesignStore.ts`) is
>   the actual narrowing: `themes`/`themeOrder`/`themeKinds`/`themeSources`
>   keep only the chosen key, and `architectureOverrides` drops every mode
>   entry that isn't it (an override is keyed `architecture → category.token
>   → THEME KEY`, so leaving other themes' overrides in would orphan them —
>   ref data pointing at a theme the saved kit no longer carries).
> - **Every PRIMITIVE stays untouched, deliberately.** A theme is "a READING
>   of the primitives, never a place to set colour" (see that note above) —
>   scoping the reading down doesn't require touching what it reads FROM. A
>   custom family minted only for a now-dropped theme survives in the kit as
>   an unreferenced primitive rather than being cascade-pruned; once no
>   theme's `themeSources` points at it, the family nav's own delete lock
>   already opens on its own (the same "in use by theme X" rule every other
>   family-deletion path follows) — that's the existing, discoverable
>   cleanup path, not a reason to add a second, silent one here.
> - **`saveCurrentSystemAsTheme(themeKey, name?)` shares `buildSavedSystemEntry()`
>   with `saveCurrentSystem()`** — same id rule (repo id when GitHub-
>   connected, else a slug of the project name), so the popover's existing
>   "reusing a name updates that kit" copy stays true for a scoped save too;
>   this doesn't invent a second naming convention to learn. **`name` is the ONE
>   exception**: when passed, it overrides the entry's `name` AND the local id
>   slug (`local:<slug(name)>`), so the kit is filed under that name instead of
>   the project's. The Kits popover omits it (a scoped save there updates the
>   project's own kit). The Export wizard opened for one theme passes the theme
>   label — see the "snapshot names itself after the theme" note under the
>   ExportWizard section — so that snapshot registers as its own kit
>   (`local:apollo`) rather than overwriting `local:<project>`. A connected repo
>   still pins the id, so `name` only ever moves the local slug.
>   Verified: saving "just Dark" from a 3-theme system produced a snapshot
>   with `themeOrder: ['dark']`, `themes`/`themeKinds` holding only `dark`,
>   every stale `architectureOverrides` entry for the dropped themes gone,
>   and `customColors` still carrying all 6 families untouched. Loading that
>   kit back rendered the Semantics table with exactly one column and no
>   crash — `themeOrder.length === 1` is already an ordinary resting state
>   elsewhere in the app (every "> 1" guard, like the per-theme delete lock,
>   already assumes 1 is valid), not a new case this feature had to teach
>   the rest of the app to handle.
> - **The popover CAPS its own height to the room below the trigger, via
>   `usePopoverPlacement(anchorRef, …)`** — the same hook `ThemePanel`'s slot pickers use for their
>   header/scrolling-body/pinned-footer shape. Before this, the outer `motion.div` had no
>   height limit at all: its natural height (header + kits list + the System library door)
>   just grew with however much content there was, and nothing capped it to the viewport.
>   Reported as "System library needs to stay reachable once there are many kits" — measured
>   first, and the real trigger turned out to be viewport height more than kit COUNT: with
>   15 kits the popover wanted 682px, and on an ordinary 650px-tall window the door's
>   bottom edge landed at 772px — 122px past the bottom of the screen, with no scrollbar
>   anywhere to reach it. It wasn't clipped, it was simply gone.
>   - **Only the kits list gives up space.** The header form (name input · scope toggle ·
>     durability paragraph · Connect GitHub) and the System library footer are both
>     `flex-shrink-0`; the kits list is `flex-1 min-h-0 overflow-y-auto` (replacing a fixed
>     `max-h-64`) — the ONE region allowed to shrink when the popover's capped `maxHeight` is
>     tighter than everything wants. That's what makes "System library fixed at the bottom"
>     literally true regardless of kit count: it can never be pushed off by a long list, only
>     the list itself scrolls.
>   - **`flex-1` here does NOT stretch the list to fill idle space on a tall screen — verify
>     this before trusting the diff.** It looked like it might: measured on a 900px viewport,
>     the kits box grew from a fixed 288px to 326px. But that's `flex-shrink` reclaiming
>     space CSS already owed it, not `flex-grow` inventing new space: 15 kits' rows have a
>     natural (uncapped) content height of ~1045px, which exceeds ANY reasonable popover
>     max-height, so the box is always in "give some back" mode, never "stretch to fill".
>     Confirmed empirically with ONE kit (a short list): `kitsBoxHeight` measured 287px
>     against its own `<ul>` content height of 286px — 1px of slack, not a stretched region
>     with dead space at the bottom.
>   - **Anchored to the TRIGGER pill (`kitsBtn`, threaded in as `anchorRef`), not the
>     popover's own ref** (`ref`, used only for outside-click detection) — measuring the
>     popover against itself would be measuring the very box being sized.
- **System library manages saved systems** (`SaveView` → `exportMode 'save'`; no nav entry
  since the rail was removed). Its center is intentionally only the saved-systems grid
  (browse/load/delete, plus create/import); it does not preview, copy or download export
  files. The right aside is `SaveSidePanel` ("Current system"): identity, quiet delivery
  status, summary chips and the local `saveCurrentSystem` action. Figma and GitHub links
  are contextual handoffs, while every outward artifact is owned by Export.
- **Multi design system**: `savedSystems` (persisted registry) — two ways in. `saveCurrentSystem()`
  (the store action `SaveSidePanel`'s Save button AND the Export wizard's "Save this design
  system" card both call) upserts a LOCAL entry keyed `` `local:${slugify(projectName)}` ``
  when unconnected, or the repo id once one exists — so saving never requires GitHub. A
  successful push (`GitHubConnectView`) upserts the same shape keyed by `owner/repo`,
  `{ id: repo, name, description, repo, savedAt, snapshot, source }`. `loadSystem(id)`
  restores a deep-cloned `DesignSnapshot`; `startNewSystem()` resets to `makeDesignDefaults()`.
  GitHub (PAT identity) is "the account" for the GitHub-backed half — no separate auth
  backend. Removing an entry is local-only either way.
- **Section sub-rail = `SectionRail.tsx`** — now **Components' rail only** (Variables uses
  `FoundationIconRail`; Docs uses no outer rail at all, see the Navigation model note):
  200px, transparent over the brand gradient, uppercase group caption + `icon · label` rows
  (active = raised white row in the UI accent). It's fed ONE group — **Categories** (icons
  from `CATEGORY_ICONS` in `Configurator`), straight from `CATEGORIES` — and no global nav
  and no action block; those live in `TopNav`: **Export** is the ONE filled payoff action,
  while the hamburger-shaped **Workspace settings** control contains connection state and
  appearance. Its GitHub row opens the same `GitHubConnectView` used everywhere else —
  PAT/OAuth connect → pick/create repo → explicit push of
  tokens.json/variables.css/README.md and `.escala/system.json`; it never pushes on
  menu open or row click. The Export wizard's step 2 also lists **GitHub repository** alongside
  Figma, Code and AI and hands off to that same view. `SaveSidePanel` retains its
  contextual entry point, so there is still only one GitHub pipeline. At widths below
  860px the four section links move into this same panel instead of overlapping Export;
  none are removed. Beside the
  rail, `ComponentsView` owns the 208px master list of that category's components (with the
  catalogue's include checkboxes). Don't fork the rail per section either — pass a
  different `groups` array.

> **The workspace tab bar's sync controls are TWO pills — one per destination —
> not a segmented group under a "Sync" caption.** `SyncPill` (`Configurator.tsx`).
> The old shape was `[ Sync | ⌾ | ⌘ ]`: a static caption spending ~45px to say
> something neither button disagreed with, two 32px icon-only squares whose names
> lived in a `title` (i.e. behind a hover), and a status dot stamped into each
> square's bottom-right CORNER, overlapping the very glyph it annotated. Reported
> as the row being too loaded. Splitting them gives the dot its own slot at the
> head of the pill and lets the label say the name out loud — the same "named,
> separately selectable destination" shape the workspace tabs (`Theme preview ·
> Variables · Code format`) already use one row up.
> - **The dot reports the LIVE request, not just "ever connected"** — `busy`
>   (amber, pulsing) and `error` (red) join `ok` (emerald) and `idle` (faint).
>   `githubPushState` / `figmaPublishState` already existed at this call site and
>   had nowhere to show; the corner dot could only ever say connected/not.
> - **Colour is never the only carrier.** `aria-label` and `title` both read
>   `"<name> — <status>"` in words ("GitHub — connected (owner/repo)",
>   "Figma — publishing…"), and those status words are in the es/fr dictionaries.
> - **The LABEL drops before the glyph does** (`hidden min-[1320px]:inline`) —
>   this row also holds three workspace tabs, so a pill still showing its mark and
>   its dot is a smaller loss than a wrapped label.
>
> **UPDATE: the Themes-library footer's `SyncTrack` (Sync · Push) is DELETED. Figma sync
> is a button in the CANVAS HEADER now, beside Inspect tokens; the footer is Reset.**
> Reported as the Figma button not being visible enough — and it wasn't: the handoff this
> product is largely about lived in a segmented track pinned to the bottom of the left
> rail, the least-looked-at corner of the workspace. Rules that came out of it:
> - **`FigmaSyncButton` (`ThemePreviewHub.tsx`) reuses `InspectorToggle`'s shell
>   verbatim** — same `h-8 rounded-lg border border-line p-0.5` outer, same `h-7
>   rounded-md px-2 text-caption` inner. Measured after: identical height, radius,
>   border, padding, font-size and ink, on the same row. It joins the existing action
>   cluster rather than inventing a third button language beside Reset and Inspect.
> - **It carries NO status dot, deliberately.** The Figma page it opens reports publish
>   state in full, and the connection rail carries it too; a third readout is the "two
>   doors to the same facts" duplication this hub already avoids. It says where it goes.
> - **It is a plain action, not an `aria-pressed` toggle like Inspect** — the surface it
>   opens replaces that header entirely, so there is no state left for it to reflect.
> - **The mark renders at 14 against Inspect's 16.** `FigmaGlyph` is a 38×57 mark that
>   fills its full height, so matching the square glyph's number reads visibly taller.
> - **Each theme's options menu gained "Sync with Figma"** (`ThemeOptionsMenu`, above
>   "Open in code"). It PREVIEWS the theme and SELECTS it as the sync target —
>   `defaultFigmaSyncModes([key], themeKinds)`, the same helper the initial state uses,
>   so it can't build a mode list the picker disagrees with. Previewing alone shipped
>   wrong once: the page opened on the clicked theme while File & modes still had the
>   previous one checked, i.e. a menu item on the Glass Copy row that would have
>   published Core. The FILE NAME is left alone on purpose — one Figma file carries a
>   column per theme, so the name belongs to the file, not to whichever theme is checked.
> - **Nothing was orphaned.** Figma: canvas header, the per-theme menu, the connection
>   rail, Docs exits, the Export wizard. GitHub: the connection rail's own row,
>   `SaveView`, the Export wizard's GitHub destination, Docs exits. Both verified before
>   the track was deleted.
>

> **The token search field lives in TopNav's right cluster (before Language +
> Appearance), NOT in the workspace tab strip.** It sat in the tab strip for a
> while — the argument being "per-workspace tool, not global chrome" — and moved
> up at the user's call: it's the workspace's primary way to FIND a token, and
> the tab strip was already carrying two Sync pills plus three tabs (one row, four
> jobs). It is still CONTEXTUAL, not global — `Configurator` passes `search` to
> `TopNav` only on the Generator tab (`themesCanvas`), so About / Components /
> Docs don't render it. `colorQuery` / `colorSearchRef` / the ⌘K handler are
> unchanged (the handler already no-ops when the ref is null, which is every tab
> but Generator). Layout: the field is `flex-1 min-w-0 max-w-[14rem]` and the
> grid's right track is `minmax(min-content,1fr)` (was `minmax(0,1fr)`) — so when
> the window narrows the empty LEFT track yields first and the field SHRINKS
> rather than the right cluster overrunning the centred nav. Verified 1024→1440,
> no overlap. The ⌘K keycap `<img>` is `hidden min-[1180px]:block` — decorative,
> and 1180 is already this app's "things get tight" breakpoint.
>
> **The "Escala Tokens on GitHub" repo link lives in the FOOTER, not TopNav's
> global cluster.** It used to lead that cluster and was the odd one out on two
> counts: Language and Appearance change THIS session while that link leaves the
> app for the project's source (colophon material, not workspace chrome), and it
> put a GitHub mark in the header while a DIFFERENT GitHub mark — the user's own
> repo sync — sat two rows below, so one glyph meant two things on one screen.
> TopNav's right cluster is two controls now. In the footer it's mark + the word
> "Source" on the attribution line, at the attribution's own 10.5px.
> - **It uses `text-fg-muted`, NOT the `text-fg-faint` of the copyright line
>   beside it.** Faint measured **4.39:1** at 10.5px — under AA for small text.
>   The static line can sit that quiet; the one interactive thing in the footer
>   cannot. Now 7.16:1 light / 6.63:1 dark.
> - **`h-full` claims the whole 28px strip as the hit area** (WCAG 2.2 target
>   size — measured 61×31) without growing the mark or the type.

> **The Figma row inside `WorkspaceMenu` separates `sync`, `details`, and `download` because they are
> different intents at different frequencies.** Used to be one
> pill (`Plugin`) → one screen (`FigmaConnectView`, retired), three numbered steps
> stacked top to bottom every time: download the plugin, import it into Figma, sync your
> tokens. It also auto-published tokens the instant it mounted, on EVERY open — including
> opens where you only wanted to glance at the sync URL or flip the auto-sync toggle.
> Reported as wanting the flow split so checking status doesn't mean re-scrolling past
> install steps you finished once already.
> - **Sync now is the explicit publish action.** It displays the parent-owned spinner
>   inside the open settings panel, while the hamburger also becomes a spinner so progress
>   remains visible if the panel closes. **Details** opens the connection URL/status without
>   publishing; **Plugin v…** opens the .zip and install instructions. The panel dismisses
>   on outside click or Escape and respects reduced motion.
> - **`FigmaSyncView.tsx`** is read-only until **Sync now** is clicked. Parent-owned
>   request state keeps its button and the TopNav spinner coherent. Its hero leads with
>   connection status
>   (`figmaLastPublishAt` — Figma sync has no login/session identity the way GitHub does,
>   so "has ever published" IS the connection signal) rather than the install pitch.
> - **`FigmaDownloadView.tsx`** is Steps 1–2 unchanged, verbatim. **No auto-publish** —
>   downloading a file was never a reason to hit `/api/tokens`.
> - **"Update available" hint on the Download plugin row.** `src/lib/pluginVersion.ts` is
>   GENERATED + COMMITTED by `npm run bundle:plugin` (same treatment as `*Reference.ts`) —
>   it exports `PLUGIN_VERSION` (semver from the sibling plugin's `package.json`, for
>   display) and `PLUGIN_BUILD` (a sha256 of the plugin's shipped files: `manifest.json` +
>   `dist/code.js` + `dist/ui.html`, first 12 hex). `PLUGIN_BUILD` is the "did the plugin
>   actually change" signal — it hashes the SOURCE files, not the zip (a re-zip embeds
>   fresh mtimes, so the zip's bytes aren't stable for unchanged content), and it flips on
>   any real change without anyone having to bump the semver. The store carries
>   `pluginBuildSeen: string | null` (top-level global pref, NOT in `DesignSnapshot`, store
>   v58) — the build the user last downloaded, written by `FigmaDownloadView`'s download
>   `<a onClick>`. `WorkspaceMenu` and `FigmaDownloadView` both show an "Update" badge when
>   `pluginBuildSeen != null && pluginBuildSeen !== PLUGIN_BUILD`.
>   **`null` shows NOTHING** — a first-time user has no baseline to update from, and the v58
>   migration deliberately leaves existing sessions at `null` rather than guessing (guessing
>   `PLUGIN_BUILD` would suppress a real update; it self-populates on their next download).
> - **Each screen cross-links to the other** ("Haven't installed the plugin yet? Download
>   it" / "Already installed? Go to Sync") so landing on the wrong half first doesn't
>   dead-end anyone — the split trades one linear onboarding path for two focused
>   screens, and the cross-links are what keep a first-time visitor from getting stuck.
> - **`figmaShared.tsx`** holds what both screens still need (`FigmaLogo`, `Step` — the
>   numbered-procedure card Download still uses for its two real steps, `BackToEditor`,
>   `relativeTime`) so neither view duplicates that markup. `exportMode` gained
>   `'figma-sync' | 'figma-download'` in place of the old single `'figma'`;
>   `SaveSidePanel`'s own "Bring to Figma" (`onOpenFigma`) routes to `'figma-sync'` —
>   that button already sits next to a connection-status dot, so the status screen is
>   the closer match to its existing intent than the download screen would be.
  - **Variables no longer uses it.** The outer 200px column reserved for foundation
    switching read as wasted width once a foundation's own content (Color's family tree) also
    wanted a left column, and text labels for 9 well-known icons were redundant once the
    icons themselves were legible. `FoundationIconRail.tsx` replaces it there: a compact
    horizontal row of icon-only buttons (40.5px, `rounded-[13.5px]`, active = filled
    `accent-ui` circle + soft shadow, tooltip carries the name) docked in a `h-[52px]` row
    above `CenterHeader`, together with `HomeActions` (Kits — New/Import JSON retired, see
    the Navigation model note above) — Export used to sit beside it too, see the
    "TRANSVERSAL" note above for why it moved to `TopNav`. It reads the SAME `groups`
    shape (`VARIABLE_FOUNDATIONS` "Variables" + the rest as "Styles") `SectionRail` used to,
    just rendered as a row instead of a labeled column, so the menu/rail/toolbar data source
    still can't disagree. `Configurator.tsx`'s `outerRailVisible` (≠ `railVisible`) gates
    `TopNav`'s `brandWidth`/divider now — `null` on Variables (no column to align against),
    unchanged on Components. Freed width goes to whichever foundation is
    active; only Color has its own sub-nav to spend it on (see below), the other 7 foundations
    just render wider.
  - **`orientation="vertical"` is the Themes-workspace variant** — a 64px column, and it
    now sits BELOW a full-width `ThemeWorkspaceTabs` strip, not beside one. Its groups
    start at the top (`pt-2` on the `<nav>`, `pt-3` on the first group, `border-t`/`mt-3`
    on the Styles group). No header band of its own — see the note below. Glyphs are
    `h-[21px]` (bumped from 17 — too small against a 42px button).
    > **`ThemeWorkspaceTabs` (`Theme preview · Variables · Code format` + search + Sync) is
    > a FULL-WIDTH row on the Themes canvas — its left edge meets the Themes Library
    > column's border and its underline runs unbroken across the icon-rail column too.** It
    > used to be the first child of `<main>`, so it only spanned the editor column and the
    > icon rail carried its own 52px header band to fill the gap beside it. That band went
    > through two lives — a `theme-preview` button (retired: a second door to the screen
    > the tab strip already names, and the two lit up together, claiming "you are here"
    > twice side by side — same call as `ThemePreviewHub`'s retired `Code` icon) and then
    > an empty 52px spacer "for divider alignment", which was just reserved space the icons
    > could use. The fix for both: on `themesCanvas` the Layer-1 wrapper is `flex-col`, the
    > tab strip is its first child at full width, and `[FoundationIconRail | <main>]` sit
    > in an inner `flex` row under it (non-themes views keep the plain row via a
    > `display: contents` passthrough — `showPreview` is `exportMode === 'save'`, never true
    > here, so nothing else follows `<main>` on this canvas). The tab strip owns the header
    > row and workspace switching; the rail owns foundations and begins right below.
    > `ThemePreviewRailIcon` was deleted with the button.
- **Center**: a `CenterHeader` (section icon + colored title + subtitle) over the active
  body — a foundation section (`Step2_ColorPalette`…`Step9_Sizes` or
  `IconLibrary` with its live Iconify browser + custom-SVG upload, wrapped in `p-8` —
  **except Icons — every token foundation now renders FLUSH** (`RAILED_FOUNDATIONS` in
  `Configurator.tsx`: typography · radius · spacing · sizes · shadow · grid,
  plus Color's own hub). Each carries a 198px left column, and `p-8` framed them as
  floating cards whose column no longer lined up with the icon toolbar or `CenterHeader`
  above. Icons keeps its padding — it's an Iconify browser, not a token table.

  > **THREE SLOTS, and every Variables section uses the same three. There is no
  > control band above the table.** A section's chrome is: the **rail's Groups
  > section** (the global control — `Preset` · `Base unit` · `Roundness` — plus the
  > collections nav), the table's **Preview column** (one token, one swatch) and the
  > table's **`footer`** (the whole ramp at once, when a ramp is only judgeable by
  > comparing steps). Nothing else.
  > Radius and Shadow used to hand-roll a full-width band above the table instead —
  > a `w-[198px] border-r` label cell beside a specimen cell — and it was wrong on
  > every axis, measured: the 198px cell missed the 240px rail below it by **42px**,
  > the band pushed those two foundations' rails **108px and 125px** lower than the
  > other four's, their own two bands didn't even agree with each other (108 vs 125,
  > because the elevation strip is taller than a slider), and the `Groups` heading
  > they left behind had nothing under it. Six sections, five different answers.
  > - **A global control goes in `RailControl`** (`VariableCollectionRail.tsx`), never
  >   in a band. That is what puts it on the group rows' own footprint —
  >   13.5 → 225.5, caption at 22.5, readout right-edge at 216.5 — instead of a
  >   per-section inset. The rail had **four** different left edges inside one 240px
  >   column before this.
  > - **A group row is `RailGroupNav`**, one component. `SemanticGroupRail` is a thin
  >   wrapper over it, and Spacing/Sizes render it directly; they used to hand-roll
  >   `px-3 py-2.5` rows against the shared `px-2 py-2` ones.
  > - **No groups → `RailNoGroups`**, not a heading over nothing. Stroke and Grid
  >   genuinely have none.
  > - **`railed` is not optional.** Grid was the one section that skipped it, so it
  >   had no collections column at all — its table started 240px left of everyone
  >   else's and its own `Grid semantics` collection was unreachable.
  > - **Shadow's heading comes from `LayoutTabHeading`** even though Shadow is not a
  >   `LayoutFamily` and never passes through `LayoutHub`. Its table is still the
  >   primitive list; reading "Shadow tokens" while its six neighbours read
  >   "Primitive tokens" was the only place that vocabulary broke.
  > - **There is NO per-table header bar. The workspace owns search + heading.**
  >   `ThemeWorkspaceTabs` (the `Theme Preview · Primitives · Code Format` strip) is
  >   the ONLY `foundation-layer-bar` on screen — it carries the "Primitives" tab and
  >   a single "Search tokens" field (`colorQuery` in `Configurator`), and the rail's
  >   Collections section names the active collection (`RADIUS SEMANTICS` etc.). The
  >   old `VariablesTable` `topBar` + `LayoutSemantics`/`GridSemantics` header bars
  >   restated all three a second time, one row lower. They're suppressed whenever a
  >   `query` string is passed (Color and Type primitives/semantics already worked
  >   this way — `ColorPrimitives`/`Step3` render no bar at all): `VariablesTable`,
  >   `LayoutSemantics` and `GridSemantics` all take `query?: string`, threaded
  >   `Configurator → LayoutHub → the Step component / Sem`, and drop their bar +
  >   filter by it when it's set (even `''`). Leave `query` undefined to get the
  >   self-contained bar back — the non-workspace path, currently unused.
  **`ColorHub`'s own three tabs (Primitives/Semantics/Gradients) DIVERGE from this
  row order — deliberately, and only there.** They used to match it exactly
  (control-row first, `Groups`/`Collections`-row second), then got flipped: `Groups`
  + the tab bar + search now sit in ROW 1, and the per-family/-architecture/-gradient
  control strip sits in ROW 2, directly above the nav it edits — reported as wanting
  the nav's own header sitting immediately above the nav, not interleaved with the
  editing strip. Two things make this safe to do ONLY inside `ColorHub` and not to
  `VariablesTable` too:
  - **All three Color tabs share one `centerKey`** (`f-color` in `Configurator.tsx`),
    so switching between them skips the foundation-level fade — see the "FASE 1
    desync fix" note. That makes an identical row order across exactly those three
    tabs load-bearing: a mismatch reads as a hard jump with no transition to soften
    it. `VariablesTable`-based foundations (Radius/Spacing/Shadow/Typography/Sizes/
    Grid) each get their OWN `centerKey` and a real fade when you switch to them, so
    a different row order there isn't a "jump" the same way — it's just a different
    foundation, already announced by the transition.
  - **The swap was applied identically to all three** (`ColorPrimitives.tsx`,
    `Step3_SemanticTokens.tsx`, `StepGradients.tsx`) — same border-weight logic too:
    whichever row now sits directly above the nav + table keeps the full-strength
    `border-line`; whichever sits between the two chrome rows drops to the lighter
    `border-line/60`. Do not swap only one of the three, and do not swap
    `VariablesTable` to "match" — that would just move the mismatch onto six
    foundations instead of removing it from three.
  **`VariablesTable` opts in via `railed`** (plus optional `railBody`/`footer` — there is
  no `railTop`, and a section must NOT hand-roll one as a sibling `<div>`: that is the
  band the note above exists to keep deleted).
  So the gutter's CONTENT is per-section: Stroke and Grid leave it empty (`RailNoGroups`
  — the column still exists so their table's left edge lands on the same line as everyone
  else's), Radius and Shadow fill it with their preset, Spacing with its base unit ABOVE a
  `RailDivider` and a collections nav, Sizes with a nav alone.
  - **`footer` renders the section's visual specimen INSIDE the table's scroll column**
    (Sizes' component heights, Shadow's elevation ramp, Grid's column overlay). It
    can't be a sibling: once a section is railed the table owns its column, so a
    block outside would sit beside the rail rather than under the rows it illustrates.
    Grid's overlay renders only for the Layout collection — a breakpoint ramp has nothing
    to draw, and rendering it there would be dead chrome.
  - **Shadow's elevation ramp earns a `footer` where Radius' does not**, and the test is
    whether the Preview column can already carry it. Radius' 28px corner square shows a
    radius fine; Shadow runs `wideValues`, which leaves the Preview column 90px — too
    little for a 24px-blur `2xl` — and elevation is only judgeable by COMPARING steps.
    Its footer swatches carry **no border**, same rule as `ShadowPreview`: the shadow has
    to be the only separator or you're judging the border.
  - **The rail's dropdown is `ui/RailSelect`, one component, wrapped in `RailControl`.**
    Gradients' type, Radius' and Shadow's presets and Spacing's base unit are the same
    control, and it was hand-rolled three times (identical `h-9 rounded-[13px]
    border-line-strong` trigger, chevron and outside-click listbox) before being
    extracted. It takes `fallbackLabel` — Radius shows **"Custom"** when the ramp matches
    no preset, where the old Sharp/Soft/Rounded/Pill pill row just showed nothing
    selected, which read as "no preset applied yet".
  - Radius' presets, Spacing's base units and Shadow's presets all moved OUT of
    `VariablesTable`'s `toolbar` on the way here; on a narrow window those pill rows
    pushed search off the row,
  the **Docs destination** (`DocsView` — master list of Overview + the eight foundations,
  no outer rail; a foundation page is lead · Why · Usage · its live token sections · Ships
  as · prev/next), the **Components destination** (`ComponentsView` — outer category rail
  + a master list of that category's components; a component page is ONE canonical page
  per component: breadcrumb · Copy Page · Add to system · a live playground hero with a
  Preview/Code toggle · Usage · per-axis Examples · Accessibility · Ships-in-Figma ·
  Related · API Reference · prev/next + an "On this page" TOC; fully data-driven from
  `COMPONENTS` + `SPECIMENS`/`snippetFor`, hides the right preview since it carries its own
  live specimen), `ExportView`
  (opened by Code / MD via an `initialTab`; has a "Back to editor" affordance + editable
  project name), `FigmaSyncView`/`FigmaDownloadView` (opened by Workspace settings' Figma
  row — connection status/live-sync guide, or the plugin zip + install steps,
  see the Navigation model's Figma-control note), or `GitHubConnectView` (opened by
  Workspace settings' repository row, Export wizard's GitHub repository destination, or
  `SaveSidePanel`'s contextual button; a successful push also upserts the system into
  `savedSystems`).
- **Theme lives in Workspace settings**: an explicit Light/Dark segmented control calls
  `changePreviewTheme`, so the previewed theme and app chrome flip together. The old
  standalone `ThemeToggle` is no longer mounted in the header. `previewTheme`'s
  `useState` in `Configurator.tsx` is
  **initialized from the persisted chrome theme** (`getTheme()`, `sd-theme`), not hardcoded
  to `'light'` — `previewTheme` itself still isn't persisted, but the chrome class is, so a
  reload while dark chrome was active used to start every previewTheme-driven surface
  (Alias/Semantics' theme selector, Picker Color's transparency scale, `PreviewPanel`) back
  on light until the toggle was clicked twice to resync. Any code that needs "is the preview
  dark right now" on first render must go through this init, not assume `previewTheme` starts
  `'light'`.
> **The aside is a THREE-TAB reference, not just a specimen — `Preview` · `Artefacts` ·
> `.MD` (`PanelTabBar` in `PreviewPanel.tsx`).** It's the only column that is always
> looking at the system you're editing, which makes it the cheapest place to reach the two
> things that otherwise cost a navigation: a real composed SCREEN built from your tokens,
> and the section's markdown (before: open `ExportWizard`, pick a scope, pick a format).
> - **The two non-specimen tabs are scoped DIFFERENTLY, on purpose.** `.MD` follows the
>   centre column — markdown for "the foundation you're editing" is the useful scope. An
>   **artefact is whole-SYSTEM**: it's the one view where every foundation is on screen at
>   once, which is the only way to see them working together. Switching foundations doesn't
>   change what the artefact renders; it changes which of those tokens you're about to move.
>   - **Color is the one foundation where `.MD` itself splits by SUB-tab, via
>     `mdWholeSystem`** (`Configurator.tsx` → `PreviewPanel`): Primitives and Gradients show
>     the WHOLE `design-system.md`, only Semantics narrows to `color.md`. Reported request,
>     not a guess: Primitives/Gradients are where you're still gathering broad context (an
>     AI agent, a handoff), Semantics is the one deliberate, focused task ("map THIS role to
>     THIS tone") where the noise of every other foundation's tokens gets in the way.
>     `mdWholeSystem` is computed at the CALL SITE, not inside `PreviewPanel` — the panel
>     stays foundation-agnostic (it doesn't know `ColorTab` exists), the same split
>     `focus`/`onEditColorGroup` already use. It only overrides `.MD`'s `section`; nothing
>     else reads `section` any more (the `Documentation` tab that used to was retired — see
>     below), so this can't leak into the artefact or the header title outside `.MD`.
>     Verified: Primitives and Gradients both read `design-system.md` in the file chip and
>     the header; Semantics reads `color.md`; an unrelated foundation (Radius) still reads
>     `radius.md`, untouched.
> - **A fourth tab, `Documentation`, was RETIRED for Artefacts** — the foundation's own Docs
>   page re-laid-out as an accordion (`DocsPane`/`DocRow`, deleted along with the
>   `onOpenDocs` prop and its `Configurator` wiring; `openDocs` itself stays, `DocsView`
>   still uses it). **Nothing was lost**: the Docs destination carries every one of those
>   pages at full width, with the TOC, prev/next and side-by-side ramps a 400px column could
>   never show, so the accordion was always the lesser copy of a page one click away. Don't
>   re-add it as a fifth tab — if the panel ever needs reference again, the answer is a link
>   to Docs, not a second rendering of it.
> - **Nothing here is re-authored.** `.MD` is the exact string `buildSectionExport(section,
>   'md')` hands the wizard; an artefact's every CONTROL is a catalogue `SPECIMENS`
>   renderer. So the panel can't claim something the export or the Figma plugin would
>   contradict.
> - **Only the active tab is MOUNTED.** `.MD` rebuilds a few hundred tokens of markdown and
>   an artefact runs a dozen specimens — neither may pay that while you're looking at the
>   other, in a panel that repaints on every token edit.
> - **`MarkdownPane` calls `useDesignStore()` for the SUBSCRIPTION, not the value**, and
>   deliberately does not memoise: `buildSectionExport` reads `getState()` itself, so the
>   bare call is what makes the pane live (verified — retinting the accent moves `accent-9`
>   here in the same frame it moves in the table). A `useMemo` keyed on the store object
>   would work too but adds a dependency the linter can't see is load-bearing, for a case
>   (`previewTheme` changing without a store change) that barely exists.
> - **Tab state is LOCAL to the panel**, unlike `previewCollapsed` (which is lifted because
>   TopNav sizes its brand divider from the column's width). Nothing outside reads it. It
>   survives foundation switches — the panel is a separate tree from the centre column's
>   `AnimatePresence` — and resets to `Preview` when the aside is handed to another panel
>   (`SaveSidePanel`, `ThemePanel`), which is the right moment to land back on the
>   specimen.
> - **The tab row is `h-[52px]`, the app's one row-2 height** — the same rule
>   `CenterHeader`, `SaveSidePanel` and this panel's own header follow, and the height
>   `ColorHub`'s Primitives/Semantics/Gradients tabs occupy, so the two tab bars land on
>   one line across the shell. It shipped at `h-9` first and read as a lesser, secondary
>   strip beside the centre column's taller one. **The LABEL still runs `text-[12px]`
>   against ColorHub's `text-[15px]` — matched height, not matched type**: that column is
>   ~800px for three short words, this one is 400px split into 133px cells. Height is what
>   lines the rows up; type size is what keeps the longest label from truncating.
> - **The theme badge shows on `Preview` AND `Artefacts`.** Both are painted in ONE theme,
>   so both can claim it; the markdown ships every theme's values, so it can't.
>   `iconLibraryKey` suppresses it on Preview only — a glyph sheet has no theme, but the
>   artefact is still painted in one even while Icons is the active foundation.

> **An ARTEFACT is a composed SCREEN — the thing a designer ships — built from the
> system's own components and foundations (`preview/artefacts/`).** `Preview` asks "what do
> my components look like"; an artefact asks "what does a real screen built from my system
> look like". **Five exist**, in a deliberate narrative order (`ARTEFACTS` in `index.ts`):
> `Login` → `Verify code` (OTP/2FA) → `Pricing` → `Checkout` → `Profile` — an onboarding-to-
> settings arc, not an alphabetical or by-category list. A new entry doesn't have to fit
> that arc; it just goes wherever it reads best next to its neighbours. The carousel's
> pagination dots and scroll-snap activated automatically the moment the second entry
> (`Verify code`) landed — no code changed in `CompactCarousel` to make that happen, which
> is the whole reason the registry existed before a picker did.
> - **Together the five deliberately cover ground `Login` alone couldn't**: `Verify code`
>   is the first live use of the STATUS ramp (`InlineAlert`'s `Status: 'Error'`); `Checkout`
>   uses the same component with `Status: 'Success'`, so the pair proves the ramp both
>   directions from one component. `Pricing` is the first to compose `radius` + `shadow` +
>   `Card` together. `Profile` is the first to use `Switch` (via `SwitchGroup`) and the
>   `Button`'s destructive `Color: 'Danger'` axis (verified: resolves to `rgb(170,80,69)`,
>   the ERROR ramp — independent of whatever the accent is, not a hand-picked red).
> - **Every control is a catalogue `SPECIMENS` renderer, never hand-rolled markup** — the
>   Color collage's rule, for the same reason: the artefact must not be able to drift from
>   what the Figma plugin ships. Verified live: retinting the accent moved the CTA from
>   `rgb(149,34,233)` to `rgb(42,122,75)`, and that's the SOLVED accessible solid, not the
>   raw hex typed in — i.e. it reads the resolved semantic like everything else.
> - **What the artefact DOES own is its prose** (page title, footer line). No catalogue
>   component provides those and a screen without them isn't a screen. That's the normal
>   split: the system owns the component, the composition owns the copy around it.
> - **`SpecimenProps.w` is how a control fills a column — a width, not a
>   re-implementation.** Every specimen carries a hardcoded px width tuned for the
>   Components playground canvas (Input 260, SocialLoginButton 280, Divider 220…), which is
>   right there and wrong in a ~328px mobile frame, where a 260px field reads as a broken
>   form. `w` is **opt-in and therefore provably inert** — every pre-existing call site
>   omits it (verified: the playground's Button still hugs its label at 90px with
>   `justifyContent: normal`, its Input still measures exactly 260). It is deliberately NOT
>   a fork: one renderer at two widths, the same call `PrimitiveRamp`'s container query
>   already makes. Everything deciding how a component LOOKS stays inside the specimen.
>   **Don't add `boxSizing: 'border-box'` alongside it** — Tailwind's preflight already
>   sets `border-box` on `*`, so it's dead weight (measured: a bare 280px div with a 1px
>   border renders at 280, not 282).
> - **`SpecimenProps.children` is the same move for COPY that `w` is for width — opt-in,
>   provably inert, never a fork.** A handful of specimens echo fixed prose that made sense
>   as a category demo and nowhere else: `Badge` printed its `Color` axis value verbatim
>   ("Brand", "Success" — fine as a demo label, wrong as a "Most popular" plan badge),
>   `TextLink` was one hardcoded sentence, `Card` a fixed title/body/link, `Button` the
>   literal word "Button". Building five real screens needed real words on all four, so each
>   now takes `children` and falls back to its old fixed copy when it's omitted — verified
>   against the live Components playground and the Color collage after the change: `Button`
>   still reads "Button", `Card` still shows "Card title / Supporting copy… / Learn more →",
>   `InlineAlert` still shows "Heads up / Semantic tokens re-derive…", byte-identical.
>   - **`TextLink` changes SHAPE, not just text, when `children` is given**: with it, only
>     the anchor renders (no "Read the …" sentence wrapped around it) — an artefact supplies
>     its OWN sentence ("Didn't get a code? `<TextLink>Resend</TextLink>`"), and wrapping
>     that in a second, unrelated sentence would double the prose.
>   - **`Card` keeps its own chrome — border, radius, shadow, the `inset-surface`
>     padding — and lets `children` replace only the BODY.** That's what makes it usable as
>     the pricing plan's real container: the token-driven surface is the reusable part, a
>     specific plan's name/price/features is composition, same "system owns the component,
>     composition owns the copy" split as `LoginArtefact`'s own prose.
>   - **`InlineAlert` and `SwitchGroup` also gained `w`** (defaults 320 / 260, same
>     opt-in/inert contract as everywhere else) — a status callout or a settings section
>     that doesn't span the mobile column reads like it's floating in a wider chrome that
>     isn't there.
> - **The frame is NEVER scaled.** It renders at whatever the column gives it — ~363px in
>   the 400px aside — which IS a real phone width (iPhone SE 375, older 320), so type,
>   control heights and radii are all at TRUE size and what you see is what ships. Scaling
>   a "390pt" frame down to fit would render a 16px label at 14.7px and quietly lie about
>   the type scale. `GridPreview` reaches the opposite conclusion for the right reason: it
>   draws a layout DIAGRAM, whose percentage insets stay a true scale model at any size —
>   an artefact contains type, which has no percentage equivalent.
> - **Every measurement resolves from the store; the artefact picks no numbers.** The page
>   inset is the system's OWN mobile grid margin (`resolveGridFrame('mobile', …)`), gaps are
>   spacing ROLES (`gap-group` is literally what the system calls "stacked fields"), and the
>   CTA is `Size: 'LG'` — the same `lg` primitive the `touch` size role points at, whose
>   description is "Mobile CTA. 48px covers HIG 44." Verified: moving Grid · Mobile's margin
>   from step 4 to step 10 took the frame's padding 16px → 40px and re-flowed every control
>   329px → 281px, live, without leaving the tab.
> - **A caption under the frame names the two numbers it's built from** ("Mobile · true
>   size · page margin 16px from Grid"). Without it, "this is at true size" and "that margin
>   is your Grid token" are both claims you'd have to take on faith.
> - **Plain rounded rectangle — no notch, no status bar, no simulated hardware.** Every
>   pixel of invented device chrome is a pixel that isn't a token, competing for attention
>   in a panel whose entire job is showing you tokens.
>
> **The Artefacts tab opens on a COMPACT carousel, not the true-size frame — a photograph,
> not a re-flow.** `ArtefactsPane` (`PreviewPanel.tsx`) holds one piece of local state,
> `expanded: Artefact | null`; `null` renders `CompactCarousel`, set renders the true-size
> `DeviceFrame` path (unchanged) behind an "All artefacts" back row. **`expanded` resets to
> `null` for free** — the Artefacts tab unmounts on tab switch (see "only the active tab is
> mounted" above), so leaving and coming back always lands compact with zero reset logic
> to write. Verified end to end: expand → switch to `.MD` → back to `Artefacts` → lands on
> the carousel, not the frame it was left on.
> - **`ScaledArtefactCard` (`preview/artefacts/`) is a PHOTOGRAPH, not a second layout.**
>   It renders `artefact.render({ t, compact: true })` at a fixed reference width
>   (`SOURCE_WIDTH = 375`, a real phone width — independent of the panel's own size, so the
>   thumbnail reads as "a shrunk phone" everywhere) and then shrinks the WHOLE rendered
>   result with `transform: scale()`. This is the resolution to `DeviceFrame`'s own "never
>   scaled" rule, not an exception to it: that rule is about layout — never re-flow a design
>   into a narrower box, which is what actually lies about the type scale (a squeezed 16px
>   label rendering at 14.7px). A post-layout CSS transform doesn't re-flow anything; the
>   frame still computes every value at its one true scale first, and the transform only
>   changes how large the finished photo displays. **Compact width is 240px** — deliberately
>   much smaller than the ~360px true-size frame (scale ≈0.64), so it reads as a thumbnail
>   rather than a slightly-narrower version of the real screen.
>   - **Height is MEASURED, never assumed** (`ResizeObserver` on the unscaled inner div) —
>     an artefact's height depends on live tokens (type scale, spacing, how long a value
>     runs), so a fixed guess would clip or gap. Renders at `opacity: 0` until the first
>     measurement lands, rather than flashing a wrong-height card.
>   - **`ArtefactProps.compact` exists so the caption doesn't lie.** `DeviceFrame`'s own
>     "Mobile · true size · page margin…" caption is a factual claim about ITS render — true
>     in the expanded view, false in a 0.64×-scaled photo. Every artefact's `render()` must
>     forward `compact` down to its own `DeviceFrame` call (see `LoginArtefact.tsx`'s
>     `LoginScreen`) or a new artefact will silently claim "true size" in its thumbnail.
>     Verified: compact card carries no `<p>` caption at all; expanded shows
>     "Mobile · true size · page margin 16px from Grid".
> - **`CompactCarousel`'s dots + prev/next are gated on `ARTEFACTS.length > 1`** — same "no
>   control for a choice nobody has" rule as `KitsPopover`'s one-theme case. With one entry
>   the strip just centers a single card (`justify-center`); the moment a second `Artefact`
>   is registered, both the pagination dots and the horizontal scroll-snap layout activate
>   with no further wiring — that's the whole reason the registry (`ARTEFACTS`) existed
>   before a picker did.
> - **Tapping a compact card is the ONLY way in; the whole card is the button** — no separate
>   "expand" icon competing for the same click. `title`/`aria-label` both read "Expand
>   {label} to actual size" so the affordance is announced, not just implied by a hover
>   scale (`hover:scale-[1.02]`).
> - **The tab title is always the literal string `'Artefacts'`, never the open artefact's
>   own label.** It used to read `artefact?.label` — correct-looking with one entry ("Login"
>   both compact and expanded), and secretly two different claims stacked on one line: with
>   more than one artefact it would have had to flip between "Artefacts" (carousel) and the
>   specific name (expanded) depending on a click, which is a title that moves under you.
>   The specific screen is already named on its own card caption and, expanded, is the only
>   thing on screen — the header doesn't need to repeat it.
> - **Both views CENTER their content in the pane rather than pinning it to the top.**
>   Reported as "on a bigger screen this looks like it has an infinite gap" — measured on a
>   1920×1200 window: 266px of blank pane below the expanded frame, because the frame is a
>   fixed, content-sized box inside a flex column that had nowhere to put the window's extra
>   height except below it. **This is not a spacing-token problem** — `gap-section`/
>   `gap-group` etc. were correctly sized the whole time; a design running proportionally
>   bigger gaps on a bigger MONITOR would break the exact "true size, what you see is what
>   ships" guarantee `DeviceFrame` exists to make (the monitor isn't the canvas the screen
>   ships on). The fix is layout, not tokens: both `ArtefactsPane`'s expanded branch and
>   `CompactCarousel` wrap their content in a `flex-1 min-h-0 flex flex-col justify-center`
>   div. `min-h-0` is the load-bearing part — without it a flex child can't shrink below its
>   content's height, so `justify-center` has nothing to center WITHIN and the content just
>   sits at the top regardless. When the frame doesn't fit even a tall window, the wrapper
>   grows past its flex-basis instead of clipping, and the pane's own `overflow-y-auto`
>   scrolls the whole column — centering can never trap the top of overflowing content
>   off-screen. Verified: spaceAbove/spaceBelow the frame landed within ~30px of each other
>   at 1920×1200, and nothing regressed at the normal 1440×900 window.

- **Right = `PreviewPanel.tsx`**: a **persistent, sticky specimen** of whatever foundation
  is being edited — **expanded by default** (`previewCollapsed` starts `false`; the slim
  strip still lets anyone collapse it for width). It's a separate tree from the center
  column's `AnimatePresence`/`motion.div` swap, so switching foundations or editing a token
  never unmounts or closes it — no stale-content risk of the kind the center body's swap
  had (see the FASE 1 desync fix above). A light/dark toggle drives the global theme.
  Renders token-driven atoms (`preview/atoms/*` + `ButtonPreview` + the catalogue's
  `SPECIMENS`) from `usePreviewTokens()`, so editing any foundation updates them **live**.
  Two independent axes of context-awareness, checked in priority order:
  1. **`focus`** — a **`SemanticFocus`** (`content`·`action`·`surface`·`status`·`border`,
     or `'all'`), reported by `Step3_SemanticTokens` via `onFocusChange` and held as
     `semanticFocus` in `Configurator`. Only set while `colorTab === 'semantics'`; each
     value renders its specimen from `SEMANTIC_SPECIMENS`
     (`preview/atoms/SemanticSpecimens.tsx`), which also owns the panel titles so a focus
     can't be half-wired. This replaced four flat-only atoms (`TextSpecimenPreview`,
     `BackgroundSpecimenPreview`, `BorderSpecimenPreview`, `ForegroundSpecimenPreview` —
     the last already dead, it previewed `icon-*` roles the catalogue dropped); they were
     deleted, not kept for reference, since the new module supersedes them entirely.
     Three things make this work that are easy to break again:
     - **Focus is NOT the table's nav selection.** They used to be one shared
       `semanticCategory`, typed to the FLAT catalogue's 3 groups — so a non-flat
       architecture (Categorical's Content·Action·Surface·Status·Border) had nowhere to
       put its selection, `selectNavItem`'s non-flat branch never called up at all, and
       an effect additionally pinned the focus to `'all'`. Net effect: **every non-flat
       architecture showed the generic `ColorCollage` no matter which group you picked.**
       Step3 now owns its nav state (flat + arch, separately) and reports a normalized
       focus; the shell never pushes one down.
     - **`focusForNavKey()` maps every architecture's group keys onto the 6**, and the
       nav row's glyph is derived from the SAME call — icon and specimen can't disagree.
     - **`icon` is its own focus, not a synonym for `content`.** Astryx ships `icon.*`
       as a hierarchy parallel to `text.*` (icons read lighter than type at the same
       tone, so they get their own steps); it used to fold into `'content'`, so picking
       **Icon** in the nav showed the text specimen and no glyph at all. `IconSpecimen`
       covers the three places icon ink is actually judged — hierarchy, icon-only
       buttons on a fill, inline with text. Architectures with no icon group
       (Categorical, flat) fall back to their content inks, which is exactly what those
       roles mean there, and `ContentSpecimen` also carries a glyph row — Categorical's
       Content is literally "text & icon ink", and a hierarchy judged only on type hides
       that the same tone reads differently at icon weight.
     - **Preview glyphs ALWAYS come from `TokenIcon` → `t.iconPrefix`** (the library
       picked in Foundations · Icons), never a hand-drawn SVG — same rule the Color
       collage and the component docs already follow, so switching the library
       re-renders them with that set's real glyph names (`lucide/search` →
       `ph/magnifying-glass`).
     - **Specimens caption in the ACTIVE architecture's vocabulary, and `slotOf()` takes
       a CANDIDATE LIST — one id per architecture, first match wins.** It used to take a
       single Categorical id, which meant the other two curated architectures matched
       almost nothing and fell through to the flat catalogue: measured, **Astryx resolved
       5 of 28 slots and shadcn 1 of 28**. That isn't just a label problem — the flat map
       is a DIFFERENT scheme, resolved from `themes`, so the Action preview painted its
       Primary button `themes['background-brand-solid']` (`#70cab7`) while the ColorCollage
       and every component specimen painted `t.brandSolid`, which `resolvePreviewTokens`
       had already re-mapped onto Astryx's `accent.solid` (`#32bca5`). **Two different
       accents on screen at once, from one accent colour** — the reported bug. Now
       26/28 · 26/28 · 17/28. Ids can't collide across architectures (`action.*` is
       Categorical-only, `accent.solid` Astryx-only, `primary.fill` shadcn-only), so the
       list is unambiguous; where an architecture genuinely has no equivalent (shadcn ships
       no brand tint, no scrim, no status bg) the list simply omits it.
     - **For a NON-FLAT architecture the fallback is the `PreviewTokens` field, never the
       flat map.** Every `slotOf` call already passes an arch-resolved `t.*` field as its
       fallback, so an unmatched slot still agrees with the rest of the preview. Reaching
       for `semanticMap[flatKey]` there is what reintroduces the mismatch above. The flat
       map is consulted only when the architecture IS flat, where it's the precise
       per-role value and the coarser `t.*` field would lose detail.
     - **An arch id must mean the same THING as the flat role, not just sound like it.**
       `content-disabled` was mapped to Categorical's `action.disabled` — which is a FILL
       (`{neutral.2}`, near-white), not an ink. Disabled text rendered near-white on a
       near-white page (~1.05:1, invisible) for every Categorical user. Categorical has no
       disabled ink at all, so that slot now lists only Astryx's `text.disabled` and
       otherwise falls back to the resolved `t.disabledText`.
  2. **`categoryKey`** (the active Variables foundation key, passed straight from
     `activeFoundation`) — when `focus` isn't set, tailors the panel to a live component
     set for that foundation: **color** → `ColorCollage`, ONE composite surface rather than
     a stack of titled `Group`/`Tile` blocks (Buttons · status tags · Slider ·
     Checkbox+Switch · Badges · Semantic states · Toaster · Dropzone · Select · URL
     `InputGroup` · `PasswordStrength` · TabMenu+Avatar). Titles and per-tile borders ate
     most of the height, so only two or three components were ever on screen — and colour
     is the foundation with the widest blast radius, judged by seeing many components
     repaint TOGETHER. Sharing one surface is what makes that systemic connection legible;
     separate tiles read as unrelated samples. Everything in it is a catalogue `SPECIMENS`
     renderer (never hand-rolled markup) reading the same `radius`/`sizes`/type/semantic
     tokens, so moving Radius or the accent visibly moves every component at once, and the
     collage can't drift from what the plugin ships. Its lead button's icons come from the
     system's own `iconLibrary` prefix. Use ONE Switch, not an on/off pair — each Switch
     specimen renders its own "Notifications" label, so two read as a duplicated row.
     **The collage is INTERACTIVE, via `Live` (`docs/specimens.tsx`)** — a wrapper that
     feeds real pointer/focus events into each specimen's OWN `State` axis. That's the
     whole trick: the specimens already implement Hover/Pressed/Focused because the plugin
     ships them as variants, so hovering paints the exact variant that lands in Figma
     rather than a hover colour invented for the preview, and it retints with the accent
     like everything else. Rules it enforces:
     - **No `State` axis → no colour change.** Badge, StatusBadge and Avatar ship no hover
       variant, so previewing one would advertise a state the system doesn't contain.
       They stay still; `lift` (a 2px hover rise) exists for the cases where motion alone
       is wanted, and is opt-in per call site because a Badge that rises implies a click
       target that isn't there.
     - **Which states exist is READ from `COMPONENTS`, never listed in the wrapper**, so a
       plugin change can't desync it. Toggle has no 'Pressed' → a press there resolves to
       'Hover' instead of Default (which would read as the press *un*-highlighting it).
     - **`hoverState` names the hover equivalent when it isn't called 'Hover'.** Dropzone's
       shipped states are Default/Dragging/Error, and hovering an uploader IS what a drag
       looks like — still validated against the catalogue, so it can't name a fiction.
     - **`toggle` makes Switch and Checkbox actually flip** (the axis it names must have a
       True/False pair). Only togglables get `tabIndex`; the wrapper carries no `role`,
       because the specimen's own `role="switch"` / real `<button>` would then be
       announced twice.
     - **Opt-in, and it must stay that way.** the component page's playground hero drives
       `State` from its own dropdown — if `Live` were on by default there, hovering would silently override
       the variant the user selected to inspect. (Verified: hover in the playground is a
       no-op.) The shared `STATE_TRANSITION` on the specimens IS global, deliberately:
       in the playground it makes flipping the State dropdown show the delta between two
       variants instead of a hard cut.
     **Slider and TabMenu are interactive BY DEFAULT, not through `Live`** — both declare
     `axes: []`, so there's no variant dropdown for a click to contradict, and a tab strip
     that can't be clicked is a picture of one. Their state is LOCAL and drives nothing
     outside the specimen: same contract as the Checkbox labelled "Remember me", which
     remembers nothing. The label is sample copy; the component is the subject. Do NOT wire
     the Slider to the real `radius` — the preview is a preview, and Foundations · Radius
     (plus Quick Edit) is where that's edited.
     - **Slider**: drag, click-to-jump, and full keyboard (`←/→` ±1, `Shift` ±10, Home/End),
       because `role="slider"` promises it. Move/up listen on the WINDOW, not the track —
       a 6px-tall track loses the pointer the moment a drag strays vertically. The fill has
       NO transition while dragging (easing behind the cursor reads as lag) and eases on
       keyboard/click. Thumb scale rides in the same `transform` as its centering translate,
       or it drifts right as it grows. The track claims its touch target with transparent
       9px borders + `background-clip: content-box` rather than by getting visually fatter.
     - **TabMenu**: the active pill is ONE element sliding between tabs (`layoutId`, scoped
       per instance with `useId` so two strips don't animate the pill between each other),
       not a background blinking on and off — that's what makes the selection read as a
       single object moving. Hover warms an inactive tab's INK, never gives it a fill: a
       second filled pill competes with the real selection. Roving tabindex + arrow keys
       with focus following selection (the ARIA automatic-activation tablist pattern) —
       three tab stops for a three-item control is not a control.
     - **Tween, not spring, for both** — this is a dense editor tool; bounce reads as toy.
       Both honour `useReducedMotion`. ·
     **typography** → Button + `FontFamilyPreview` (a trigger that opens a modal
     listing Heading/Body family with a "Copy family" clipboard action per row) ·
     **radius** → Button · Card · Input · Modal (the catalogue's `ModalSpecimen`, which
     renders inline — not a real floating dialog) · **spacing**/**sizes** → Button at every
     `Size` (SM–XL, so it reads the `sizes` tokens live) + Card (reads `padding` live) —
     these sit ALONGSIDE the token tables' own comparative bars (`VariablesTable`'s
     `preview` column + Sizes' "Component Sizes" bar block), not replacing them. ·
     **grid** → `GridPreview` (`preview/atoms/GridPreview.tsx`), the one specimen that
     is NOT components — see its own note below · **shadow** → `ShadowPreview`
     (`preview/atoms/ShadowPreview.tsx`): the ramp on six identical surfaces (no border —
     the shadow is the only separator, or you're judging the border) plus the catalogue's
     Card/DropdownMenu/Modal, which already resolve `sm`/`lg`/`2xl` through `shadowOf`.
     Elevation is only judgeable by COMPARING steps, which the generic set (one `xs` on a
     button) never allowed. Any other
     foundation (Icons — which instead swaps via `iconLibraryKey`)
     falls back to the original generic Button/Badge/Switch/Form set. **Hidden in the
     Components tab** (docs go full-width) and below **`min-[1180px]`**; the rail becomes
     a drawer below `md`.

> **`xl:` is 1440px in this app, not 1280 — and that hid the preview panel on real
> laptops.** Tailwind's breakpoints are rem-based (`xl` = 80rem) and `:root` sets
> `font: 18px/1.45` (see the "Root font-size" note), so every `lg`/`xl` utility resolves
> 12.5% higher than its name suggests: **`lg` = 1152px, `xl` = 1440px.** The preview aside
> was gated `hidden xl:flex`, so the live specimen — half the point of a workspace whose
> whole premise is "tweak on the left, watch it repaint on the right" — vanished on any
> window under 1440. That's a MacBook Pro 16" on any scaled resolution below 1512, or
> simply a window that isn't maximised. Reported as "on a 16-inch laptop that panel isn't
> there."
> - **The threshold is now an explicit `min-[1180px]:`** on both branches (the 400px
>   `<aside>` and the 32px collapsed strip), so the number in the class is the number in
>   CSS pixels. Don't "tidy" it back to `xl:`.
> - **1180 is MEASURED, not chosen.** With the full 400px aside, nothing inside `main`
>   overflows at that width across all eight foundations — Primitives keeps both the light
>   and dark columns, Semantics keeps its mode columns, and every railed section keeps its
>   198px gutter. The only casualties are `truncate` labels and Shadow's long CSS strings
>   scrolling inside their own `<input>`, both of which already behaved that way.
> - **The aside keeps ONE width (400px) instead of shrinking on narrow screens.** The
>   collage's hard floor is **380px** — at 360 its tiles overflow their `p-4` — so there is
>   no useful range to trade the center 20px for. If you ever do add a step, 380 is the
>   floor, not a starting point.
> - **The escape hatch is what makes the trade honest.** `previewCollapsed` and its 32px
>   strip cross the same 1180 threshold, so anyone who wants the full table width on a
>   small screen collapses it — verified at 1180, where Shadow's values go from clipped to
>   fully visible.
> - **Docs' and Components' "On this page" TOC deliberately stays on `xl:`.** Same root
>   cause, different answer: lowering it to 1180 was tried and measured, and it drops the
>   Docs article from 972 to 756px, at which point the Overview sheet's ramps
>   (`min-w-[40rem]` in an `overflow-x-auto`) hide tones 11–12 behind a scroll. A TOC is
>   navigation and the ramps are the content — don't trade the second for the first.
- **Components ship complete**: `selectedComponents` defaults to every key; a checkbox *removes* one.
- **Foundation progress** (`completedFoundations`) persists; "visited = done" — shown as ✓
  in the Home overview checklist.
- **Opacity is retired as a foundation** — a standalone 0–100% transparency scale duplicated
  what `colors.primitiveAlpha` (Accent-Alpha, Foundations · Color's Primitives tab) already
  covers, and shipping both read as two conflicting answers to "what's the transparency
  token" — a real user complaint, not a hypothetical one. Unwired everywhere a foundation
  is reachable or exported, same treatment as `WorkbenchLayout`/`HomeView`/`PickerColor`:
  - **Nav/UI**: gone from `FOUNDATIONS`/`RAILED_FOUNDATIONS`/`VARIABLE_FOUNDATIONS`
    (`Configurator.tsx`) — no icon in the rail, unreachable. (`COLLECTIONS_OF` also carried an
    `opacity` entry; that whole map has since been deleted — the Export wizard no longer
    pre-scopes to the active foundation.) `Step6_Opacity.tsx` itself is NOT deleted (kept for
    reference only, don't wire it back up).
  - **Docs**: the `FoundationDoc` entry is gone from `FOUNDATION_DOCS`
    (`foundationDocs.tsx`) — eight foundations now, not nine.
  - **Export**: gone from `tokenGenerator.ts` (no `opacity` key in tokens.json — bumped
    `TOKEN_SCHEMA_VERSION` to **5**, see the Token Export Format section), `exporters.ts`
    (no `--opacity-*` CSS vars or README table), `sectionExport.ts` (`SectionKey`/
    `ALL_SECTIONS`) and `exportWizard.ts` (`WizardCollection` — no Step-1 checkbox, no W3C/
    CSS/Tailwind case). The **import** side matches: `tokenImport/types.ts`'s
    `FoundationKey` dropped `'opacity'` too, so `ImportSystemModal` no longer offers it as a
    detected category (an old export that still has an `opacity` block just isn't picked up
    — the container heuristic that used to catch it, `/^(opacity|opacities|alpha)$/`, is
    gone with it).
  - **What's KEPT, deliberately**: the store field (`opacity`, `setOpacity`,
    `OPACITY_DEFAULT`) is still there, un-exported and un-editable — `previewTokens.ts`'s
    `alphaOf()`/`tintOf()` helpers (soft icon/badge fills used all over `specimens.tsx`)
    read it as one of two fallback tiers, and ripping it out was extra risk for zero
    user-facing gain since neither helper is reachable from any live editing surface
    either way. This is NOT the same as the `styleDirection`/`selectedAtoms`/`currentStep`
    "Removed fields" below — those are gone from the store entirely; `opacity` just went
    quiet.
  - **The Figma plugin needs no code change to stay working**: its `tokens.opacity` import
    is already gated (`if (tokens.opacity) { … }` in `code.ts`), so a payload that no longer
    carries the field just skips creating that variable collection — verified against the
    sibling plugin repo, not assumed. Its dead `COLLECTIONS.opacity` / import-emit / docs-
    page-section code is a separate, optional cleanup, not a correctness requirement.

> **Grid's specimen is the LAYOUT, not components — the one preview that can't be
> made of buttons.** Every other foundation's panel answers "what do my components look
> like with this token"; a 12-column grid has no such answer, which is why Grid sat on the
> generic Button/Badge/Switch/Form fallback and told the user nothing. `GridPreview`
> (`preview/atoms/GridPreview.tsx`) draws two things a token TABLE structurally cannot:
> - **The layout grid at every breakpoint.** `columns`/`gutter`/`margin`/`container` are
>   GLOBAL tokens, but what they PRODUCE changes per viewport — and the interesting number,
>   the CONTENT width, appears nowhere in the table. Above the container the cap sets the
>   content and **`margin` stops mattering entirely**; frames past that point carry a
>   `container` chip so that's visible rather than inferred. Verified live: at the default
>   1280px container only `2xl` is capped; drop the container to 700px and everything from
>   `md` up caps, i.e. four breakpoints lay out identically — which is exactly the kind of
>   thing you cannot see in a column of numbers.
> - **Breakpoint RANGES.** A breakpoint is a range, not a point, but its upper bound is the
>   NEXT row's min width, so the table can't show where `md` stops. The last bar runs to the
>   axis edge and is labelled `+`, never a fabricated upper number.
>
> Rules that keep it honest:
> - **Frames are a true scale model, at any render size.** Both insets are percentages of
>   the box they resolve against — `padding: %` against the frame (= the viewport),
>   `column-gap: %` against the grid's content box (= the content width) — so nothing
>   depends on how many CSS pixels the frame actually got. Measured against the real ratios:
>   column/content is 0.04516 rendered vs 0.04514 real at `sm`, 0.06611 vs 0.06615 at `2xl`.
>   **Don't put borders or padding on that inner grid** — it'd shift the content box the gap
>   is solved against; the margin guides are absolutely positioned for exactly that reason.
>   (Note when re-measuring: `getComputedStyle().columnGap` returns percentage gaps
>   UNRESOLVED per CSSOM, so a reading of `4.17` there is `4.1667%`, not 4.17px.)
> - **Which breakpoints exist is DERIVED** from the `breakpoint-*` keys, never listed — same
>   rule as everywhere else, so the panel can't drift from the tokens that ship. A system
>   whose breakpoints are all blank falls back to a single `container` frame rather than
>   rendering an empty block.
> - **Frame widths stay proportional to each other** (`viewport / widest`), because half of
>   what makes a breakpoint set legible is their relative scale. This survives comfortably in
>   the 400px aside: the narrowest is 640/1536 ≈ 42% of the width, still readable.
> - **It doesn't repeat the Grid table's own `footer` overlay**, which draws the single
>   abstract column strip. That one answers "what does one row of columns look like"; this
>   answers "what does it become at each viewport." Don't collapse them into one.

> **Shadows ship a DARK TWIN, because one value provably cannot serve both appearances.**
> Reported as "you can't see anything in shadow dark" — and measuring it showed the shadows
> weren't subtle, they were **mathematically identical to the background**. The ramp's colour
> is `rgba(10,13,18,·)`, "near-black" chosen against a WHITE page; the dark page is `#0c0e12`
> = `rgb(12,14,18)`. The shadow colour *is* the page. Composited, the LARGEST step moved the
> pixel by **0.36 of one 8-bit level** — it rounds to the background. Across the ramp, dark
> delivered an OKLab ΔL of 0.0003–0.0009 where light delivers 0.036–0.132.
> `darkShadow()` / `darkShadowMap()` (`colorUtils.ts`) derive the twin. Two corrections,
> because one is not enough:
> - **Black, and much more of it** — pure black (on a near-black page there is no darker hue
>   to reach for), alpha remapped `1 − (1 − a)^6`. That FORM matters: a plain multiplier
>   clamps, so the Strong preset's 0.32 × 6 saturates at 1 and flattens the top of the ramp,
>   while this approaches 1 asymptotically and keeps every step ordered.
> - **A light rim, which is what actually makes it read.** Below a near-black page only ~5%
>   of the luminance range exists, so a black shadow CANNOT match light-mode elevation
>   however hard it's pushed — measured, even at gain 8 the largest step reaches ΔL 0.068
>   against light's 0.132. **Up is the only direction with range left**, which is why every
>   dark UI that reads as elevated (Material's surface tint, Linear/Vercel/GitHub's hairline)
>   spends light rather than dark. One 1px white rim at α 0.06 buys ΔL **+0.059** — as much
>   as the entire 48px black shadow — so the pair lands in light mode's perceptual range.
>   The rim is listed FIRST because box-shadow paints earlier layers on top; last would bury
>   it under the blurred layers, which is exactly what dulls it back out.
>
> Rules that keep it honest:
> - **Light is byte-identical to before** — verified in the browser: the light ramp still
>   computes to `rgba(10,13,18,0.05) 0px 1px 2px 0px` etc., no rim. This is strictly additive
>   to dark, so no existing system is restyled and there's no migration.
> - **Derived, not a second editable token set.** A shadow is a raw CSS string with no
>   "reference" to resolve (unlike a gradient stop's `tone`), so there's nothing for a user
>   to edit a dark twin *against* — and a hand-maintained parallel ramp is one more thing to
>   drift. `darkShadow` re-colours in ONE pass over the string (no paren-aware layer
>   splitting needed, since `rgba(…)`'s own commas don't matter if you never split), keeps
>   the geometry exactly, and passes `none` through untouched.
> - **It's applied in FOUR places and they must not diverge** — `resolvePreviewTokens`
>   (so every specimen, not just Shadow's, gets readable elevation in dark), `Step7_Shadow`'s
>   own swatches (they sit on CHROME surfaces, so they follow `useTheme()`, not
>   `previewTheme` — you cannot edit a token you cannot see), `exporters.ts`' `.dark` block,
>   and the wizard's `cssFor`. That last one is easy to miss: it's a SEPARATE CSS path from
>   `exporters.ts`, and it shipped light-only shadows until it didn't. Verified by
>   intercepting the wizard's own download blob: one `:root`, exactly one `.dark` block
>   (the shadow lines merge into the semantics block rather than opening a second one), 12
>   `--shadow-*` declarations = 6 light + 6 dark.
> - **`shadowsDark` in tokens.json is ADDITIVE**, exactly like `gradientsDark` beside
>   `gradients`: same keys, complete map, so a consumer never tests which entries exist and
>   an older plugin ignores it — hence **no `schemaVersion` bump**.
> - **Known gap, deliberate:** the wizard's **SCSS** output has no dark shadows. SCSS there
>   has no theming scope at all (it drops semantics' dark modes too), so adding one for
>   shadows alone would be inconsistent rather than complete. Fix it when SCSS grows themes.

> **`ThemePreviewHub`'s views are Artefacts · Components · Documentation — THREE, and
> the header they switch from carries nothing else.**
> - **`Code` was removed** (the `HubView` member, its `HUB_VIEWS`/`HUB_ICON_SOURCES`
>   entries, the `ThemeCodeFormat` render branch and its import). The workspace's own tab
>   strip already carries **Code Format** one row up, so the icon was a second door to the
>   same screen — and the two doors weren't even equivalent, which is the part worth
>   knowing: the tab renders the WHOLE system, the icon rendered `scopeToTheme`. That
>   narrowing is now unreachable from the UI. `ThemeCodeFormat`'s `previewTheme` /
>   `scopeToTheme` / `showBreadcrumb` props are KEPT — optional, defaulted to the
>   whole-system behaviour, and the only implementation of per-theme CSS/Markdown there
>   is (same "keep the reusable optional prop whose one caller went away" call as
>   `ColorPrimitives.focusFamilyKey`). Don't re-add the icon; if theme-scoped code is
>   wanted back, it belongs on the **Code Format tab** as a scope control, not as a
>   fourth view.
> - **The theme's identity (name + Export) and the Light/Dark preview toggle are NOT in
>   `ThemeContextBar` any more** — it holds only the view switcher, right-aligned. Both
>   moved into `ThemeQuickSettingsRail` (see its own note below).
> - **`ViewIcon` paints the glyph as a CSS MASK with `currentColor`, never an `<img>`
>   under an `invert` filter.** The filter only worked while all four source files shipped
>   the same near-white fill: `components.svg` ships `fill="white"` and `theme.svg`/
>   `doc.svg` ship `#EDEEF0`, so a new icon dropped into that folder inverted to a
>   different ink than its neighbours, and NEITHER state could follow the button's own
>   colour. Masking makes active (`text-black` on the white pill) and inactive
>   (`text-fg opacity-55`) derive from one place — measured in both chromes: active
>   `rgb(0,0,0)` on `rgb(255,255,255)`, inactive `rgb(24,24,27)` light / `rgb(243,243,243)`
>   dark. Same fix, same reason, as `FoundationIconRail`'s active glyph. **A new icon in
>   `public/icons/theme-hub-icons/Icon/` therefore needs no particular fill** — the mask
>   uses only its alpha.
>
> **The "Variables" view was DELETED, not hidden.** It rendered the semantic / type /
> layout role previews (`SEMANTIC_SPECIMENS`, `TypeRolesPreview`, `LayoutRolesPreview`,
> `GridPreview`, `ShadowPreview`, `IconSpecimenPreview`) behind a 9-row foundation rail —
> the same tokens the **Primitives** workspace tab already edits at full width with its own
> collections rail, table and Token Details modal, one tab away. Two surfaces, one job.
> `VariablesView` and `SemanticPreviewTokenModal` went with it (~140 lines), along with
> `ThemePreviewHub`'s `onEditTypeRole` / `onEditLayoutRole` / `onEditColorToken` props —
> that last one was already dead (typed, never destructured).
> - **Nothing was lost**: `TokenDetailsModal`'s alpha-family picker still has its other,
>   fully reachable caller (`Step3_SemanticTokens`'s `ArchModeEditor`), which is the note
>   under "THE ALPHA LAYER" saying *both* call sites use `[...PICKABLE_FAMILIES,
>   ...ALPHA_FAMILIES]` — one of the two is now the only one.
> - **`ComponentVariantsView` took the slot, because a theme hub was missing what the
>   tokens BUILD.** It is a TASTER and must stay one — the Components destination has the
>   rail, the search, the per-component article, the API reference and the width. Three
>   rules keep it from becoming a second browser:
>   - **Variants are READ from `COMPONENTS`, never listed here** — the same rule `Live`
>     follows for its State axis, so a plugin change can't leave a row advertising a
>     variant the system doesn't ship. `SHOWCASE` declares only `{ key, axis }` (+ a `base`
>     of axis values held fixed) and the values come from the catalogue.
>   - **Capped at `SHOWCASE_LIMIT` (4) per row, and the row SAYS so** ("+2 more"). A row
>     that truncated quietly would misreport the system's size.
>   - **Every row title opens that component's article; the header CTA opens the
>     destination** (`onOpenComponent` → `selectComponent`, `onOpenComponents` →
>     `changeTab('components')`). Verified: the Badge row lands on the Badge article with
>     the rail on Indicators — `selectComponent` alone is enough, `ComponentsView` reads
>     `active ?? COMPONENTS[0]` and the rail derives its category from it.
> - **ONE column, not a two-column grid.** A specimen owns its own width (Input 260px,
>   InlineAlert 320) so four of them never fit a half-column: they stacked into a ~550px
>   tower and, on the grid's default `stretch`, dragged the short section beside it to the
>   same height — measured, Button was 548px tall for ~120px of content. Full width lays
>   the same four out on one line.
> - **`ComponentShowcaseRail` is a SIBLING of `ThemeContextBar`, not a child of the
>   view** — that is the whole reason its header band lands on the Theme / Export row
>   instead of one row below it (verified: both 124 → 178). Every other view renders no
>   rail there, so their context bar still spans the full width, unchanged. It reuses
>   `COLOR_RAIL_WIDTH` / `COLOR_RAIL_COLLAPSED_WIDTH` (240 / 56) and collapses to
>   `SemanticGroupRail`'s two-letter marks with the full name in `title`.
>   **Its rows are derived** — `'All'` plus one per `SHOWCASE` entry, labelled from
>   `COMPONENTS`, so a renamed component renames its own filter.
>   **RENAMED to `HubRail` and now shared with System doc** — see the note below.
> - **`RailToggle` took a `noun`/`expandedHint`** (defaulting to the Variables wording
>   every prior call site relies on) because "Collapse the variable list" is a lie next to
>   a component filter.
> - **The tab needed a glyph that didn't exist** — `public/icons/theme-hub-icons/Icon/`
>   held only theme/variables/doc/code. `components.svg` was authored to match them
>   (16×16, `fill="none"`, literal black strokes) so it behaves identically under
>   `ViewIcon`'s `invert` classes. `variables.svg` is now unreferenced but kept.
>   **SUPERSEDED — `ViewIcon` no longer uses `invert`.** A designer supplied a new
>   `components.svg` that ships `fill="white"` (not `#EDEEF0` like its neighbours), and
>   under an `invert` filter a differently-filled source inverts to a different ink —
>   plus the filter can't make either state follow the button's own colour. `ViewIcon`
>   paints the glyph as a CSS mask with `currentColor` now (active `text-black` on the
>   white pill, inactive `text-fg opacity-55`), so a new icon dropped into that folder
>   needs no particular fill — only its alpha is read. Same fix, same reason, as
>   `FoundationIconRail`'s active glyph.

> **ONE left column across the whole Themes workspace: `COLOR_RAIL_WIDTH` (240 / 56
> collapsed), one component (`HubRail`), one collapse preference.** It's the same slot in
> every view, one click apart, and it had three widths and three structures:
> `ThemeQuickSettingsRail` 296 with no collapse, `ComponentShowcaseRail` 240 with a
> `h-[54px]` band + `RailToggle`, `HubNavigationRail` (System doc) 198 with a `py-4`
> caption and no collapse at all. Switching views made the column visibly jump.
> - **240 is the one that had a REASON to be its size** — the shell derives TopNav's brand
>   block from `COLOR_RAIL_WIDTH` so the divider runs unbroken from the very top (see its
>   note in `colorControls`). So the other two adopt it rather than a fourth number being
>   invented; `QUICK_SETTINGS_WIDTH` is now literally `= COLOR_RAIL_WIDTH`, not a copy.
> - **`HubNavigationRail` was DELETED and merged into `HubRail`**, which both the component
>   showcase and the System doc list render. Same reason `RailGroupNav` and `RailSelect`
>   were extracted: two copies of one control drift, and this pair already had. Its
>   `title` / `ariaLabel` / `noun` are props; `noun` feeds `RailToggle`'s label.
> - **The collapse preference is ONE piece of state for the hub** (`railCollapsed`), not
>   one per view — collapsing on Components and finding it expanded on System doc reads as
>   two different columns, which is the confusion the merge exists to remove. Verified:
>   collapse on Docs → 56, switch to Components → still 56, expand → 240, back to Docs →
>   240.
> - **The System doc's open page is LIFTED** (`docPage` in the hub) rather than local to
>   `DocumentationView`, which unmounted on every view switch and reset to Overview. Same
>   rule `docFoundationKey` already follows for the Docs destination. Verified: Docs →
>   Shadow → Components → Docs → still Shadow.
> - **The quick-settings rail's identity band lost its "Theme" caption** when it narrowed.
>   At 240 the band is 203px wide and the word cost ~39px of it — taking the space from the
>   NAME, which clipped to "Ligt" (measured: input 31px, needed 40). The pencil beside an
>   editable field already says "rename"; `title`/`aria-label` carry the word for hover and
>   screen readers. Labels are identifiers, not tutorials (`.impeccable.md`). After: 77px,
>   unclipped.

> **CASING: a navigable row prints its label VERBATIM; `uppercase` belongs to the eyebrow
> CAPTION over a group, never to a name.** Reported as "veo muchas inconsistencias entre
> todo uppercase". Audited all 151 `uppercase` usages; the rule that came out of it:
> - **Eyebrow / caption / step label → uppercase, and that's the house device.** The
>   `text-[9–11px] font-semibold uppercase tracking-widest text-fg-faint` pattern is a
>   deliberate typographic treatment for something that LABELS A SET — a data-table column
>   head (`PRIMITIVE COLLECTION`), a step readout (`XS SM MD LG XL`,
>   `PURE SUBTLE TINTED VIVID`), the "GROUPS"/"COLLECTIONS" section captions, a badge
>   (`Code`). All correct, all left alone.
> - **A row you can click, that names a thing → verbatim.** Violations found, all the same
>   copied `uppercase tracking-widest` treatment on a NAVIGABLE row:
>   - `ComponentShowcaseRail`'s rows and `VariableCollectionRail`'s collections
>     (`text-[10.5px] font-semibold uppercase tracking-[0.12em]`). The catalogue says
>     "Status Badge" and the rail said "STATUS BADGE"; the collections are named "Color
>     primitives" and the rail said "COLOR PRIMITIVES". Both now `text-[12px]`, no
>     transform, matching what the System doc list always did.
>   - **`ColorPrimitives`' Primitives nav — the theme-folder header AND the
>     Accents/Neutrals/States group headers** (`text-[10px] font-semibold uppercase
>     tracking-widest`). These are collapsible, clickable, theme-previewing rows that NAME
>     a folder — "ACCENTS" is a folder called "Accents", not a caption. Folder header now
>     `text-[12px]`, group headers `text-[11px]`, both `font-semibold`, no transform. (The
>     56px collapsed rail iterates families, not folder labels — untouched. Its 2-letter
>     compact marks keep uppercase; an abbreviation is not the name.)
> - **The "System colors" wrapper folder is GONE from the Themes-workspace Primitives
>   nav.** When `managedThemesExternally`, `visibleNavFolders` returned a single
>   `fixedFolder` whose header was already non-interactive — `onClick` undefined,
>   `tabIndex={-1}`, no chevron, only ever one of them — i.e. a nesting level with no
>   information, the exact `hideHeader` case the Custom group already handled. Its
>   Accents / Neutrals / States groups now render directly under the section's own "Groups"
>   heading (and lose the `pl-2` indent that only made sense under a parent row). The
>   non-managed path (real theme folders "Theme 1" / "Sky" / "Custom", which ARE
>   interactive) is unchanged apart from the casing.
> - **The DATA was already right, once more.** Every folder/group label is sentence case in
>   the constants (`FAMILY_GROUPS = ['Accents', 'Neutrals', …]`, `label: 'System colors'`)
>   — the CSS was the only thing shouting.
> - **ONE folder glyph for the Color rail: `FolderIcon`, exported from
>   `VariableCollectionRail`, sourced from `public/icons/settings/folder.svg`.** The
>   Collections rows and `ColorPrimitives`' theme-folder + group headers each hand-rolled
>   their own `<path>` before (three different ones). It renders as a **CSS mask painted
>   with `currentColor`**, not an `<img>` — the asset ships a hardcoded `stroke="white"`,
>   so a bare `<img>` is invisible in light chrome and can't track the row's
>   active/hover/previewed ink. The mask reads only the file's alpha (a stroked path → a
>   thin outline), so one asset covers every state and both themes. Same technique as
>   `ViewIcon` / `EditThemeIcon`. `size` prop, default 12 (group headers pass 11). If the
>   asset is ever re-drawn with a `fill`, the mask still works — it's alpha-only.
> - **The DATA was already right.** Every nav label in the store/constants is sentence case
>   ("Color primitives", "Shadow styles", "System reference") — only the CSS was mangling
>   them, which is why the fix is two class strings and not a data migration.
> - **Sentence case, not Title Case, for nav labels.** Four Title-Case holdouts were the
>   only ones out of step and are now sentence case: `Border Radius` → `Border radius`,
>   `Icon Library` → `Icon library` (both in `FOUNDATIONS` + `FOUNDATION_DOCS` + their
>   `title`/`variablesLabel`), and `THEME_WORKSPACE_TABS`' `Theme Preview` → `Theme
>   preview` / `Code Format` → `Code format`. That last pair also settles a disagreement
>   the UI had with itself: `HubBreadcrumb` has always printed "Theme preview". The eight
>   `variablesLabel`s went `'X Variables'` → `'X variables'` with them. **Component names
>   are NOT touched** — "Status Badge", "Inline Alert" are catalogue display names mirrored
>   from the plugin (the source of truth), not prose.

> **The Component Variants specimens rendered `transparent` for every accent- and
> status-backed role when you landed on the Theme Preview hub before ever opening the
> Color editor — `useEnsureColorScales()` is now mounted at the `Configurator` shell.**
> `makeDesignDefaults()` ships `primaryScale`/`errorScale`/`warningScale`/`successScale`/
> `infoScale` as `{}` — the ramps are DERIVED, and a persisted store carries that empty
> shape too. `useEnsureColorScales()` (a `[]`-deps effect that backfills any empty ramp
> from its base hex) was mounted ONLY on the Color-editing surfaces — `ColorPrimitives`,
> `Step3_SemanticTokens`, `QuickFoundationsPanel`. The Themes → **Theme Preview** hub
> mounts none of those, so on a store with empty ramps every `{accent.9}` / `{error.11}`
> ref in the Categorical projection resolved through `scaleLookup` → `refToView`'s
> `?? 'transparent'` fallback, and `ComponentVariantsView`'s Button/Badge/StatusBadge/
> InlineAlert/Toast specimens painted invisible (Solid button = near-white ink on a
> transparent fill on a near-white card). Only the neutral-backed roles (`surface.page`,
> `content.primary`) survived, because `grayLightScale`/`grayDarkScale` are the one pair
> that ships populated. **Hoisted to the shell**, next to `useRegenerateScalesOnScaleSettings()`,
> for the exact reason that hook's own note gives — it can't be orphaned by which surface
> the user opens first. The three local call sites are left in place (identical, `[]`-deps,
> each guards on `!Object.keys(x).length`, so once the shell backfills they're no-ops).
> Verified in dark chrome + light-theme preview: Solid button `rgb(149,34,233)`, Badge
> Success `rgb(0,137,46)/11%`, Warning `rgb(237,110,0)/11%` — all live.

> **Theme Preview's left rail is QUICK SETTINGS, not an artefact filter — and the bottom
> quick-edit dock is retired.** That column used to hold Overview/Forms/Cards/Others (a
> filter narrowing five cards) while the actual controls sat in a 4-column dock pinned
> under the canvas. Both are gone: `ThemeQuickSettingsRail.tsx` puts the controls beside
> the artefacts they repaint, and the grid always shows every screen.
> `ThemeQuickEditDock.tsx` was DELETED, not kept for reference — every one of its four
> controls has an equivalent row in the rail — but two things were ported verbatim and
> must not be lost:
> - **`commit()` snapshots before every write**, so each edit carries a 9s Undo. The
>   `<aside>` is `flex flex-col`: one `flex-1 min-h-0 overflow-y-auto` scroll region holds
>   the rows, and the Undo bar is a `flex-shrink-0` footer pinned at the bottom (same
>   scroll-body + fixed-footer shape as `KitsPopover`). It was `sticky bottom-0 mt-4`
>   inside the scroll div, which only sticks once the content overflows — on a short rail
>   it just sat after the rows with a `mt-4` gap under it.
> - **`applyAccentScoped` FORKS a shared family.** When more than one theme reads the same
>   accent family, quick edit mints a per-theme `customColors` entry and re-points
>   `themeSources` instead of mutating the shared source — otherwise editing the theme
>   you're previewing silently repaints every other theme pointing at that primitive. (Only
>   Accent needs this now — Base is a tint dial, not a colour edit.)
>
> **The rail also owns the theme's IDENTITY and the preview APPEARANCE — both moved out
> of `ThemeContextBar`.** The header was a row of three unrelated things (which theme this
> is · which appearance you're looking at · which view you're on); the first two describe
> the same thing the rail's sliders edit, so they sit with them.
> - **`ThemeIdentityBand` (name input + Export) is a PINNED `h-[54px]` band**, not the
>   first row of the scroll region — renaming the theme on screen shouldn't mean scrolling
>   a column of sliders back up. 54px because it lands on the view-switcher's own row:
>   verified both at `top: 124, height: 54`.
> - **That alignment only holds because the rail is a SIBLING of `ThemeContextBar`, not a
>   child of `ArtefactsView`** — exactly the reason `ComponentShowcaseRail` is a sibling
>   too. `ThemePreviewHub` renders it on `view === 'artefacts'`; `ArtefactsView` itself is
>   now just the grid. **`key={previewTheme}` is load-bearing**: the name input holds a
>   draft in local state, so switching theme has to remount it or the draft outlives the
>   theme it was typed for (the old `ThemeContextBar` carried the same key for the same
>   reason).
> - **The Light/Dark control sits UNDER the two colour rows, and carries no label.** It
>   re-reads each family's light ramp or its dark twin, which is what those two rows
>   define — in the header it read as a claim about the whole workspace. "Light | Dark"
>   names itself; an "Appearance" caption over it is the identifier-vs-tutorial mistake
>   this file's design principles already warn off.
> - **Consequence, accepted deliberately: appearance and rename exist on ARTEFACTS ONLY.**
>   Components has its showcase rail and Documentation has its docs rail, so there's no
>   column for quick settings there — switch back to Artefacts to flip the appearance. If
>   that becomes a real friction, the fix is a rail on those views, not a second copy of
>   the toggle in the header.
>
> **The ACCENT row is an OKLCH hue slider; the BASE row is a TINT slider — different axes,
> on purpose.** Accent picks the brand hue. Base does NOT pick the neutral's hue — the
> system already derives that (from the accent when `linkNeutralToAccent`, else the
> default) — what the designer chooses here is how much of that hue survives, from a
> near-pure grey to a clearly coloured neutral. That axis IS `neutralTint`
> (Pure · Subtle · Tinted · Vivid), so `TintSlider` (`ThemeQuickSettingsRail.tsx`) is a
> **snapping 4-stop `<input type=range>`** — the range feel without a free 0–1 value the
> ramp math could land on a tint nobody chose (see "Discrete levels, not a slider" under
> the Base-drives-the-page note). On change it mirrors `ColorPrimitives`' scale-settings
> `onTint`: `setNeutralTint(t)` then `applyGrayColor(linked ? neutralFromBrand(primary, t)
> : grayBaseColor, previewTheme, /*fromLink*/ true)` — linked, the hue tracks the accent
> and only its saturation moves; unlinked, the user's own base hex is re-derived so the
> page and the ramp's chroma-continuity pick up the new level. Verified end to end: VIVID
> unlinked took page `#fcfefd → #f0f8f3` and `grayLight[2] #fafbfa → #eef6f1` with
> `grayBaseColor` untouched; TINTED linked snapped `grayBaseColor #d1dcd5 → #887563`
> (accent hue, `tinted` brandSat) and kept the link. The track paints the four levels via
> `neutralFromBrand(neutral, level)` so the grey→tinted range is visible, and the trailing
> swatch is `neutralFromBrand(neutral, currentLevel)` — a LIVE sample of the track at the
> thumb, not the raw base hex (whose lightness the track normalises away). Both read from
> the resolved `neutral`, never the accent: painting the track from `primaryColor` when
> linked left the swatch green while the track went pink after an accent move — the two
> must never disagree.
>
> **The RADIUS row is a scrub card too, not a dropdown** (`RadiusCard`). The named presets
> (Sharp/Soft/Rounded/Pill) are just points on ONE axis — `scaleRadiusFromLg` grades the
> whole ramp from `lg` (xs=lg/6 … xl=4lg/3), and Rounded's ramp is exactly `lg=24`. So it
> matches Sizes' `BaseUnitCard` shape: five `h-6 w-6` roundness-preview squares
> (`flex-shrink-0`, radius capped at 12 so the squares stay square), the live `lg` px, the
> matched preset name or "Custom" (`flex-shrink-0`, `tracking-wide` not `tracking-widest`
> — "Rounded" clipped the card edge at the wider tracking with 28px squares), the xs–xl
> readout, and a `0–40` slider driving
> `scaleRadiusFromLg(lg, radius)` — same ceiling and same grader `StepRadius`'s own
> roundness slider already uses. Rounded and Soft land exactly on their presets; Sharp and
> Pill (hand-tuned ramps that don't fit the grading formula) read "Custom", identical to
> the Advanced screen. `none`/`full` stay pinned at 0/9999.
>
> **The TEXT SIZE row is the same idea for type** (`TypeScaleCard`, between Font family and
> Radius). `TYPE_SCALE_MODES` (`typographyStandard.ts`) — five density steps Compact ·
> Cozy · Default · Comfortable · Spacious, factors 0.875/0.9375/1/1.0625/1.125 (eighths,
> so they round cleanly against the standard's integer steps and no two adjacent `text-*`
> sizes collapse to a 1px gap). Dragging calls `buildTypeScale(factor)` → regenerates
> EVERY `text-*`/`display-*` size AND its line-height at the same factor, so the
> standard's size→leading ratio (the vertical rhythm) survives the resize;
> `setTypography({ …, sizes, lineHeights })` in one write. `Default` (factor 1 × an
> integer scale) is `FONT_SIZE_STANDARD`/`LINE_HEIGHT_STANDARD` verbatim — a no-op, so
> existing systems infer as `default` and nothing regenerates. `inferTypeScaleMode(sizes)`
> is the `matchRadiusPreset` analogue: matches a mode or returns null → the card reads
> "Custom" (a size hand-edited in Advanced type), and the slider still snaps back onto a
> curated scale. Covered by `typeRoles.test.ts`.
>
> **The Accent row and the SpectrumSlider hold RELATIVE position, never absolute L and C.**
> Holding L+C absolute is the obvious implementation and it is wrong twice over. Both
> failures were measured on the shipped accent (`#9522e9`, L .547 C .265 H 304), and the
> first one shipped before it was caught:
> - **It RATCHETS.** sRGB's chroma ceiling is hue-dependent, so the first sweep through a
>   narrow hue clamps the chroma and every later hue inherits the clamp. A
>   304° → 200° → 120° → 60° → 304° sweep left the accent at **C .094 where that hue allows
>   .249** — `#87639a`, a dull mauve, with no way to drag back out of it. Reported as "los
>   colores son muy opacos"; it was a one-way slide into mud, not a taste question.
> - **It reads as MUD.** At a fixed L = .48 the ceiling swings **.082 (cyan) to .256
>   (magenta), 3.1×**. A hue strip drawn at one lightness is only as vivid as its dullest
>   hue, which is why the track looked nothing like a spectrum.
>
> `readHuePosition` / `colorAtHue` (`colorUtils.ts`) carry what the colour MEANS relative
> to its own hue instead: `saturation` (fraction of the gamut wall) and `lightness`
> (position relative to the hue's CUSP, 0.5 = exactly on it). Both are hue-independent, so
> the round trip is lossless and a vivid colour stays vivid at every angle. Verified with
> real pointer gestures: 200° → 120° → 60° → 0° → 260° → 304° yields
> `#39e4ed · #cced37 · #ea8926 · #e8257f · #1568e7` and lands back on `#9422e8`.
> - **`maxChromaSrgb` is a STRICT bisection on `inSrgbGamut`, not `gamutMapSrgb`.** That
>   one may overshoot by up to a JND (it optimises perceptual closeness to an out-of-gamut
>   input), which is right for MAPPING a colour and wrong as a denominator. Using it gave
>   ceilings ~4% high and made two tests assert numbers the shipped function can't return.
> - **`srgbCusp` is cached per whole degree** — ~190 bisections per hue, asked once per
>   gradient stop per render.
> - **The TRACK is a hue AXIS, drawn at a fixed high saturation; the THUMB and the emitted
>   value use the colour's OWN.** An early build floored both, and a near-grey seed
>   rendered its thumb as a saturated slate — the control overstating what you had. The
>   track has to stay vivid regardless (a track at a near-grey's 4% saturation is a smear
>   you cannot aim with); the thumb has to stay honest. (This applied to the Base row when
>   it was a hue slider — it's a `TintSlider` now, but the rule stands for any future
>   near-grey seed on `SpectrumSlider`.)
> - **The position is FROZEN at pointerdown** and rides in state beside the hue. Re-reading
>   it from `value` mid-drag is what made the ratchet compound within a single gesture.
>
> Ramp generation is untouched: this only picks the ANCHOR hex that `generateColorScale`
> writes to tone 9, and the Radix model is unchanged.
>
> **On `oklch()` in the EXPORT — deliberately NOT adopted.** The maths is already OKLCH end
> to end (`buildScale` works in OKLCH; every emitted hex goes through `oklchToHex`'s CSS
> Color 4 gamut mapping, not per-channel clipping; steps 11–12 are contrast-SEARCHED in
> OKLCH lightness). `oklchToCss` exists in `color/gamut.ts` and is called by nothing — the
> only dead end is the OUTPUT format, and it should stay dead: emitting `oklch()` breaks the
> Figma plugin (`primitiveRefHex`/`hexToRgba` parse hex; Figma variables are RGB), forces a
> `TOKEN_SCHEMA_VERSION` bump, and buys consumers nothing, since the values are already
> gamut-mapped and 8-bit exact. The OKLCH win is on the INPUT surface, which is free.

> **RADIUS: the roles sit on their natural rungs (xs · lg · xl · 2xl), and the ramp
> carries the look.** Reported as containers with "corners extremadamente bordeadas"
> that were not homogeneous between elements. Two causes, both measured.
> - **A one-time visual compensation was encoded as a permanent offset on a
>   MULTIPLICATIVE ladder.** `RADIUS_STANDARD`'s own comment said it: *"Roles pick
>   2xl/3xl/4xl so the look matches the previous Rounded ramp."* The standard ramp had
>   moved down to Sharp (lg 8) and the roles were pushed up two rungs to keep the old
>   pixels. `scaleRadiusFromLg` grades every step as a RATIO of `lg` (3xl = 3×, 4xl = 4×),
>   so that is exact at lg 8 and amplifies everywhere else — measured across the presets:
>   Sharp 4/16/24/32 · Soft 6/24/36/48 · Rounded 8/32/48/64 · **Pill 12/48/72/96**. Three
>   of the six styles use Pill, so their cards shipped a **72px** radius — 46% of a 156px
>   collage module's own width, a stadium rather than a corner. The ladder was lopsided
>   too: control→action jumped 4×, then 1.5×, then 1.33×.
> - **The fix is to move the roles down and the standard ramp up, together.** Roles are
>   `control xs · action lg · container xl · overlay 2xl` (even 0.25/1/1.5/2 spacing) and
>   `RADIUS_STANDARD` is **Rounded (lg 16)**, so the default system resolves 4/16/24/32 —
>   byte-identical to before. Every preset is now bounded: Sharp 2/8/12/16 … Pill
>   6/24/36/48. The look is carried by the ramp, which is what the roundness slider
>   edits, instead of by an offset nobody can see.
> - **Store v67 is provably a no-op for existing systems.** The new rungs are exactly
>   HALF the old ones, so re-grading a graded ramp `lg → 2×lg` reproduces every role's
>   pixels at every preset — asserted in `layoutTokens.test.ts`, which is the test that
>   stops v67 silently restyling anyone. `isGradedRadiusRamp` checks the ramp is
>   something `scaleRadiusFromLg` produced (a preset, the slider, the seed) before
>   touching it; a HAND-EDITED ramp keeps its values and gets the OLD rungs pinned
>   explicitly instead, and `radiusRolesAreLegacyDefault` skips any role someone picked —
>   the same detect-don't-assume rule v47/v49 use.
> - **`styleLayout` HAS NO CALLER, and never had one.** The concentric `control ⊂ action`
>   guarantee this file describes for the presets ("a Pill style cannot ship a chip that
>   collides with its field") was documentation only — not one preset spread it, so no
>   preset ever shipped a `radiusRoles` map. `styleRadiusRoles` is the live replacement
>   and every preset now uses it: `control = concentricRadiusStep(action, inset-control)`,
>   i.e. Steve Ruiz's r = R − p, which `nestedRadius` already implemented. Where the
>   padding leaves no room it returns `none`, which is the geometrically honest answer,
>   not a failure. After: `control ⊂ action` clears on all six styles (it was broken on
>   Neo before, and on Core/Neo/Retro at the corrected rungs without this).
> - **`container ⊂ overlay` is still reported broken on four styles, deliberately.** That
>   pair is the documented designer tension — `radius.container` is every card's radius
>   system-wide, so constraining it to a modal's padding would flatten cards nowhere near
>   a modal. `radiusNestingReport` surfaces it; nothing silently fixes it.
> - **A button inside a card is NOT a nesting pair.** It floats with padding on all sides,
>   so it carries no concentric constraint — only flush pairs (a chip against a field's
>   inner edge, a card filling a modal body) are in `RADIUS_NESTING`. Worth restating
>   because it is the first "violation" any audit of this invents.
> - **Material moved from the Pill preset to Rounded.** M3's own shape scale puts a card
>   at 12px and its largest container at 28px; Pill resolves this style's `container` to
>   36px, rounder than anything in the spec it is named after. Glass and Nature keep Pill
>   — "generous" and "organic" are their briefs, and at the corrected rungs that is 36px,
>   not 72px.

> **UPDATE (supersedes the ramp-picking half of the note above): radius is THREE
> INDEPENDENT AXES — Boxes · Fields · Selectors — the way DaisyUI splits it.** Moving the
> roles down bounded the numbers but left the real defect in place: one roundness dial
> graded the whole ramp, so every role moved together and picking Pill turned the CARD
> into a stadium along with the checkbox. Reported as "si decido tomar radius pill el
> sistema coloca el main box de esa manera haciendo imposible la lectura… es un caos".
> Rounding a checkbox and rounding a modal are not the same decision and must not share
> a control.
> - **`RADIUS_GROUPS` (`layoutTokens.ts`) is DaisyUI's `--radius-box` / `--radius-field` /
>   `--radius-selector`, expressed over the roles this system already ships** — boxes
>   drives `container` + `overlay`, fields drives `action`, selectors drives `control`.
>   The token contract is unchanged; only WHICH step each role aliases is now picked per
>   axis instead of derived from a single `lg`. `RADIUS_GROUP_STEPS` is the reference's
>   own ladder — at the standard ramp `none · xs · sm · lg · 2xl` = **0 / 4 / 8 / 16 /
>   32px**, i.e. 0, 0.25rem, 0.5rem, 1rem, 2rem exactly.
> - **`pill` is deliberately NOT an axis.** It means "this is a circle" (avatar, progress,
>   switch track), not "somewhat rounded", so it stays `full`; folding it into Selectors
>   would square off every avatar the moment someone picked a tighter checkbox. That is
>   the one place these groups diverge from DaisyUI, whose selector axis also covers the
>   badge.
> - **No axis is derived from another, and that cost a feature on purpose.**
>   `styleRadiusRoles` used to re-derive `control` concentrically from `action`
>   (r = R − p). That re-couples two of the three axes — a tighter Field would silently
>   square every checkbox — and it is wrong for the common case anyway, since a
>   standalone checkbox sits on the page, not flush inside an input. Collisions are
>   REPORTED (`radiusNestingReport`), never steered: the same report-don't-steer policy
>   already applied to `container ⊂ overlay`. `concentricRadiusRoles` survives for the
>   advanced editor's regrade, where it only moves a role that was still tracking.
> - **The quick rail no longer edits the RAMP.** Five ladder steps meaning the same
>   pixels on every axis is what makes the three comparable, so regrading belongs in the
>   Variables editor. The preset grid + roundness slider are gone from `RadiusCard`;
>   `setRadius` went with them.
> - **Every style sits on `RADIUS_STANDARD` now and differs only by its three picks** —
>   which is the personality, and is bounded by construction. Resolved card / button /
>   checkbox: Core 16·8·4 · Neo 0·0·0 · Glass 32·32·8 · Material 16·32·4 (M3's pill
>   button over a moderate card) · Retro 4·4·0 · Nature 32·16·8. The old model could not
>   express Material at all — one dial cannot give you a pill button AND a 16px card.
> - **Defaults are a deliberate recalibration, not a no-op** (unlike v67 directly above).
>   `action` sm, `container`/`overlay` lg, so the resolved ladder is **selectors 4 ·
>   fields 8 · boxes 16** — strictly increasing, every default ON the ladder so each
>   picker opens with its own value selected rather than reading "Custom", and the box no
>   longer the roundest thing on screen. `overlay` collapses onto `container` because the
>   reference has ONE box radius for card and modal alike; the role is kept so the export
>   does not change.
> - Verified live: setting Selectors to the roundest step took the checkbox 4px → 32px
>   while the card stayed 24px and the button 16px. A test asserts that independence
>   directly, so a future change that re-couples the axes fails rather than just looking
>   wrong.
> - **Variables speaks the same three words.** `LAYOUT_ROLE_GROUPS.radius` was still
>   `Control / Surface` — the two surfaces already wrote ONE `radiusRoles` map (the rail's
>   axis picks and the Variables role editor are the same data), but described those five
>   roles two different ways. It is `Boxes / Fields / Selectors` there too now. `pill`
>   sits under Selectors: it is that family (badge, avatar, switch) even though it is not
>   an AXIS, so the rail never drives it and it stays editable in Variables only.
> - **The PRESENTATION is Figma node 4185:21283** (`portfolio` file), adapted. A brief
>   bare-arc version came first — no tile, just an SVG quarter arc, selection = stroke
>   going accent — then the designer supplied this. Each option is a **33px well** whose
>   TOP-LEFT corner alone is drawn at that step's radius: an L of `border-left` +
>   `border-top`, other corners square, so the corner IS the sample and nothing draws a
>   competing second corner. The **selected** well fills, its L goes to 2px accent, it
>   takes an inset press shadow, and a **small round badge** in its centre shows the
>   resolved px. The Figma's hardcoded hexes map to chrome tokens: the grey L (`#737375`)
>   → `--fg` at 22%; the selected L and the badge fill (`#285cc3` / `rgba(40,92,195,0.24)`)
>   → `--accent-solid` (the saturated brand, NOT `--accent-ui`, which walks toward the
>   page and reads pastel as a stroke); the selected fill (`#2a2a2d`) → `--elevated`; the
>   badge number (`#abceff`) → `--accent-ui`. The header keeps NO px readout — the badge
>   carries the value — except "Custom" on the right when the axis roles sit off the
>   ladder, the one state the Figma does not cover.

> **Sizes scale from a BASE UNIT, and the multipliers were verified against the shipped
> ramp before anything was built.** `SIZE_STANDARD` (24/32/40/48/56/64) IS `4 ×
> 6/8/10/12/14/16`, so `buildSizesFromBase(SIZE_DEFAULT_BASE)` reproduces it byte for byte
> — that identity is what makes the slider safe to add to an existing system, and
> `layoutTokens.test.ts` asserts it. Same generator shape as Spacing's own
> `buildSpacingFromBase`. Rules:
> - **The base is INFERRED, never stored** (`inferSizeBase` / `inferSelectorBase`). A stored
>   base can silently disagree with the ramp beside it; an inferred one cannot. A
>   hand-edited ramp infers `null`, which the UI shows as "Custom" — the same call
>   `matchRadiusPreset` → `RailSelect`'s `fallbackLabel` already makes. This is also why
>   store v62 adds only `selector`/`selectorRoles`, not two base fields.
> - **`selector` defaults to base 3 (12/15/18/21/24), NOT the 4 the sizing spec proposed.**
>   15 and 18 are exactly what `CheckboxSpecimen`/`RadioSpecimen` hardcoded before the ramp
>   existed, so the migration is a visual no-op; base 4 would have silently grown every
>   checkbox in every saved system from 18 → 24px. Same discipline as v46's `subtle` tint.
> - **WCAG 2.2 target size is met by a transparent HIT AREA, never by growing the glyph.**
>   `HitArea` in `specimens.tsx` wraps the box at `sizeRoleOf(t, 'hit')` (24px) and `hitGap`
>   pulls the label back by the overhang, so the target grows without the optical gap
>   changing. Reuses the existing `hit` role rather than inventing a constant.
> - **Border width drives `stroke.sm` and ONLY `stroke.sm`.** That's the step both
>   `stroke-divider` and `stroke-control` alias, which is what "all components" means.
>   `stroke.md` backs `stroke-focus` and WCAG 2.4.13 puts a 2px floor under a focus
>   indicator — a global multiplier would drag the ring under it at the low end. Verified
>   live: setting the slider to 2px moved `stroke.sm` 1→2 and left `stroke.md` at 2.
> - **Sub-pixel hairlines are floored to 1px below 2dppx, in BOTH renderers.**
>   `hairlineSafe(value, dpr)` (pure — `dpr` is passed in) is applied by
>   `resolvePreviewTokens` for the preview and mirrored by a `@media (max-resolution:
>   1.99dppx)` override in `buildCSS`. On a 1x display a 0.5px border rounds into an
>   artefact; keep the two paths in step or the preview lies about the export.
> - **`selector` is a full `LayoutFamily`** (roles, `--selector-*` vars, W3C, Markdown,
>   tokens.json, agent context all come free through the generic machinery) but it surfaces
>   as a second COLLECTION of the Sizes foundation, not a ninth rail icon — the pattern
>   Spacing already proves. In `sectionExport` it rides on the `sizes` section via
>   `SimpleSpec.extra`, so `ALL_SECTIONS` and the Export wizard's checkboxes are unchanged.
>   In the W3C tree it nests under the `size` root as `size.selector.*`, the same shape
>   breakpoints already take under `grid`.
> - **Deliberately deferred**, and each needs its own token model first: a "Theme recipe"
>   preset, a "Radius Form" axis, and Depth/Noise effect toggles. A control that edits
>   nothing is worse than a missing one. `selector` roles also have no editor yet
>   (`LayoutSemantics` is only ever handed `'size'`) — they ship with their defaults.
> - **Theme Preview's Size-edition quick panel is THREE dials — Fields · Selectors ·
>   Containers** (`ThemeQuickSettingsRail.tsx`). Fields/Selectors are the base-unit
>   scrubbers above; **Containers** is `ContainerInsetCard` — the one dial for how much
>   room every boxed surface leaves inside its edge. It is NOT a `size` token: it moves the
>   **`inset-surface` SPACING role** (`spacingRoles['inset-surface']`, default step 5), the
>   thing `paddingOf` / `SystemCollage` actually read, so the slider snaps across
>   `SPACING_STEPS` (0…16, resolving 0–64px on a 4px base) — the same stepped model as the
>   Stroke control, not free px. `setContainerInset` writes BOTH the role AND the four-sided
>   `padding` mirror (`insetSurfacePadding`), so `--spacing-inset-surface` and `--padding-*`
>   can't drift after a quick edit (the `padding` field is documented in `tokenGenerator`
>   as "resolved px of spacing-inset-surface"). "Reset sizes to the standard ramp" resets
>   all three; its visibility condition checks the inset role too. The readout guards on
>   `Number.isFinite`, not `|| 20` — step 0 is a legitimate `0px`.

> **Token value fields scrub like Figma's — `ui/ScrubInput.tsx`, one component, every
> table.** Drag the double-chevron handle left/right and the number follows; Shift ×10,
> Alt ×0.1, and ArrowUp/Down on the input do the same thing from the keyboard. Used by
> `VariablesTable` (Spacing · Radius · Sizes · Grid · Shadow) and Typography's own
> `ValueInput`, which is the same field in a section that builds its rows by hand.
> - **The handle is a separate hit target, not "drag anywhere on the field".** These are
>   TEXT inputs — dragging across text means selecting text, and hijacking that would kill
>   click-to-place-caret and double-click-to-select-word, the two things people actually do
>   in these cells. Figma splits it the same way. Typing is completely unchanged.
> - **Whether a row scrubs is read from its VALUE, never declared per table**
>   (`isScrubbable`): strictly `number + optional unit` (`12`, `4px`, `1.5rem`, `100%`). A
>   compound CSS value (`0 1px 2px rgba(…)`) has no single number to own and a font family
>   has none at all, so Shadow's rows get a plain field — verified: no handle, and no
>   reserved slot either, so Shadow keeps its full width for the long strings.
> - **The slot is reserved per GROUP, from the UNFILTERED rows.** Per-row reservation would
>   stagger the inputs in a mixed group; deriving it from the *visible* rows would make a
>   search that leaves only non-numeric rows drop the slot and shift every input sideways
>   mid-keystroke. Verified: Grid's four rows (incl. the unitless `12`) all sit at one x.
> - **Round the TRAVEL, not the result.** `clientX` is fractional on a scaled/HiDPI display,
>   and unrounded it leaks into the token — an early drag here produced `101.668px` for a
>   whole-pixel spacing step. Quantising the travel and pricing each pixel at one step also
>   keeps Shift honest: it moves in 10s *from where the value started* rather than snapping
>   to the nearest absolute multiple of 10 the moment it's held.
> - **`setPointerCapture` is best-effort and runs AFTER the drag state is armed.** It throws
>   on a pointerId the browser no longer considers active, and a throw in `pointerdown`
>   would abort the handler with no origin recorded and `document.body`'s cursor/user-select
>   never restored. Capture (not window listeners) is right here because the gesture leaves
>   the ~14px handle immediately.
> - **`rem`/`em` step 0.1, everything else 1** — 1rem is a whole type step, so a
>   pixel-per-rem drag would fly past every value worth landing on.
> - **Clamped at 0 only when the value STARTED non-negative**, inferred from the value
>   rather than hardcoded: every token in these tables is non-negative and a negative one is
>   invalid CSS, but the inference keeps the component honest if it's ever pointed at
>   something that can legitimately go below zero.
> - **Watch what you drag in Spacing.** `spacing` only stores steps 1–8; 10/12/16 are
>   DERIVED as `step × base`, and the base is inferred from `spacing-1` at mount. So
>   scrubbing `spacing-1` silently rescales the three derived steps on the next visit. That
>   is pre-existing behaviour, not something the scrub handle introduced — but the handle
>   makes it a one-gesture accident, so it's worth knowing before "fixing" the derived rows.

**Important:** This is **not a wizard** — no global step counter, no Continue/Back, no locked
steps. `currentStep`, `styleDirection`, `selectedAtoms` stay removed. The old
`FoundationsEditor` (in-Foundations stepper) and `ComponentCatalogue` were **retired** — their
roles moved into `SectionRail` + `ComponentsView`/`DocsView`. Don't reintroduce a persistent top
header or a stepper.

---

## Folder Structure

```
src/
├── components/
│   ├── configurator/       ← TopNav (global nav), SectionRail (Components' left category rail), FoundationIconRail (Variables' horizontal foundation switcher, replaces SectionRail there), QuickFoundationsPanel (Quick edit popover), ColorHub + ColorPrimitives (Color's three tabs — Primitives now owns the family nav + quick-edit strip too), ThemePanel (THE one create/edit-theme surface, docked flush against the Color Variables column — see its note), ComponentsView (the component catalogue: rail + master list + article) and DocsView (the token reference: master list + article, no outer rail) — two separate top-nav destinations sharing docs/'s articles and blocks, IconLibrary, ExportView, FigmaSyncView + FigmaDownloadView (figmaShared.tsx), GitHubConnectView, VariablesTable (generic filterable token table) + Step2…Step9 + StepGradients (foundation sections). WorkbenchLayout, PickerColor, NewTokenWizard and HomeActions are retired (kept for reference only, see Navigation model)
│   ├── ui/                 ← Shared primitives (Button, Input, Badge, ColorField — the rich HSV+opacity+hex+saved picker…)
│   └── preview/            ← PreviewPanel (sticky, category-aware), ButtonPreview + atoms/ (InputPreview, BadgePreview, TogglePreview, SignUpCardPreview, FontFamilyPreview — the Typography category's family modal + SemanticSpecimens — the five Alias/Semantics per-group specimens, architecture-aware)
├── store/
│   └── useDesignStore.ts   ← Single Zustand store with persist middleware (version 62)
├── lib/
│   ├── colorUtils.ts          ← generateColorScale, buildScale, accessibleSolidTone, solidInkPair (chroma-js). Owns RAMP CONSTRUCTION only — the contrast formulas live in color/ and checkContrast delegates there (see Colour layer under Conventions)
│   ├── color/                 ← the metrics layer, ZERO runtime deps and DOM-free
│   │   ├── apca.ts               ← APCA-W3 0.1.9 (apcaLc, signed Lc), WCAG 2.x (wcagRatio, wcagLuminance), IntentClass + INTENT_THRESHOLDS, evaluate(). THE single WCAG implementation in the codebase
│   │   ├── gamut.ts              ← OKLab↔sRGB (CSS Color 4 XYZ path, full precision), gamut mapping (gamutMapSrgb, oklchToHex), deltaEOK, hexToLinearRgb. THE single sRGB transfer function. Replaces per-channel clipping
│   │   ├── cvd.ts                ← colour-vision-deficiency simulation (Machado 2009 sev 1.0) + validateCategorical() — the gate every categorical/chart palette must clear. Never eyeball CVD; run this
│   │   ├── scaleMatch.ts         ← shared ΔE_OK scale ranking (rankScales/asLch) — used by every vendor derivation so they cannot disagree
│   │   ├── audit.ts              ← the contrast-matrix engine. ONE implementation, two consumers: scripts/color-report.ts and __tests__/contrast-matrix.test.ts
│   │   ├── antDesign.ts          ← byte-identical port of @ant-design/colors v8 (HSV, hueStep 2°). Proven against the package
│   │   ├── radix.ts              ← byte-identical port of generateRadixColors (reference transposition, bezier, CIE Lab D50 mixing). Proven against the upstream file in test-fixtures/
│   │   ├── tailwind.ts           ← Tailwind v4's published OKLCH palette + an HONEST derivation (provenance: 'tailwind' | 'escala-derived'). Tailwind has no generator
│   │   └── *Reference.ts         ← GENERATED and COMMITTED (npm run gen:*-reference). Never hand-edit; a companion test asserts each regenerates byte-for-byte. (carbon.ts/carbonReference.ts DELETED with the Carbon architecture — see the semanticArchitectures.ts note below)
│   ├── __tests__/             ← vitest suite (npm test). apca · gamut · cvd · ramps.golden (124 snapshots) · ramps.invariants · no-duplication · contrast-matrix · ant-design · radix · tailwind · chart-palette (renamed from shadcn.test.ts — the shadcn CONTRACT tests were deleted with the architecture, the CVD-validated chart-palette tests they sat beside were not)
│   ├── componentCatalogue.ts  ← ComponentDef type, COMPONENTS array, CATEGORIES, COMPONENT_KEYS (pure data)
│   ├── iconLibraries.ts       ← ICON_LIBRARIES (incl. iconifyPrefix for the live Iconify browser), getIconLibrary(), SAMPLE_GLYPHS (pure data)
│   ├── previewTokens.ts       ← resolvePreviewTokens()/usePreviewTokens() — single source for live-preview tokens; ARCHITECTURE-AWARE (see below)
│   ├── gradients.ts           ← GradientDef/GradientAssignments types + gradientToCss()/gradientSlug()/makeDefaultGradients() (pure data)
│   ├── typographyStandard.ts  ← Type-scale/weight/family token standard + categories (pure data)
│   ├── fonts.ts               ← FONT_PRESETS, POPULAR_GOOGLE_FONTS, fontStack(), loadGoogleFont()
│   ├── semanticArchitectures.ts ← the ONE semantic token architecture: metadata + a pure projection of the flat role catalogue — projectCategorical() (DTCG-style grouped tree, 51 roles — 16 of them backed by an alpha primitive), projectArchitecture() dispatcher (returns null for anything but 'categorical'). Astryx/shadcn/Vibrancy/Tonal/Carbon projections — ~850 lines — were DELETED, not hidden; don't reintroduce one as a second projection, extend CATEGORICAL_ROLES or the {fam.solid}/{on:}/{ink:}/{ui:}/{ui+:}/{step:} marker vocabulary instead
│   ├── tokenGenerator.ts      ← generateTokenJSON(), downloadTokenJSON()
│   ├── exporters.ts           ← buildCSS()/buildMarkdown() — shared by ExportView + GitHubConnectView
│   ├── github.ts              ← GitHub REST client (PAT in localStorage 'sd-github-token', NEVER in the store): validateToken, listRepos, createRepo, pushFiles (Contents API, sequential)
│   └── utils.ts               ← cn(), slugify(), sanitizeSvg() helpers
├── types/
│   └── tokens.ts           ← TypeScript types for DesignTokens, ColorScale, etc.
└── pages/
    └── Configurator.tsx    ← shell: TopNav over (sub-rail + center editor + PreviewPanel)
api/
└── tokens.ts               ← Vercel serverless: GET returns Blob, POST saves to Blob
scripts/
├── bundle-plugin.mjs       ← zips the sibling Figma plugin → public/escala-figma-plugin.zip + regenerates src/lib/pluginVersion.ts (PLUGIN_VERSION + content-hash PLUGIN_BUILD) (npm run bundle:plugin)
├── color-report.ts         ← the contrast audit: every architecture × theme × role pair, WCAG + APCA (npm run color:report)
└── gen-*-reference.ts      ← regenerate the committed vendor tables from the installed packages (npm run gen:radix-reference, gen:tailwind-reference — gen-carbon-reference.ts was deleted with the Carbon architecture)
test-fixtures/
└── upstream-generate-radix-colors.ts ← VENDORED radix-ui/website generator, verbatim except a removed "use client" and a @ts-nocheck header. The reference radix.ts is proven byte-identical against. Do not "fix" it
docs/
└── color/                  ← RESEARCH-PLAN.md (diagnostic audit, 9 workstreams, phases P0–P6) + IMPLEMENTATION-LOG.md (one section per phase: what landed, duplication register, measured diffs). APPEND to the log, never start a second file
.claude/
└── skills/
    └── color-science-core/ ← portable colour-maths skill, auto-loaded by sessions in this repo. SKILL.md routes to references/{color-spaces,gamut-mapping,wcag2,apca,delta-e}.md; scripts/contrast.mjs is a dependency-free CLI validator
types/
└── vendor.d.ts             ← narrow ambient declarations for apca-w3 + colorparsley (untyped devDeps used only by the conformance test). Deliberately NOT a blanket `declare module` — that would hide a signature change
reports/                    ← GITIGNORED. Generated by npm run color:report
vitest.config.ts            ← environment: 'node' — the colour layer must stay DOM-free
tsconfig.app.json           ← the SHIPPED code. Includes src, EXCLUDES tests. types: ['vite/client'] — the app must not be able to reach Node globals
tsconfig.test.json          ← tests + scripts/ + types/. types: ['node']. Every other option MIRRORS the app project on purpose (it pulls src/lib in as a dependency graph)
tsconfig.json               ← solution file; `tsc -b` (i.e. npm run build) runs all three projects
```

---

## State Shape (useDesignStore)

Key fields — always use the store, never local state for cross-view data:

| Field | Type | Edited in |
|-------|------|-----------|
| `projectName` | string (default `"Escala"`) | Home (hero input) + Export pane (editable pill) |
| `projectDescription` | string (flows into the README intro) | Home |
| `figmaLastPublishAt` / `githubRepo` / `githubLastPushAt` | string \| null — connection status shown on Home; written by the connect views | Home (read-only) |
| `pageBackground` | string (hex, default `#ffffff`) — anchors tone 1 of every generated **light** ramp (`generateColorScale`'s 4th arg) and is the compositing base for the exported alpha ramps (`colors.primitiveAlpha` via `generateAlphaScale`). **DERIVED, never picked** — `backgroundFromBase(grayBaseColor, 'light', neutralTint)`, HeroUI's model: one Base drives every surface | derived (Base · tint) |
| `darkBackground` | string (hex, default `#0c0e12`) — the dark-theme page. Anchors **tone 12** of `grayDarkScale` (dark themes read the gray hierarchy inverted, so `surface-0` → tone 12). Also **DERIVED** — `backgroundFromBase(grayBaseColor, 'dark', neutralTint)` | derived (Base · tint) |
| `grayDarkScale` | ColorScale — dark-appearance neutral ramp, generated by `generateDarkColorScale(grayBaseColor, …, darkBackground)`. Gray roles in a dark theme resolve from **this**, not `grayLightScale` (`sourceScaleFor` → `GlobalScales.grayDark`). Default seed + fallback is `DEFAULT_GRAY_DARK_SCALE` — computed via the real generator at module load, so it can't drift from what editing the gray colour would actually produce (see below); NOT the old fixed `GRAY_DARK_SCALE` constant, which is inverted relative to the current model and is kept ONLY for one legacy migration | derived (accent · neutral · dark background) |
| `neutralTint` | `'pure' \| 'subtle' \| 'tinted' \| 'vivid'` (default `subtle`) — how much of the Neutral's chroma reaches the page (`NEUTRAL_TINTS`). Part of `DesignSnapshot`, not a global preference: it changes the generated ramps | Color · Primitives (Scale settings gear) |
| `primaryColor` | string (hex) | Foundations · Color |
| `primaryScale` | Record<number, string> | Foundations · Color |
| `grayLightScale` | ColorScale | Foundations · Color |
| `errorColor/Scale`, `warningColor/Scale`, `successColor/Scale`, `infoColor/Scale` | ColorScale | Foundations · Color |
| `customColors` | CustomColor[] (`{ key, label, base, scale }` — named families with auto 1–12 scales; keys in `RESERVED_COLOR_KEYS` are blocked) | Foundations · Color |
| `semanticArchitecture` | `'flat' \| 'categorical'` (Astryx/shadcn/Vibrancy/Tonal/Carbon retired then deleted — see the semanticArchitectures.ts note) — which shape the export projects the 89-role catalogue into (`lib/semanticArchitectures.ts`). The flat matrix is ALWAYS the editing surface; Categorical ships additively as `colors.architecture` in tokens.json (plugin contract untouched) | Color · Alias/Semantics |
| `themes` | Record<theme, Record<role, hex>> — `light`/`dark` always exist (protected); user themes via `addTheme(key, base)` duplicate an existing one. Role keys use the **readable taxonomy**: `surface-*` (page/card levels), `action-*` (button/control fills), `status-*` (feedback fills), `text-*`, `icon-*`, `border-*`. Defined once in `ROLE_GROUPS` (`Step3_SemanticTokens.tsx`); `SEMANTIC_KEY_RENAME` (store) migrates old v23 keys | Foundations · Semantic |
| `themeOrder` | string[] (column order, default `['light','dark']`) | Foundations · Semantic |
| `themeKinds` | Record<theme, 'light'\|'dark'> — drives recommended tones + which gray ramp seeds a theme | Foundations · Semantic |
| `typography` | { fontFamily, headingFontFamily, sizes, lineHeights, weights } | Foundations · Typography |
| `spacing` | Record<string, string> | Foundations · Spacing |
| `padding` | Record<'top'\|'right'\|'bottom'\|'left', string> — per-side surface inset for padded surfaces (collage tiles, Card, sign-up card via `paddingOf()`); exported as `padding` in tokens.json + `--padding-*` CSS vars | Quick edit · Padding |
| `gradients` | GradientDef[] (`{ id, name, type: 'linear'\|'radial', angle, stops: {color,pos,tone?,darkColor?}[], linked? }`) — named gradients; `gradientToCss(g, appearance)` builds the CSS. **A linked stop REFERENCES a primitive**: `tone` is the accent-ramp step it reads, `color` caches `primaryScale[tone]` and `darkColor` caches `primaryDarkScale[tone]` — re-resolved by `useApplyAccentColor` via `linkedStopsFor(id, scale, prevStops, darkScale)`. Exported as `gradients` + `gradientsDark` (slug→css) in tokens.json, `--gradient-*` CSS vars (dark overridden inside the `.dark` block) + a Light/Dark README table | Foundations · Gradients |
| `gradientAssignments` | `{ cover, avatar }` (gradient id or null) — which gradient drives each preview surface: HomeView's card cover (`GlassPanel`) + solid avatars (`AvatarRound`), resolved into `PreviewTokens.coverGradient`/`avatarGradient` | Foundations · Gradients |
| `savedColors` | string[] — the custom `ColorField` picker's "Saved" swatch library (hex, alpha-aware) | any ColorField |
| `radius` | Record<string, string> | Foundations · Border Radius |
| `iconLibrary` | string (default `"lucide"`) | Foundations · Icon Library |
| `customIcons` | { name, svg }[] — uploaded SVGs, sanitized via `sanitizeSvg()` (utils.ts) before storage; exported under `icons.custom` | Foundations · Icon Library |
| `shadows` | Record<string, string> (xs–2xl CSS box-shadows) — the LIGHT ramp. The dark twin is DERIVED (`darkShadowMap`), not stored: see "Shadows ship a DARK TWIN" | Foundations · Shadow |
| `grid` | Record<string, string> (columns/gutter/margin/container + breakpoints) | Foundations · Grid |
| `sizes` | Record<string, string> (component heights xs–2xl) | Foundations · Sizes |
| `selector` / `selectorRoles` | Record<string, string> — the SQUARE a checkbox/radio/switch knob is drawn in (xs–xl), + its intent aliases. A separate ramp from `sizes` because a glyph isn't a control height: 24px is `size` xs and `selector` xl | Sizes · Selectors collection, or the Theme Preview rail |
| `selectedComponents` | string[] (defaults to **all** `COMPONENT_KEYS`) | Components |
| `completedFoundations` | string[] (`color`/`semantic`/`typography`/`spacing`; gamified progress) | Rail ✓ |

**Removed fields:** `styleDirection`, `selectedAtoms`, `currentStep` — do not re-add these. Nav state (`tab`, `activeFoundation`, `activeComponent`, `exportMode`, `railOpen`) is local `useState` in `Configurator.tsx`, not the store.

Other key fields: `projectCreated` (gates Home + rail/TopNav pre-creation) and
`savedSystems: SavedSystem[]` (multi-DS registry — `{ id: "owner/repo", name, description,
repo, savedAt, snapshot: DesignSnapshot }`; written only by a successful GitHub push).
`makeDesignDefaults()` is the single source for initial + reset design state;
`captureSnapshot()` deep-clones the design fields. Both exported from the store.

Store uses `persist` middleware with `version: 62`. If you add fields, bump the version and add a migrate function (append-only — never reorder existing migration blocks; to reverse an earlier block, neutralize it in place and add a NEW one, as v42 did to v38's naming force). New design fields also go into `DesignSnapshot`/`makeDesignDefaults()`; global preferences (like `autoSyncFigma`) stay top-level, out of the snapshot.

> **"Linked to accent" means a gradient stop REFERENCES a primitive — not that it's frozen.**
> `GradientStop.tone` is the accent-ramp step the stop reads; `color` is only a cache of
> `primaryScale[tone]`. Linking used to mean stops computed by ad-hoc HSL math off the raw
> accent hex (`brandCoverStops`/`brandAvatarStops`), producing colours that existed nowhere
> in the primitives — so a gradient that claimed to be on-brand shipped loose hex the plugin
> and the CSS could never alias, and the editor could only print that hex because there was
> no primitive to name. Rules that keep this honest:
> - **`linkedStopsFor(id, scale, prevStops, darkScale)` is the ONE resolver** — the editor's lock, the
>   accent retint (`colorActions`) and the v45 migration all go through it. It takes `prev`
>   so a retint re-resolves the user's OWN tones, positions and stop count rather than
>   resetting to `LINKED_GRADIENT_TONES`' default signature.
> - **Linking constrains COLOUR only.** Position edits, adding a stop and removing a stop
>   all stay live while linked (they used to be disabled, which read as "a linked gradient
>   is frozen"); a stop added while linked is tone-backed and survives the next retint. The
>   colour cell swaps to a tone ramp + the token's name (`accent-9`) instead of a hex field
>   — a linked stop names its primitive, an unlinked one keeps the raw picker.
> - **`derivedStopsFor` is LEGACY and migration-only.** The v35→v36 / v36→v37 blocks must
>   keep producing exactly what they always produced, so it stays untouched. Nothing live
>   may call it.
> - **A gradient has TWO appearances, and the linked ones get theirs for free.**
>   `GradientStop.darkColor` is the dark value; absent ⇒ the stop renders its light colour
>   in both, which is the pre-v48 behaviour and the honest default. For a LINKED stop it is
>   DERIVED, never hand-set — the same `tone`, resolved against `primaryDarkScale`, exactly
>   the Radix two-scale model the rest of the system follows ("step N means the same role in
>   both appearances, no inversion anywhere"). This is the payoff of the reference model:
>   because the stop is a reference and not a hex, there is a second ramp to resolve it
>   against. Consequences to keep:
>   - **`gradientToCss(g, appearance = 'light')` defaults to light**, so every call site that
>     predates this keeps emitting byte-identical CSS. `stopColor(s, appearance)` is the ONE
>     place the fallback lives — don't inline `s.darkColor || s.color` anywhere else.
>   - **An UNLINKED stop's dark value is the user's own pick, and is never guessed.** A
>     hand-picked hex has no ramp; darkening it algorithmically would silently restyle a
>     colour someone chose. The editor shows "same as light" until they set one, with a
>     reset back. v48 backfills linked stops ONLY, for the same reason.
>   - **The editor edits the PREVIEWED appearance** (`previewTheme` → `themeKinds` → light |
>     dark), with the same eye toggles the Primitives columns use — one "which one am I
>     looking at" concept app-wide. Row 1 shows BOTH bars side by side, each on its own page
>     (`light`/`dark` classes), because a gradient is judged against the page it ships on and
>     a toggle would put the comparison a click apart.
>   - **The export is ADDITIVE**: `gradients` is unchanged, `gradientsDark` is a complete
>     parallel map under the SAME slugs (a gradient with no override resolves to its light
>     CSS there, so a consumer never has to test which keys exist). `schemaVersion` stays 4 —
>     an older plugin ignores the new key. The CSS overrides `--gradient-<slug>` INSIDE the
>     existing `.dark` block rather than minting a `--gradient-*-dark` name, so consuming a
>     gradient never needs a theme check; only gradients that actually carry an override are
>     emitted there.
>   - **A linked gradient's dark version follows the ROLES, not the look.** `brand-cover` is
>     tones 9→12; in light that reads solid→deep, in dark it reads solid→pale, because tone
>     12 is the accessible-text end of whichever ramp it sits on. That is correct by
>     construction and the same thing the semantic layer does — if a gradient genuinely needs
>     a different shape per appearance, that's what unlocking is for.
> - **`lib/gradients.ts` stays dependency-free** (its header says so, and it matters): the
>   default accent ramp is generated in the STORE (`DEFAULT_ACCENT_SCALE`, computed at
>   module load by the real generator, same pattern as `DEFAULT_GRAY_DARK_SCALE`) and passed
>   into `makeDefaultGradients`. Importing `generateColorScale` into gradients.ts instead
>   created a module-init cycle — `makeDesignDefaults()` runs at import time and found the
>   generator undefined. Seeding it this way is also what makes a BRAND-NEW system's linked
>   gradients tone-backed from the first render, rather than waiting for the first accent
>   edit (the same fresh-system-default bug class as the old `GRAY_DARK_SCALE` seed).

> **Deleting a theme is reachable from the Primitives rail, not just Semantics.** The
> family nav's per-family trash is LOCKED while any theme references that family ("remove
> the theme first") — and the only place to remove a theme used to be Semantics' column
> header, a different tab, so a family minted by "+ Theme" was effectively undeletable from
> the screen that shows it. Each THEME folder header (never `BASE_FOLDER`/`CUSTOM_FOLDER`)
> now carries a hover trash opening the SAME `DeleteThemeModal` Semantics uses (shared from
> `colorControls` — one destructive action, one warning, or one entry point would under-state
> what the other destroys). Deleting the theme frees its families into **Custom**, where the
> existing per-family trash already unlocks. No colour data is destroyed — only the theme
> and the semantic values mapped to it.

> **The chrome accent ramp is resolved in the CHROME's appearance, never the previewed
> theme's.** `uiAccentRamp = themeBrandRamp(previewTheme, …, theme === 'dark' ? 'dark' :
> 'light')` — the previewed theme's brand FAMILY (`themeSources`), but its light-or-dark
> twin picked by the workspace's own `sd-theme`, not `themeKinds[previewTheme]`. Preview
> appearance and chrome appearance are decoupled in the Themes workspace (inspecting a
> LIGHT theme's Light face in dark mode is normal), and every chrome derivation below
> (`--accent-ui`, `--accent-solid`, the Layer 0 gradient, the toolbar wash) is read
> against the CHROME page — so feeding it the light twin bled a bright splash across the
> dark chrome and dropped the accent-fill contrast (reported: "el gradient de un theme
> light dentro del global dark tiene fallos… genera un problema de accesibilidad al
> leer"). `themeBrandRamp`'s `kindOverride` param does this; the preview canvas
> (`PreviewPanel`, artefacts, specimens) still resolves in `previewAppearance`.
>
> **A live STYLE TRY-ON outranks the previewed theme for that ramp — the chrome has to be
> reading the same system the canvas is.** `themeBrandRamp` resolves from the REAL store,
> which a try-on deliberately never touches (`stylePreviewOverlay` is an overlay, nothing
> persists), so selecting a System Style repainted the canvas and left every chip, wash and
> accent-filled control in the workspace on the open system's accent — the traditional
> violet beside a blue Core. Two accents on screen from one selection, the same defect
> class the `slotOf` candidate-list note describes for specimens. `stylePreviewBrandRamp`
> (exported from `stylePreviewOverlay`, sharing the overlay's OWN derivation — same
> `previewHarmony` pages, same algorithm, same contrast shift, never a second simpler one)
> supplies it while `stylePreview` is set. Same appearance rule: the CHROME's, not the
> preview's.
>
> **Artefact gradients follow it too, and that needed a separate fix one level down.**
> `previewTokens`' `gradientCssFor` passed `pal?.brand` — the theme's resolved brand ramp —
> and `pal` is `undefined` for any theme with no `themeSources` entry, which is BOTH the
> built-ins and every try-on (the overlay drops that entry on purpose). Falling through to
> the stops' cached hexes there is what kept the Login artefact's Acme mark and the card
> cover violet on a blue screen: a linked stop is a REFERENCE (`tone`), so it must resolve
> against whichever accent ramp is actually in play. It now falls back to the STORE's own
> brand ramp for the appearance — which, in a try-on's overlay store, IS the preset's ramp.
> **Provably inert for the ordinary case**: `linkedStopsFor` caches exactly
> `primaryScale[tone]` / `primaryDarkScale[tone]` into the stops, so the fallback resolves
> to the same hexes it replaces (verified live on the built-in Light theme —
> `#9522e9 → #472668`, byte-identical), and an UNLINKED stop has no `tone` to resolve, so a
> hand-picked colour is never re-derived.
>
> **With no theme of their own, the workspace LANDS on Core / Minimalist tried on — gated
> on `hasOwnTheme`, NOT on `firstRun`.** `ThemeLibraryRail`'s mount effect seeds that
> try-on so the default state is a real, opinionated system with its row expanded and "Add
> to system" one click away, rather than the bare violet default. Nothing is committed —
> a try-on is an overlay, so Core is SHOWN, never silently added to My themes. It was
> gated on the first-visit flag, which meant the default appeared exactly once: a reload
> landed the same theme-less user back on the bare default, i.e. the state the seed exists
> to avoid. Mount-only, so closing the try-on stays closed for the session; it re-seeds on
> a rail remount (a tab round-trip) and stops for good once a theme is committed.
>
> **The active `FoundationIconRail` glyph tracks `--accent-ink`, via a CSS mask.** It was
> hardcoded `brightness-0 invert` (always white), which vanished on a pale `--accent-solid`
> (a pale accent keeps the fill pale and flips the ink to near-black — `solidInkPair`).
> The active button now renders the icon as a `<span>` with `mask-image: url(<svg>)` +
> `background-color: var(--accent-ink)`, so it follows whatever ink was actually solved.
> Inactive stays a plain `<img>` (`opacity-90 dark:invert`).
>
> **The chrome's accent is DERIVED for contrast, exactly like the tokens it sits next to —
> and INK and FILL are two different derivations.** Three CSS vars, all written by
> `Configurator.tsx` and nothing else:
> - **`--accent-ui`** = `chromeAccent(scale, page, fallback)` (`colorUtils.ts`) — walk UP
>   from the anchor (tone 9) until the tone clears **4.5:1 against the chrome page**. This
>   is for everything READ AGAINST THE PAGE: `text-accent-ui` titles, links, active nav,
>   and the small graphical marks (modified dots, tab underlines, connector rules, the
>   `/[0.06]`–`/[0.08]` tints) that need to be visible on the chrome. It was
>   `primaryScale[9]` raw — the ONE tone with no contrast guarantee — so a pale accent
>   (`#c76aff`) gave **3.03:1** section titles. Now 4.68:1. One upward walk serves both
>   appearances, because every ramp's HIGH tones are its accessible-text end (near-black on
>   a light ramp, near-white on a dark one) — so light chrome reads `primaryScale`, dark
>   chrome reads `primaryDarkScale`, no branching and no hand-brightening.
> - **`--accent-solid`** (`bg-accent-solid`) = `solidInkPair(ramp, [white, near-black]).tone`
>   on the previewed ramp — **the accent as a FILL**, and the same rule `{accent.solid}`
>   resolves through in every architecture (Categorical's `action.primary`, Astryx's
>   `accent.solid`, shadcn's `primary.fill`) and that flat's `background-brand-solid`
>   anchors to. So an accent-filled chrome control is the user's brand solid, **hex for hex
>   with the Color preview's Primary button**.
> - **`--accent-ink`** (`text-accent-ink`) = `readableInk(accentSolid)` — the label ink for
>   an `--accent-solid` fill, solved against THAT fill. **Never hardcode `text-white` on an
>   accent fill**; eight call sites did, which is fine for a dark accent and unreadable for
>   a pale one.
>
> **Why the fill isn't `--accent-ui`.** `chromeAccent`'s walk is a PAGE-contrast rule, and
> a fill isn't read against the page — its label is read against the fill. Solving both
> with one value desaturated the fill to satisfy a constraint it doesn't have: measured on
> accent `#a317e6` in dark chrome, `--accent-ui` landed on dark-ramp tone 11 (`#a557d7`, a
> washed lavender) while the Color preview's Primary button rendered the anchor `#a317e6`
> — the same accent showing as two colours on screen, which is what made the chrome's
> accent buttons look wrong beside the preview. `solidInkPair` also keeps the fill ON the
> anchor for most accents, because flipping the ink is cheaper than darkening the fill:
> verified with `#ffe066`, the fill stays `#ffe066` and the ink flips to near-black, while
> `--accent-ui` correctly darkens to `#89741f` for text. For a well-behaved accent the two
> coincide (`#9522e9` → both `#9522e9`), so this only diverges where it must.
>
> Consequences worth keeping:
> - **Fills that carry a LABEL use `bg-accent-solid` + `text-accent-ink`** (the foundation
>   icon rail's active button, the export wizard's step dots and primary buttons). Marks
>   that carry NO text stay on `bg-accent-ui`, because a 1.5px dot or a 2px underline is a
>   small graphical element on the page and page contrast is exactly what it needs.
> - **A softened accent fill breaks the ink guarantee.** `--accent-ink` is solved against
>   the solid, not against a composite of it, so `bg-accent-solid/[0.83]` would quietly
>   undo the math. Fills that carry a label use the full solid.
> - **The contrast target is `--app`, deliberately** — the same reference the role
>   catalogue uses for every text role (`contrastAgainst: 'background-primary'`). Aiming at
>   `--elevated` would be stricter but forces tone 12 (near-black) for a pale accent, and
>   the chrome stops reading as the user's colour. **Known residual:** accent text sitting
>   ON `bg-elevated` (active table rows) lands ≈3.8:1 — fine as a UI component, short of AA
>   for body text. Fixing it means moving those rows onto an accent tint instead of
>   `bg-elevated`; that's a visual-design change, not a token one.
> - **A background WASH (no text, no swatch) also reaches for `bg-accent-ui`, not a ramp
>   tone.** The foundation-switcher toolbar row (Reset/Save's row, `Configurator.tsx`'s
>   `toolbarWash`) fades `color-mix(in srgb, var(--accent-ui) 10%, transparent)` left to
>   right behind the icon rail — the same "no-text graphical mark" case this whole section
>   covers, just a gradient instead of a dot or underline. A Radix ramp tone (2 or 3) was
>   tried first and read as invisible: those steps are the near-white "background" band,
>   built to disappear, so fading one to transparent over a wide row was indistinguishable
>   from plain white. 10% sits just above the app's established `/[0.06]-[0.08]` tint range
>   on purpose — a gradient's PEAK has to read where a flat fill's average already does.
> - `CenterHeader`'s `accentColor` takes `uiAccent` — it used to re-derive the same
>   expression inline, which is how it drifted into being the most visible 3:1 failure.
>   Anything else needing "the chrome accent" reads the var or that variable, never
>   `primaryScale[9]`.

> **DARK IS THE DEFAULT, and the dark chrome was retuned around one idea: the FILL
> separates a control, the EDGE stops shouting.** Three changes, one theme.
>
> **1. `getTheme()` defaults to `'dark'`.** Only an explicit stored `sd-theme: 'light'`
> opts out, so a first visit AND a storage failure both land dark. `index.html`'s
> pre-paint script must stay the exact inverse (`!== 'light'` → add `.dark`) or the class
> and the app's own read disagree for a frame. Deliberately NOT `prefers-color-scheme` —
> the app ships one default and lets the user switch, rather than letting the OS decide
> what an editing surface looks like. Note `previewTheme` is seeded from `getTheme()`, so
> a first load previews the dark theme too, which is the point. This REVERSED the
> long-standing light default; `.impeccable.md` was updated with it.
>
> **2. The `.dark` palette was re-measured, not re-eyeballed.** Reported as "too loaded":
> with ~227 hand-rolled `border border-line` controls, every button and input drew a
> rectangle in a colour BRIGHTER than its own fill, on top of the column dividers that
> already structure the screen. Measured in **OKLab ΔL** — WCAG is useless this close to
> black, every pair lands 1.1–1.3:1 either way (the same near-black compression the shadow
> note documents):
>
> | | surface/app | edge/app (divider) | edge on its own surface |
> |---|---|---|---|
> | before | 0.060 | 0.124 | **0.064** |
> | after | 0.083 | 0.113 | **0.030** |
>
> The control outline drops to **less than half** its weight, dividers keep ~91 % of
> theirs (they read against `--app`, not against a surface), and a control is *easier* to
> find than before because its fill now separates more strongly than the outline used to.
> - **No accessibility was lost, and this was CHECKED rather than assumed.** The old
>   borders already failed WCAG 1.4.11 badly — **1.18:1** against their own surface,
>   **1.31:1** against the page, against a 3.0 requirement. They were carrying visual
>   weight, never boundary duty. The accessible boundary is the focus ring, which is
>   `--accent-ui`-derived and does pass. **Don't "restore" these borders on an
>   accessibility argument** — they never satisfied one.
> - **Two control patterns exist and only ONE was softened.** `bg-surface border-line` (the
>   fill separates → the edge can recede) vs `bg-app border-line-strong` (no fill
>   difference → the edge IS the only boundary, e.g. the Search field). `--line-strong`
>   moved only #404040 → #3a3a3f for that reason. A blanket softening would have made the
>   second pattern invisible.
> - `--fg-faint` #6b6b6b → **#7b7b83**: on the raised surface it measured **2.68:1**, under
>   the 3:1 floor. Now 3.40 on `--elevated`, 4.05 on `--surface`.
> - Neutrals carry a slight cool tint (`#1c1c1f`, `#232326`, `#3a3a3f`) instead of pure
>   grey. Pure `#171717`/`#262626` is the flat "default dark" look; a trace of chroma is
>   what reads as a deliberate theme.
>
> **3. The Layer-0 wash is SOLVED, not read off a ramp tone — `darkChromeWash`
> (`colorUtils.ts`).** It was `primaryDarkScale[6]`, and picking a *tone* is a
> LIGHTNESS-driven choice, so the stop's saturation was whatever that hue's ramp happened
> to leave there. Measured, the default accent's tone 6 (`#49266c`) sits at L 0.352
> carrying only **63 % of the chroma available at that lightness** — mid-dark AND
> under-saturated is brown, not brand. The reference target supplied for this
> (`#3B0600`) sits at L 0.229 at **100 %** of the wall.
> - The rule is **constant depth, maximum chroma at that depth**: pin L to
>   `CHROME_WASH_L` (0.229, measured off that reference) and take `maxChromaSrgb` at that
>   L for the accent's hue.
> - **Hue-adaptive by construction** — the hue is the only input that varies, so every
>   brand lands equally deep and equally vivid. Verified across 10 seeds; reproduces the
>   reference EXACTLY for a red seed (`#3b0600`) and gives the default violet `#2a0048`.
> - **Cannot leave sRGB**: `maxChromaSrgb` IS the gamut wall, so there's no mapping step to
>   overshoot — it satisfies the "never emit a colour by clipping" rule by construction.
> - The second stop stays `#0a0a0a` because that IS `--app` in dark: the wash has to
>   resolve into the page, not onto a near-match of it.
> - **Light chrome is deliberately NOT routed through this.** Its gradient runs
>   pale-tint → white and has no depth problem to solve; `darkChromeWash` would be
>   meaningless there.
>
> **Not changed, because it was already right:** the default radius ramp. `RADIUS_STANDARD`
> is `RADIUS_PRESETS[2]` ("Rounded") = `xs 4 · sm 8 · md 16 · lg 24 · xl 32`, which is
> exactly the ramp requested — verified through `makeDesignDefaults()`, not just the
> constant.

> **There is ONE "open a token, edit its value" surface in the Color hub:
> `TokenDetailsModal` (`colorControls.tsx`).** Semantics' role rows and Primitives' tone
> rows both open it — same shell (Token Details header + Reset · Name · copyable CSS-var
> chip · Description · "Values"), each caller passing its own editors via **`sections`** so
> the read/write logic stays where it belongs (flat's `TonePicker`, the arch view's
> `ArchModeEditor`, Primitives' light/dark `ColorPickerPanel`). Primitives used to expand
> its rows INLINE instead — two interactions for one job, on two tabs of the same hub —
> so don't reintroduce an inline row editor. It lives in `colorControls` (not Step3)
> precisely so a third caller doesn't fork a copy. Primitives-specific bits: `cssVarName`
> is `color-<token>` because that's what `exporters.ts` actually emits (`--color-accent-9`);
> Description comes from `TONE_DESCRIPTIONS`, keyed off the tone NUMBER like `TONE_BANDS`
> so it survives a naming-scheme change; **Reset means "back to what the generator
> produces for this family's base"**, computed from the SAME generators the family was
> built with (`generateDarkColorScale` for neutral, `generateFamilyDarkScale` otherwise) so
> a reset can never disagree with retinting the family, and it resets BOTH appearances the
> way Semantics' Reset clears every mode. Only one HSV panel renders at a time (both modes
> are listed as selectable rows) — two stacked pickers overflow the dialog for a value you
> edit one at a time.
>
> Three rules the shell itself enforces, so no caller can drift from them:
> - **One `sections` entry per mode, collapsible, and only ONE starts open.** A system with
>   light + dark + two custom themes stacked four full ramp grids in one dialog — the mode
>   you came to edit could be a screen-height of scrolling away. Which one opens is
>   `initialOpenKey`, and every caller passes the **previewed** theme/appearance (not
>   literally the first section), so the dialog opens on the value the user can watch
>   change. The section header owns the mode's name + `KindIcon`; `ArchModeEditor` no
>   longer prints its own, or the label appears twice.
> - **It docks against `anchorRef`'s right edge**, not the viewport centre — callers pass
>   their token table's scroll container, so the dialog opens beside the trailing settings
>   column the row's button lives in instead of covering the values it edits. No anchor =
>   centred fallback. The anchor is the CONTAINER (a fixed column), so it's measured on
>   open + resize only, not on scroll.
> - **Each mode's card is painted in ITS OWN appearance, and shows ITS OWN ramps.** The
>   card carries a `light`/`dark` class (both defined in `index.css`; `.light` exists
>   precisely so a subtree can opt back OUT of dark, which `.dark` alone couldn't) — so a
>   dark mode's swatches are judged on the dark page they ship against, and the light card
>   stays light even while the app chrome is dark. Not a hardcoded colour: it's the same
>   two token sets the whole app uses. The ramps themselves come from **`scaleLookup`**
>   (exported from `semanticArchitectures.ts`), the same resolver the arch table and the
>   export use. `rampsOf` used to read `scales.brand`/`scales.error`/… directly — the LIGHT
>   ramps for every mode — so a dark theme's picker offered light tints and picking one
>   stored a ref that resolves to a completely different dark-twin colour. Every mode
>   rendering an identical grid is what hid it. **If a picker builds ramps without a
>   `kind`, that's the bug back.**
> - **The dialog is 360px (`PANEL_W`), not 256.** At 256 the 12-tone grid had ~136px for
>   twelve cells plus gaps — sub-9px swatches, neither pickable nor readable. Its scrolling
>   body used to opt into `.scrollbar-thin`; that's now just the global default (see below),
>   kept as a class so the call site still reads intentionally.
> - **Inside "Values", ramp labels use the platform UI font, not mono.** `accent` /
>   `neutral-dark` are family labels; only genuine code identifiers (the Name row, the
>   CSS-var chip, table token names) stay mono. `SystemRampGrid`'s row labels and 1–12 axis
>   were mono and made the dialog read as two unrelated typefaces stacked.
> - **The architecture picker in "Values" lists all 15 primitives: 7 solids THEN 8 alpha
>   twins.** `accent-a` … `info-a` + `black-a` / `white-a` after `accent` … `info`. Shown
>   unconditionally for every Categorical arch token — an override is a free-form ref, so
>   any role can be pointed at a translucent primitive (16 already are: `action.ghost.*`,
>   `surface.overlay`, `border.ring.*`, the `status.*.surface` tints) and a solid role must
>   be switchable to alpha too. An earlier build gated the alpha rows on "is the CURRENT
>   ref alpha", which both hid them from solid roles and left the ringed value with no row
>   to land on. Both call sites — `Step3_SemanticTokens`'s `ArchModeEditor` and
>   `ThemePreviewHub`'s `SemanticPreviewTokenModal` — use the same `[...PICKABLE_FAMILIES,
>   ...ALPHA_FAMILIES]` list now. The flat `TonePicker` keeps 7 solids (flat roles are
>   materialized per theme and don't take alpha).
> - **`rampsOf` MUST pass `pageBackground`/`darkBackground` to `scaleLookup`** or the alpha
>   rows render empty: `{<fam>-a.N}` is composited on demand against the page and resolves
>   `undefined` without them (`black-a`/`white-a` are constants and always resolve). This
>   was the actual bug — the family list alone wouldn't have helped.
> - **`SystemRampGrid` paints alpha rows (`/-a$/`) over the shared `CHECKER` pattern** — a
>   translucent swatch on the near-black dialog card is otherwise an empty-looking cell.
>   Same "checker behind it → translucent" language as `AlphaHexCell` / the Accent-Alpha
>   strip. The cell is `overflow-hidden` with the real hex on an inner `<span>` over the
>   checker.

> **The picker offers curated accessible alternatives — opt-in, family bases only.**
> `ColorPickerPanel`'s `suggestions` prop renders an "Accessible options" block under the
> Saved swatches: up to 4 tuned versions of the colour currently in the field, from
> `accessibleVariants()` (`colorUtils.ts`). It exists because designers pick the colour they
> SEE — routinely a bright, saturated hue whose anchor (tone 9, the solid fill, exported
> verbatim) can't carry white ink; the ramp then compensates by walking the fill down to
> 11–12 (`accessibleSolidTone`), so the button ships visibly darker than what was chosen.
> Rules that keep it honest:
> - **The criterion is white ink on the fill** (4.5 / 7:1) — the same guarantee
>   `accessibleSolidTone` walks the ramp for — not contrast against the page.
> - **Hue is never touched.** Only lightness (searched via `lightnessForContrast`, not
>   offset) and chroma, so every option still reads as the user's colour.
> - **A suggestion may only DARKEN.** `lightnessForContrast` returns the SUBTLEST tone that
>   still clears the target, which for an already-safe colour is a LIGHTER one — handing
>   someone who picked a 5.7:1 purple a barely-passing 4.5:1 purple under the heading
>   "Accessible" inverts the advice. When the base lightness already satisfies the target at
>   that chroma, it's kept, so that option collapses onto the current colour and is filtered
>   out; a 5th "Balanced" seed backfills the slot. Fewer than 4 options is the correct
>   output for a colour that needs little fixing — never repeat a hex to keep the count.
> - **Opt-in, and only where the value IS a family base** — Primitives' quick-edit strip and
>   nav-pencil popovers, `StateColorRow` (Neutral + the four states). A single tone inside a
>   ramp (Token Details) or a gradient stop has no white-ink guarantee to keep, so the block
>   would be noise there.
>
> **A colour chip that looks clickable must be clickable.** `HexCell`'s swatch takes
> `onSwatchClick` and becomes a real button wherever a picker exists to open (the quick-edit
> strip — same popover its chevron toggles, which stays). It's the part users aim at first,
> and a dead swatch beside a working chevron read as broken. Omitted in the table cells,
> where there's no picker and the swatch is a readout of the hex beside it.

> **Tall popovers → `usePopoverPlacement`** (`colorControls`). A popover carrying
> `ColorPickerPanel` (HSV + hue + alpha + Palette + Saved) is ~540px — taller than the room
> under a trigger sitting low on the page. The hook measures on open, flips above the
> trigger when there's more room there, and returns `{ up, max }` to cap `maxHeight` to the
> space that actually exists. Pair it with pinned header · scrolling body · pinned footer
> so the primary action can never scroll out of reach. Used by the "+ Add" family popover
> and the per-family edit popover; use it for any new one rather than a fixed max-height.

> **`ScaleRow` is compact by default.** Swatches are `h-8` (`thin` variant `h-4`) with
> `gap-1` — shrunk from an earlier `h-11`/`gap-1.5` because stacking multiple 12-tone ramps
> (the old Picker Color's brand + neutral + 5 state scales) at the old size made the page
> feel heavy. It's the ONE shared component behind every ramp — `ColorPrimitives.tsx`'s
> quick-edit strip (default size — one ramp at a time now, not several stacked, so the
> extra height is affordable again), `ThemePanel.tsx` — so a size change here is felt
> everywhere; the on-swatch "Anchor" text was already dropped in favor of the ring + dot
> (title tooltip carries the label), which is what keeps this size legible.
>
> **`numbersInside` is the exception, and only the brand ramp uses it.** It moves the tone
> number ONTO its swatch (ink picked by `readableInkOn`), which needs `h-11` to fit — so the
> number doubles as a live contrast check on the tone it labels. That's worth the height for
> the one ramp you're actively picking; the five state ramps keep captions above and stay
> compact, or the tab's density regresses. Corner radius stays `rounded-md` though — SAME as
> every other `ScaleRow` variant. It briefly matched the `ColorSelect` dropdown above it
> instead (`rounded-[13px]`), which looked deliberate in isolation but inconsistent once
> the State Colors ramps (still `rounded-md`) were visible in the same scroll — don't
> special-case this cell's radius again without checking it against the ramps below it.
> `ColorSelect`'s `pill` variant is still `rounded-[13px]` though (unrelated call — that's
> the State Colors hex trigger, not a swatch grid, matching the dropdown it sits beside).

> **Editing a family's color.** Each row of the Color-families nav carries a pencil AND a
> clickable swatch that both open the same `editFamily` popover (`ColorPickerPanel` for
> THAT family), routed by `changeFamilyBase()` to whichever applier owns it — accent →
> `useApplyAccentColor`, neutral → `useApplyGrayColor` (so it moves the page, see below),
> status → `useApplyStateColor`, custom → `updateCustomColor` with a regenerated ramp. The
> nav is no longer selection-only; keep new families routed there instead of sending users
> back to the quick bar.
> **The swatch opens the picker directly — the same "the colour chip itself is clickable"
> rule the quick-edit strip's `HexCell` swatch already follows** (most people reach for the
> colour first, not a neighbouring pencil). This is why the row is no longer ONE `<button>`
> wrapping the swatch + label: a button can't nest another button, so the row split into a
> `<div>` holding two siblings — `FamilySwatch`'s own button (swatch, opens the editor) and
> a second button for the label (selects the family in the table, same as before). Both
> still call `setActiveFamily(f.key)` first, so editing a family you weren't already on
> switches the table to it too, rather than editing one family while looking at another's
> rows. Omitted for Accent-Alpha (`FamilySwatch`'s `onClick` prop) — nothing to retint
> independently, same reason the pencil is already withheld there.

> **Clicking a THEME folder header previews that theme.** The Primitives nav folders
> (`ColorPrimitives.tsx`) aren't just expand/collapse containers — the header click also
> calls `onPreviewThemeChange` with that folder's theme, so selecting a theme in the nav
> repaints the whole surface (ramps, quick-edit strip, `PreviewPanel`, Artefacts, `.MD`),
> the same payoff clicking a column eye in Semantics gives. `folderThemeKey()` maps a
> folder to its theme: a real theme folder (`sky`, `violet`) IS that theme; `__base`
> ("Theme 1") stands in for `themeOrder[0]` (the first built-in — `light`); `__custom`
> previews nothing (unreferenced families, no theme). The switch only fires when the
> target differs from the current `previewTheme`, so collapsing the folder you're viewing
> just collapses. The previewed folder swaps its folder glyph for an `EyeIcon` in
> `text-accent-ui` — display-only, the header's own click is the toggle. Because
> `onPreviewThemeChange` is the same handler Workspace settings and Semantics use, picking a
> `dark`-kind theme here flips the app chrome too. Collapsed-rail (56px) mode is untouched
> — it iterates GROUPS for family selection, has no folder headers.

> **Popovers inside the Quick-edit accordion.** `Group`'s content wrapper needs
> `overflow-hidden` for its height animation, and that CLIPS any dropdown opened inside
> it. It therefore clips **only while animating** (`onAnimationStart`/`onAnimationComplete`
> toggle the class); once settled, popovers can escape the group. Keep that pattern for any
> new animated-height container that can hold a popover.

> **The accent↔neutral link is STORE state (`linkNeutralToAccent`), and it had gone
> missing entirely.** Every entry point to it lived on a surface that got retired:
> `PickerColor`'s quick bar and `WorkbenchLayout` are unwired, and
> `QuickFoundationsPanel`'s DEFAULT export (the popover holding both the link toggle and
> the "match states to accent" wand) ended up imported by nobody — only its named exports
> (`COLOR_FAMILY_PRESETS`, `QuickEditSections`) are still referenced. `Step2_ColorPalette`'s
> own `statesLinked` toggle is dead too: the Color foundation renders `ColorHub`, not
> `Step2` (`Configurator.tsx`'s `section.key === 'color'` branch), so only its exported
> `ColorControls`/`ScaleSettingsModal` are reachable. Net effect: Primitives — the only live
> editing surface — hardcoded `applyAccentColor(hex, false, …)`, so the neutral silently
> stopped tracking the accent for everyone, and the states could never be harmonized at all.
> Rules now that it's reconnected:
> - **The flag is persisted and part of `DesignSnapshot`** — it decides what the neutral ramp
>   IS, so a saved system has to carry it. It is NOT local popover state again; that's how it
>   got lost. `linkStatesToAccent` (below) is the exact same kind of field, added later.
> - **Editing the Neutral by hand unlinks it.** `useApplyGrayColor` clears the flag unless
>   called with `fromLink`, so a hand-picked neutral is never silently overwritten by the
>   next accent edit. The accent applier writes the gray inline (it doesn't route through
>   `useApplyGrayColor`), which is why `fromLink` defaults to `false` safely — but the tint
>   control DOES route through it and must pass `true`, or changing the tint would unlink.
> - **Changing the tint while linked re-derives from the ACCENT, not from the stored
>   neutral** — `brandSat` is per-tint, so the linked neutral's saturation is a function of
>   the level. At `pure` (`brandSat: 0`) a linked neutral is a TRUE GREY with no accent hue:
>   correct by definition, not a broken link.
> - **v47 backfills by DETECTION, not a flat default.** If the stored neutral equals
>   `neutralFromBrand(accent, tint)` it was link-derived → relink; anything else was chosen
>   deliberately → leave unlinked. Both flat defaults are wrong: ON would overwrite
>   hand-picked neutrals on the next accent edit, OFF would unlink every already-harmonized
>   system for no reason.
> - **`neutralFromBrand` moved to `colorUtils`** (pure colour math; the migration needs it
>   without importing a component). `colorControls` re-exports it, and
>   `tokenImport/materialize.ts`'s hand-copied duplicate is gone — one implementation.
> - **States are a toggle too now (`linkStatesToAccent`), not a one-shot button — this
>   SUPERSEDES an earlier decision.** This file used to argue the opposite ("States get a
>   BUTTON, not a toggle... a state colour is a deliberate brand decision far more often
>   than a grey is"), on the theory that silently re-tinting error/warning/success/info on
>   every accent edit was more surprising than useful. That was a judgment call, not a
>   technical constraint, and it was overridden: both primitives now harmonize with the
>   accent BY DEFAULT on a fresh system (`linkStatesToAccent: true` in
>   `makeDesignDefaults()`, same as `linkNeutralToAccent`), with math identical to what the
>   old button ran. `recommendStateColors` still blends only CHROMA — each state keeps its
>   canonical lightness and HUE, because the hue is the semantics (a red drifting toward a
>   green accent stops reading as an error). Measured on a green accent (C 0.112): hues
>   moved ≤0.6° — pure 8-bit rounding — while chroma went 0.210→0.162, 0.170→0.141,
>   0.160→0.135, 0.181→0.146. `useApplyAccentColor` re-runs it on every accent edit while
>   linked (light AND dark ramps both re-anchor, same `generateColorScale`/
>   `generateFamilyDarkScale` split every other primitive uses) and `useApplyStateColor`
>   takes the same `fromLink` parameter `useApplyGrayColor` does — `changeFamilyBase` (the
>   nav pencil / quick-edit strip's manual edit path) calls it with `fromLink` defaulting to
>   `false`, so hand-picking a state unlinks it exactly like hand-picking the neutral does.
>   Editing a single TONE inside a ramp (Token Details) does not unlink either primitive —
>   that's a narrower "override one swatch" action on both, always was.
> - **v49 backfills states the same way v47 backfilled the neutral: by DETECTION.** If all
>   four stored states equal what `recommendStateColors(accent)` would produce, they were
>   link-derived (or the old one-shot button was clicked right before upgrading) → relink;
>   anything else was a deliberate pick → leave unlinked. Same reasoning: a flat default in
>   either direction is wrong.
> - **Both toggles live in the scale-settings gear**, next to Neutral tint — NOT inline in
>   the quick-edit strip. A control that only renders while Accent is active shifts the ramp
>   beside it 52px on that one family, which is exactly why the old wand was removed from
>   the strip; don't put either toggle back there.

> **Neutral is an intent.** The State Colors control carries **Neutral · Error · Success ·
> Warning · Info** (`IntentRole`). Neutral has no primitive of its own — it IS the Base, so
> its row writes through the Base applier and therefore moves the page with it. Don't add a
> separate `neutralColor` field to "fix" that; one value, two entry points is the point.

> **A theme is a READING of the primitives, never a place to set color.** The Figma model:
> modes reference variables, they don't hold their own values. Enforced at the data model,
> not by discipline: `themeSources[theme]` stores a **family KEY per slot** (`{ brand:
> 'teal', gray: 'teal-gray', error: 'error', … }`) — never a ramp. Everything that needs a
> theme's actual ramps calls `resolveThemePalette()` (`lib/themeSources.ts`), so retinting
> a family in Primitives moves every theme pointing at it; a theme can't drift because it
> never held a copy to drift with.
>
> Consequences to preserve:
> - **Creating a theme creates its families.** `ThemePanel` mints a `customColors` entry
>   for any slot whose hex isn't already a family (`teal` for the brand, `teal-gray` for the
>   linked neutral) and stores references. A slot matching a global reuses `accent` /
>   `neutral` / `error` / … instead of duplicating it.
> - **A family in use can't be deleted.** `removeCustomColor` refuses while any theme
>   references it (`themesUsingFamily`), and the family nav shows a lock with the list.
> - **The Alias/Semantics columns have an eye and a ✕ — no pencil.** Color is edited in
>   Primary Color; the table only maps roles onto it.
> - **The export ships no per-theme namespaced ramps.** A theme's ramps ARE families,
>   already exported under their own key, so its semantics alias those primitives.

> **THERE IS ONE THEME PANEL — `ThemePanel.tsx` — and it docks in ONE place.** Create and
> edit used to be two components inside the same file that agreed on almost nothing:
> `AddThemePicker` (288px, no header, bare "Name" input, one accent picker, footer "Add
> theme") and `AddThemeForm` (400px, swatch/title/hex header, labelled "Theme name", six
> always-on slot rows, footer "Create theme" / "Save changes"). Same concept, **three**
> names for the confirm action, two opposite answers to "what if I leave the name blank"
> (derive one from `INDUSTRY_SPECTRUM` vs. error), and two minting implementations. Audited
> and unified. What the unification settled, and must not drift apart again:
> - **One minting path, `mintTheme`, for create AND edit.** The old edit path
>   (`AddThemeForm.handleCreate`) minted families with `scale` only and **no `darkScale`**.
>   `tokenGenerator.ts` gates the `<key>-dark-*` primitives on exactly that field being
>   non-empty, so an export or an auto-sync (~1.5s debounce) fired between the save and the
>   next `ColorPrimitives` mount shipped the family's ENTIRE dark ramp missing. **Measured**
>   before the fix: re-pointing a theme's Error slot to `#B91C1C` persisted
>   `lightSteps: 12, darkSteps: 0`, then read `darkSteps: 12` only after switching to the
>   Primitives tab — because `useEnsureColorScales` is a `[]`-deps effect that happens to
>   backfill it on mount. That backfill was never equivalent anyway: it runs
>   `generateFamilyDarkScale` for every family, while the **gray slot needs
>   `generateDarkColorScale` + `neutralTint`** (only that generator re-derives the base as a
>   dark neutral, and only the neutral carries the tint's chroma link). `scalesForSlot`
>   owns that split now, once. Verified after: a theme created from the rail and a slot
>   re-pointed from Semantics both persist `dark: 12` immediately, with no remount.
> - **The shape is the create picker's, because that's the common case.** Pick ONE accent;
>   the other five slots derive from it via `slotsFromAccent` — the same `previewHarmony`
>   the accent↔neutral/states links use, so a theme minted from an accent lands on the
>   colours the rest of the system would have picked for it.
> - **The six-slot control is DISCLOSED, not dropped.** "Adjust colours" opens the same six
>   `SlotRow`s the edit form owned, so re-pointing a slot at another family is still one
>   click away — it just isn't what the common case pays for. Its summary line is real
>   state, not decoration: "Neutral and the four states follow the accent" vs. "N set by
>   hand". **The `derived` set is what makes create and edit differ, and that's the whole
>   difference**: creating starts with all five following (moving the accent repaints them),
>   editing starts with none (every slot already holds a value someone chose, so moving the
>   accent must not silently repaint them). Hand-editing a slot detaches it, the same
>   detach-on-manual-edit rule `useApplyGrayColor` follows.
> - **Every child of the panel's scroll column needs `flex-shrink-0`.** It's a COLUMN flex
>   container, so a child with the default `flex-shrink: 1` gets crushed when its siblings
>   overflow. The ~540px accent card squashed the "Adjust colours" row to its 2px borders —
>   present in the DOM, its own button overflowing past the container, `scrollHeight`
>   under-reporting, and the section unreachable however far you scrolled. Measured
>   `{h: 2, ot: 665}` against a `scrollHeight` of 631.
> - **It DOCKS; it is not anchored.** Five entry points (Semantics' Categorical + flat `+`,
>   both tables' column pencils, Primitives' "+ New theme") used to open it in five places —
>   two of them floating over the very table they were about to change, and moving with
>   horizontal scroll. It's `fixed` at the left edge of the canvas now, flush against the
>   column beside it, matching its FULL BOX. No anchor to measure, no flip-up/flip-down, no
>   viewport clamping, and it reads as a drawer sliding out of the column that lists the
>   very families it mints. `DOCK_LEFT` comes from
>   `COLOR_RAIL_WIDTH`/`COLOR_RAIL_COLLAPSED_WIDTH` (imported, never repeated) so a
>   collapsed rail can't leave it floating over the strip.
> - **Vertical bounds are MEASURED off a reference column, top AND bottom — `dockToSelector`.**
>   Defaults to `nav[aria-label="Color families"]`; the Themes Library passes its own
>   `aside[aria-label="Themes library"]`. The panel sets `top` and `bottom` from that
>   element's rect (with a `ResizeObserver` so a growing theme list / sync footer keeps the
>   drawer in step), so it is EXACTLY the rail's height. It fell back to a hardcoded
>   `dockTopOverride={72}` + a fixed 36px bottom inset before — 20px too low at the top and
>   not tracking the rail's real bottom at all (reported: "no se está ajustando a la altura
>   del riel"). Falls back to `SHELL_ROWS` / `DOCK_BOTTOM` when the column isn't mounted
>   (the panel opens from Semantics/Gradients too). Triggers pass **no anchor element**.
> - **The accent picker is the Primitives family-edit drawer's, verbatim** —
>   `<ColorPickerPanel dynamicAccentPalette palette={[]} suggestions followAccent>`, so the
>   curated palette is the hue-scoped strip with the selection box and the
>   Muted / Vivid / High contrast options, not a static swatch list. It carried
>   `palette={curatedPaletteFor('accent')}` (a fixed set) before; the two accent pickers in
>   the app now show the identical control.
> - **`seedFrom` (a "duplicate theme" flow with no caller) was deleted**, not kept.

> **Base drives the page (HeroUI model).** There is still no background PICKER.
> `grayBaseColor` — labelled **Gray / Neutral** in the UI (renamed from "Base", which
> collided with the sidebar's own "Neutral" family and with the per-tone "anchor" concept
> below — nothing should say "Base" for two different things) — is the single input the
> page is computed from: `useApplyGrayColor` writes `pageBackground` + `darkBackground` via
> `backgroundFromBase()` and then **re-anchors every ramp** (brand, status, customs) to the
> new light page, because tone 1 grows out of it. While the accent↔base link is on, an
> accent change moves the base and therefore the page too; unlinked, the accent leaves the
> page alone. `ColorPrimitives`' quick bar DOES show a **Background** field now
> (`DerivedBackgroundField`) — but it's a read-only calibration READOUT (no `onChange`,
> `cursor-default`), not a second input: still don't reintroduce an independently-editable
> background — that's what let the page and the ramps grown against it drift apart before.
>
> **How MUCH of the Neutral reaches the page is `neutralTint`** (`NEUTRAL_TINTS`,
> `colorUtils.ts`) — four levels: **Pure · Subtle · Tinted · Vivid**. It exists because the
> derivation used to clamp light-page chroma to `0.006`, so a deliberately vivid Neutral
> still produced a white page: the model said "the Neutral drives the page" while the
> constants said "the page is white." Making the clamp a CHOICE is the Radix-faithful fix —
> Radix doesn't expose a background either, it ships six hue-matched grays (Gray · Mauve ·
> Slate · Sage · Olive · Sand) and the page IS that gray's step 1, i.e. tint is a property
> of the neutral, not a second input. Rules:
> - **Still ONE input.** The tint scales the derivation; it never sets a colour. That's what
>   keeps "no background picker" true and page/ramp drift impossible.
> - **`subtle` holds the pre-tint constants verbatim** (light `L .995 / cap .006`, dark
>   `L .17 / cap .022`), so it is a no-op for every existing system — store v46 just
>   backfills the field, no ramp is regenerated.
> - **Discrete levels, not a slider** — this is Radix's "pick a gray family" decision, and a
>   free 0–1 value lets a system land on a tint nobody chose. (The contrast shift beside it
>   IS a slider; it's a continuous quantity, this isn't.)
> - **The ceiling is tinted PAPER, not a coloured surface**: `vivid` lands at L≈0.972 light /
>   0.215 dark. Going further (L≈0.92) would push steps 11–12 much darker and break the
>   chrome tints (`bg-elevated`, active rows) that assume a near-neutral page.
> - **Contrast self-corrects, and that's not luck**: steps 11–12 are solved BY contrast
>   against the page (`lightnessForContrast`), so they track it. Measured on a warm neutral
>   across all four levels: step 11 = 4.51 → 4.68:1, step 12 = 12.46 → 12.03:1.
> - **`neutralFromBrand` reads the same level** (`brandSat` 0 / .08 / .16 / .28). If only the
>   page knew about the tint, a Vivid system would flatten its neutral back to a near-gray
>   the moment the accent moved with the link on.
> - **Changing the tint re-runs `useApplyGrayColor(grayBaseColor)`** — one code path for
>   "the base moved," whether the hex changed or how much of it survives. Don't write
>   `setNeutralTint` alone and expect the ramps to follow.
> - **The tint also governs CHROMA CONTINUITY, via `NEUTRAL_TINTS.chromaLink`** — the page
>   only being tinted was never enough. `buildScale` ramps chroma from ~0 at step 2 up to the
>   base's at step 9 and **never looked at the page's own chroma**, which is correct while the
>   page is near-neutral (start ≈ 0 IS continuous) and tears the moment it isn't: measured on
>   a green neutral at `vivid`, step 1 (the page, emitted verbatim) sat at chroma 0.0655 and
>   step 2 dropped to 0.0025 — **26×**, so the page read green and the very next surface read
>   gray. Across 5 neutral hues the step-1→2 chroma ratio was 18–2150× before, ~1.0× after.
>   **The lightness curve was smooth right through it — the discontinuity is 100% chroma**, so
>   don't go looking at `BG_WEIGHTS` or the Radix bands for this bug.
>   - `chromaLink` blends the original curve with a page→base lerp on the SAME weight the
>     lightness lerp uses. **0 for pure/subtle, and 0 makes the blend collapse to the original
>     expression exactly** — so it's both the default parameter value and the no-op value, and
>     a call site that never learns about tints keeps rendering what it rendered before
>     (verified: pure + subtle are byte-identical across 5 neutrals × light + dark × 12 steps).
>   - **A second, coupled defect:** `generateDarkColorScale` anchors tone 9 at `nC * 0.5`, written
>     when the page was always near-neutral. At tinted/vivid that left the PAGE more chromatic
>     than the ramp's own anchor (0.075 vs 0.039) — the scale literally could not grow out of
>     the page. The anchor is now floored at the page's chroma when linked, which is what lets
>     1–9 hold one tint. Provably inert for pure/subtle: their page multipliers (0 and 0.35)
>     are both below that 0.5, so `max` can never pick the page there.
>   - **Only the NEUTRAL passes the tint.** `chromaLink` means "continue from the page's
>     chroma", which is only meaningful for the family the page is DERIVED from — same hue.
>     Handing it to the accent would paint the page's chroma at the accent's hue and turn its
>     step 2 into a saturated fill. `colorActions` therefore threads `neutralTint` into the
>     gray ramps only, never into the `gen`/`genDark` helpers the coloured families share.
>   - Steps 10–12 inherit the raised anchor chroma and stay legible on their own: contrast is
>     search-solved, so the whole set still clears AA (worst measured 4.50:1 over 20 ramps).
>   - **Known, deliberate gap:** the same tear exists at `subtle`, just milder (≈3–13× rather
>     than 26×). It is NOT fixed, because `subtle` is the level every pre-tint system sits on
>     and any non-zero `chromaLink` there restyles their neutral ramp. Raising it is a real
>     option but needs a store migration + an explicit decision, not a silent default change.

> **Alpha twins are solved, not eyeballed.** `alphaColorOver` inverts alpha compositing
> — `α = (solid − page)/(overlay − page)`, max across channels, then the overlay is
> re-solved per channel at that α so the TINT survives (pure white/black would wash the
> hue out). The overlay is fixed by appearance: white over a dark page, black over a light
> one. Two gotchas the implementation handles and a rewrite must keep:
> - **α rounds UP** to 2 decimals. Rounding down demands an overlay outside 0–255, which
>   clamps and silently breaks the reconstruction.
> - **α climbs until every channel is in gamut.** A solid whose blue dips BELOW a dark page
>   can't be reached by white at the max-channel α; the loop raises α (α = 1 always works).
>   Without it, red ramps on a blue-ish dark page rebuilt 6/255 off.
> Both appearances ship (`accent-a*` and `accent-dark-a*`) because an alpha value only
> means anything relative to the page it was solved against.

> **THE ALPHA LAYER — two contracts, sixteen roles. Read this before touching
> anything alpha.** Full history + measurements in
> `design-plans/alpha-primitives.md`.
>
> For a long time the alpha twins above were **dead data**: exported in
> `colors.primitiveAlpha`, absent from `variables.css`, absent from the `.MD`,
> and referenced by **zero** semantic roles. Reported as "creamos esos alphas
> ¿para qué?" — a fair question, and the answer was "for nothing yet."
>
> **There are TWO kinds of alpha primitive and they must not be merged:**
>
> | | Family TWIN (`accent-a`, `error-a`, …) | Neutral ladder (`black-a`, `white-a`) |
> |---|---|---|
> | Contract | reproduce solid tone N **over its own page** | darken/lighten **an unknown backdrop** |
> | Anchored to | `pageBackground` / `darkBackground` | nothing — agnostic by definition |
> | Value | SOLVED (`alphaColorOver`) | FIXED (Radix `blackA`/`whiteA`, verbatim) |
> | Ladder | NOT monotonic; tone 1 is 0 % (tone 1 IS the page) | 5·10·15·20·30·40·50·60·70·80·90·95 % |
>
> - **`BLACK_ALPHA_SCALE`/`WHITE_ALPHA_SCALE` (`colorUtils.ts`) are the published
>   Radix values, not invented.** Same precedent as `radixReference.ts`. A 5-step
>   ladder at 5/10/15/40/80 % was proposed and REJECTED: those five stops are
>   **exactly** 5 of the 12 Radix steps (`black-a-1/2/3/6/10`), so a second
>   numbering scheme would have bought nothing. Measured first — fixed-% vs
>   solved differ by ~0.06 in contrast delta on a dark page, nowhere near enough
>   to justify 96 more tokens.
> - **A twin's ladder is NOT an opacity scale.** Measured on the default accent:
>   `1=0% 2=6% 3=12% … 9=87% 10=84% 11=70% 12=86%`. Non-monotonic by
>   construction. Don't reach for it when you want "40 % of the brand" — that's
>   what the fixed ladder is for.
> - **`scaleLookup` resolves `{<fam>-a.N}` kind-aware**, composing on demand
>   against `pageBackground`/`darkBackground` — so ONE ref text resolves to the
>   light twin in a light column and the dark twin in a dark one, and no role
>   needs an `-a-dark` variant. Those two fields are OPTIONAL on
>   `ProjectionInput`: omit them and alpha refs resolve `undefined` like any
>   unresolved ref. Every real call site threads them (`tokenGenerator`,
>   `previewTokens`, `Step3_SemanticTokens`, `foundationDocs`, `sectionExport`,
>   `color/audit`) — **a new call site that forgets them silently loses every
>   alpha role**, which is exactly how a seeded-store probe read `{accent-a.3}`
>   unresolved while `{black-a.8}` (needing no page) resolved fine.
> - **Sixteen roles use it**: six `action.ghost.{neutral,brand,danger}.{hover,pressed}`
>   (split by intent to match Button's own `Color` axis), `surface.selected`,
>   `surface.overlay`, the four `status.*.surface`, three `border.ring.*` and
>   `border.rim-highlight`.
> - **`border.ring.*` is the HALO, `border.focus` is the BOUNDARY.** Two roles,
>   deliberately: the boundary must clear WCAG 1.4.11 (hence `{ui:…}`), the halo
>   is decoration measured by nothing. This does NOT reverse the documented "no
>   `border.focus.critical`" decision — that one is about the solid boundary
>   staying accent for every severity, which it still does.
> - **`neutral-a` is the one family with no role, deliberately.** The neutral
>   wash case is better served by `black-a`/`white-a`, which don't carry the
>   accent tint `neutralFromBrand` bakes into the neutral ramp. Its real use
>   would be glassmorphism (translucent `surface.layer-*`), a separate change.
> - **NAMING DIFFERS BY SURFACE, on purpose.** `colors.primitiveAlpha` keys a
>   family twin by the BARE family (`accent-3`) because the bucket already
>   disambiguates it from `colors.primitive`; CSS and Markdown are ONE flat
>   namespace, so they need the infix (`--color-accent-a-3`). `black-a`/`white-a`
>   carry the `-a` in the key everywhere, having no solid counterpart to collide
>   with. The plugin's `primitiveRefHex` tries both shapes — don't "unify" these
>   without migrating the shipped `primitiveAlpha` contract.
> - **The contrast audit COMPOSES before measuring.** `Pairing` (`color/audit.ts`)
>   gained `backdrop?` (default `surface.page`). A translucent background used to
>   hit a silent `continue` and vanish from the matrix — a hole that would have
>   grown with every alpha role. Now it's composited and audited like any other
>   colour; a translucent bg whose backdrop doesn't resolve **throws**, and a
>   translucent FOREGROUND always throws (ink is never a wash).
> - **`parseHex` (apca.ts) and `hexToLinearRgb` (gamut.ts) THROW on a real alpha
>   channel** instead of silently dropping it, as both did before. These are the
>   only two sRGB decode paths in the codebase, so that silence would have let a
>   wash score against the wrong colour — including via the `check_contrast` MCP
>   tool, which takes arbitrary strings. Alpha ≥ 99.9 % passes through (that's a
>   solid with a redundant `ff`, not a translucent colour).
> - **Don't recompute alpha ad hoc in a specimen.** Three hardcodes were replaced
>   by tokens (`ButtonSpecimen`'s `color + '33'`, `BorderSpecimen`'s
>   `` `${slot.css}33` ``). If a specimen needs a wash, it wants a role.

> **Ask what a colour IS, don't assume.** "+ Add family" carries a Light · Dark · Alpha
> choice (`SeedKind`), preselected by `detectSeedKind` and overridable. A **dark** seed
> anchors the dark ramp; an **alpha** seed is composited back to the solid it renders as
> (`solidFromSeed`) before any ramp is built. The detection threshold is deliberately near
> the dark page (`darkL + 0.18`), not the midpoint between pages — a brand solid is
> mid-lightness by nature and the midpoint misreads it as dark.

> **Radix two-scale model — every family ships light AND dark.** Steps are ordered by
> ROLE, not lightness, and mean the same thing in both appearances:
> `1–2` app background · `3–5` component (normal/hover/active) · `6–8` border
> (subtle/normal/hover) · `9` **SOLID = the base hex verbatim, the one hard value** ·
> `10` solid hover · `11` low-contrast text (≈4.5:1, WCAG AA) · `12` high-contrast text.
> The two appearances are mirror images: light runs page→base→dark text, dark runs
> page→base→light text. Consequences:
> - **Step 1 IS the page**, emitted verbatim — a brand background like `#111522` round-trips
>   into `neutral-1` (dark) exactly.
> - **Steps 11–12 are defined by CONTRAST**, not a lightness offset (`lightnessForContrast`
>   binary-searches OKLCH L, then nudges until the 8-bit hex itself clears the target).
> - **`recDarkTone` is the IDENTITY** now: a role reads the same step in both themes and
>   gets the value tuned for that page. Only deliberately-inverted roles (`*-inverse`,
>   `surface-overlay`) mirror. The old tone-remapping was faking a dark ramp that didn't
>   exist — don't reintroduce it.
> - **Nothing inverts for display.** The families table and quick-bar ramps read the dark
>   ramp at the SAME step. An inversion here means a dark ramp is missing somewhere.

> **Tone 9 is ALWAYS the anchor — pinned, not detected.** `BASE_TONE = 9` (`colorUtils.ts`)
> is a hardcoded constant: `generateColorScale` writes the input hex to tone 9 verbatim
> (`if (i === BASE_TONE) { out.push(chroma(baseHex).hex()); continue }`) every time, for
> every algorithm. This is Radix's own model too (their Custom Palette tool does the same).
> The ring/badge marking it in the UI is called **"Anchor"**, not "Base" — that text
> collided with `grayBaseColor`'s "Base" label (see above) and implied a per-color
> computation that doesn't exist; renaming it didn't change the math, tone 9 was always
> where the input color landed. `ScaleRow`'s compact 12-cell strip (`colorControls.tsx`)
> marks it with a ring + a tiny dot only — "anchor" as text doesn't fit any of the 12 cells
> at 7–8px, tried it, it clips; the full word lives in the cell's `title` tooltip and in
> the families table's row badge, which has room.
>
> **Radix numeric (1–12) is THE naming — for every system, not just new ones.** Every ramp
> is stored 1–12 internally regardless of scheme (nothing to migrate); `colorNaming`
> (`'numeric' | 'hundreds' | 'tens'`, `NAMING_SCHEMES` in `colorUtils.ts`) only relabels the
> swatch-strip numbers, the families table's row names (`accent-25` vs `accent-1`) AND the
> exported token names — one scheme drives all three, deliberately, so what's on screen is
> never a lie about what ships. `makeDesignDefaults()` seeds `'numeric'` and **store v42
> converts every persisted + saved system to it**.
>
> This reversed an earlier position ("new systems only, existing keep theirs"), because that
> position was never actually holding: the v37→v38 block force-converted `'numeric'` →
> `'hundreds'` on every upgrade, so the naming a system exported depended on which version
> it happened to upgrade FROM. v42 settles it in one direction and the v38 line is now a
> documented no-op. It IS a rename for anyone who was on hundreds — `accent-700` ships as
> `accent-9` — so a Figma/JSON integration pinned to the old names has to re-sync; that cost
> was taken deliberately over leaving two behaviours in the chain. The scheme picker stays,
> so hundreds/tens remain a deliberate opt-in.
>
> The families table also captions its 12 rows into Radix's 5 role bands (`TONE_BANDS` in
> `ColorPrimitives.tsx`: 1–2 Backgrounds · 3–5 Interactive components · 6–8 Borders ·
> 9–10 Solid colors · 11–12 Accessible text) — keyed off the tone NUMBER, so the grouping
> holds under either naming scheme.

> **Light vs dark ramps.** A ramp always runs 1 (lightest) → 12 (darkest); what differs is **which end grows out of the page**. `generateColorScale(…, appearance: 'light')` anchors tone 1 to `pageBackground`; `generateDarkColorScale()` anchors tone **12** to `darkBackground` *and* re-derives the ramp's base (tone 9) as a dark neutral, so tones 9–12 are the dark surfaces instead of mid-grays. Gray is the **only** ramp with a dark twin — colored ramps (brand/status) keep their hue and just shift tone via `recDarkTone`. Anything that builds a `GlobalScales` **must pass `grayDark`**: it's optional in the type, and omitting it silently falls back to the legacy constant — which would make Step3's resync treat every dark gray as stale and overwrite the generated ramp.

> **Live preview tip:** changing the brand in Foundations · Color re-derives the already-mapped brand semantic tokens (via `BRAND_TOKEN_TONES` + `accessibleSolidTone`) so the right-hand preview and the export track the new brand. Unmapped tokens fall back to `primaryColor` in `resolvePreviewTokens`.

> **`resolvePreviewTokens` never trusts a persisted semantic value blindly.** Its internal
> `resolveRole()` runs every `semanticTokens[key]` through `normalizeThemeValue()`
> (`lib/semanticRoles.ts`) — the same staleness check `Step3_SemanticTokens` already used
> for its own auto-populate/reset — before using it, falling back to the role's recommended
> tone when the stored hex is no longer a genuine tone of the current source scale. This
> matters because that auto-populate effect only runs while Alias/Semantics is mounted: a
> user who edits colors and previews via Components (never visiting Semantics) could
> otherwise carry a stale dark-theme value indefinitely — e.g. the Components-tab preview
> background staying light-gray in dark mode instead of tracking the real dark surface.
> Keep every field in `resolvePreviewTokens` going through `resolveRole()`, not a raw
> `semanticTokens[key] || rec(key)` read.

> **Categorical stores its edits in `architectureOverrides`, NOT in `themes` —
> so `resolvePreviewTokens` has to project, or the preview is frozen.** `themes[theme]` only
> ever holds the FLAT role map; Categorical edits are refs under
> `architectureOverrides[arch]['category.token'][mode]`. `resolvePreviewTokens` used to read
> `themes` exclusively and carried a comment that 'flat' and 'categorical' "share the same
> resolved values" — so editing e.g. `action.primary` in Categorical repainted **nothing**,
> in any preview, forever. It now rebuilds the same `buildArchitectureView()` the table
> renders (overrides applied), publishes the previewed mode's resolved colours as
> `tokens.archTokens`, and maps the ones with a `PreviewTokens` field onto it — guarded so
> a projection that omits a slot keeps the flat-resolved value instead of blanking the atom.
> Anything new that resolves preview colour must go through this, not a raw `themes` read.

> **The dark-mode "white box" bug had a second, deeper cause: ~30 of 39 semantic roles'
> `darkTone` was just wrong**, not stale. `resolveRole()` above only protects against a
> stored hex that's no longer ANY tone of its scale — it does nothing if the stored (or
> recommended) tone is a VALID tone that's simply the wrong one. `background-primary` (the
> page background) was pinned to `darkScale: 'gray', darkTone: 12` — gray tone 12 is the
> DARK ramp's lightest step (its highest-contrast TEXT tone), not the page. It should have
> been tone 1 (identity — the dark ramp's tone 1 IS `darkBackground`, same as the light
> ramp's tone 1 IS `pageBackground`). This wasn't a one-off typo: nearly every role outside
> the `*-solid` fills carried a leftover Tailwind-scale-style inversion (mirroring roughly
> `13 − tone`) baked in before the per-appearance Radix dark ramp existed — exactly the
> "old tone-remapping... don't reintroduce it" CLAUDE.md already warned about elsewhere, just
> never actually removed from the catalog data itself. Fixed by deleting the hardcoded
> `darkTone` from every role that isn't a genuine opposite-polarity case, so `recDarkTone()`
> computes IDENTITY (same step, dark ramp) the way the type comment on `Role.darkTone`
> already said it should. Only `content-inverse`, `border-brand-alt` (both switch `darkScale`
> entirely, by design) and `background-overlay` (a modal scrim — its light tone borrows
> gray-12's near-black LIGHTNESS as a fixed veil colour, not a step position, so it's in
> `recDarkTone`'s `inverts` list) still carry an explicit override. **A hardcoded `darkTone`
> on any other role is a bug until proven otherwise** — don't add one without checking it
> against `recDarkTone`'s identity default first.
>
> **`background-overlay` being deliberately near-black in BOTH themes makes it a trap for
> anything that isn't literally a scrim.** Three preview specimens — `ToastSpecimen`,
> `TooltipSpecimen`, `InfoTooltipSpecimen` (`docs/specimens.tsx`) — used to build their
> "inverse chip" (dark pill, light text, for a toast/tooltip that should pop regardless of
> theme) from `t.semanticMap?.['background-overlay'] || t.neutralText`, paired with
> `color: t.surface`. That's correct-LOOKING in light mode purely by coincidence — the scrim
> and `neutralText` both happen to be near-black there — and breaks in dark: the scrim
> stays near-black (that's the whole point of the invert), landing within a few tones of
> `darkBackground`, i.e. nearly the PAGE's own colour. Paired with `color: t.surface`
> (dark mode's near-black page), the chip became near-black text on a near-black chip on a
> near-black page — invisible. Fixed by dropping the scrim reference entirely: `inverse =
> t.neutralText`, full stop. This works in BOTH themes by construction, not coincidence —
> `neutralText` is BY DEFINITION the tone solved to read against `t.surface` (that's what
> "text on the page" means), so inverting the pair (ink becomes the fill, page becomes the
> ink) stays high-contrast in either direction. Verified: 12.32:1 in dark mode, was
> unreadable. **`background-overlay` is for scrims. If something wants "always-dark-chip,
> always-readable," reach for `neutralText`/`surface`, not the overlay role.**
>
> Because a MATERIALIZED stored value (one already written into `themes[darkTheme]` by
> Step3's auto-populate, before this fix) is a *valid* tone of its ramp — just the wrong
> recommendation — `resolveRole()`'s staleness check doesn't catch it or self-heal it; it
> survives indefinitely once written. Store **v43** clears every dark-kind theme's role map
> (same blunt-but-proven approach as v38 and v40's `clearSemantics`) so auto-populate
> re-seeds from the now-correct identity tones. If you ever change a role's recommended
> tone again, ship a matching migration — don't rely on `resolveRole()` alone to propagate it.

> **The same inversion was ALSO baked into `CATEGORICAL_ROLES`** (`semanticArchitectures.ts`),
> and it survived the flat fix because it's a separate table. `neutral-dark` runs
> **1 = darkest** (tone 1 IS `darkBackground`, emitted verbatim) → 12 = lightest, exactly
> like the light ramp runs 1 = page → 12 = text — so a dark ref uses the SAME step as its
> light counterpart. The table mirrored them instead (`surface.page` dark →
> `{neutral-dark.12}`), which rendered Categorical's **entire dark column as a light
> theme**: near-white page, near-black "dark mode" text. Realigned to identity, with
> `surface.inverse` and `surface.overlay` keeping deliberate overrides (an inverse surface
> inverts by definition; a scrim dims rather than inverts, so it stays dark in both). The
> file's own comment always claimed both architectures agree on what a role looks like —
> now they actually do. **If you write `13 − n` in a dark ref, that's the bug.**
>
> **Categorical and Astryx are two NAMINGS of one system, so where they express the same
> concept they must resolve to the same hex.** Measured across 17 equivalent concepts they
> already agreed on 13 (page, surfaces, brand solid, the solved on-ink, brand tint, neutral
> fill, the whole text hierarchy); the alignment closed the rest:
> - `border.default` **3 → 5**, the step Astryx's own `border.default` resolves to. At tone
>   3 a Categorical stroke measured 1.24:1 against its page — no visible boundary at all.
> - `border.subtle` **5 → 3**, taking over the tone `default` vacated. That also fixes an
>   ordering this file used to flag and leave alone: `subtle` sat on a HIGHER tone than
>   `default`, i.e. the "subtle" stroke was the heavier one. Now default 1.61:1 > subtle
>   1.24:1 in light, 1.33 > 1.11 in dark. No tone leaves the palette.
> - `status.*-bg` **2 → 3**, matching Astryx's `status.*-muted`. Against the tone-12 ink the
>   pair still measures 10.04 / 10.79 / 10.64 light and 10.35 / 9.59 / 10.02 dark
>   (error / warning / success), worst case across three seeds per family.
>
> **Two differences are deliberate and must NOT be "aligned" — doing so collapses two rows
> of the same group onto one value.** Categorical ships roles Astryx doesn't, and Astryx
> serves both with a single token:
> - `surface.accent` stays `{accent.2}` (Astryx uses `accent.muted` = 3 for both). Tone 3
>   is already `action.secondary`; equalising them makes a passive brand SURFACE identical
>   to an interactive brand FILL, which is exactly the Radix 2-vs-3 distinction.
> - `action.disabled` stays `{neutral.2}` (Astryx uses `background.muted` = 3 for both).
>   Tone 3 is already `action.neutral` AND `surface.layer-2` — a disabled button would
>   render identical to a neutral one, side by side in the same table.
> A duplicate-detector over the projection is the check that catches this: the only pairs
> that legitimately share a value are `content.on-action == content.inverse` (both are ink
> on something dark) and `surface.inverse == surface.overlay` in light (the scrim borrows
> the inverse surface's near-black).
>
> **UPDATE (N-theme work below): the "coloured families read light-ramp tints in dark
> mode" gap noted above IS now fixed** — `scaleLookup` takes a `kind` param and consults
> `GlobalScales.dark` (the same per-family dark twins `sourceScaleFor` already reads for
> the flat catalogue) whenever no theme palette overrides it. `surface.accent` on the
> built-in dark theme now correctly reads the dark accent twin, not the light one. This
> was NOT a schema change — same refs, same shape, just the resolved HEX.

> **UPDATE: `border.*` was re-split by JOB (decoration vs. control boundary) rather than
> by weight — this SUPERSEDES the `border.default` 3→5 Astryx alignment two paragraphs up.
> The two no longer share a tone, deliberately.** Reported as "colores tan marcados" on
> inputs, plus a request to follow Radix's own 6–8 stroke band — auditing against Radix's
> OWN upstream tables (`radixReference.ts`) first showed those two asks are not the same
> instruction: Radix's own step 8 measures 1.87–2.38:1 in light, under WCAG 1.4.11's 3:1.
> "Follow Radix's band" and "clear the accessibility floor" only agree if the roles are
> split by what the stroke has to DO, not by how heavy it looks.
> - **`border.default` is now the control boundary** (light `{neutral.8}` = 3.26:1/Lc60,
>   dark `{neutral-dark.11}` = 11.99:1/Lc75) — what a resting input, select, checkbox or
>   unfilled button binds to. It used to sit at tone 5 (1.61:1, genuinely decorative) while
>   ALSO being the name inputs pointed at, so an "input border" was either invisible or,
>   if you reached for `strong` instead, one step into the solid register (tone 9, 4.78:1) —
>   past Radix's band entirely. Now "the input border" and "the accessible tone" are the
>   same answer, and dropping from 9 → 8 in light is the visible "less marked" result.
> - **`border.strong` is emphasis, one step past `default`, in BOTH themes** (light
>   `{neutral.9}`, dark `{neutral-dark.12}`) — for a stroke that needs to outrank a plain
>   control boundary (a selected card's own edge), never the default input weight.
> - **Dark is NOT tone-for-tone with light, and that's not a shortcut — it's a measured
>   floor.** This ramp's dark tones 9–10 pass WCAG (3.21/3.89) but FAIL APCA (Lc 21.4/27.0)
>   — the identical blind spot a since-deleted IBM Carbon projection's `CARBON_MIN_TONE`
>   table once proved for its own dark ramp ("there is nothing between Lc 27 and Lc 75").
>   Tone 11 is the
>   first dark tone clearing both. Shipping 9 there would have looked fixed on a WCAG-only
>   check while remaining exactly as invisible as the `{neutral-dark.6}` it replaced.
> - **`border.focus` is SOLVED per theme now, not pinned.** The old comment claimed
>   `{accent.9}` "clears both (WCAG 3.14–7.45)" in light — measured across 8 accent hues,
>   **5 of 8 failed**: sky 2.77, cyan 2.43, amber 2.15, lime 1.98, yellow 1.53. Tone 9 is the
>   user's raw brand hex, so its luminance is entirely outside this system's control; a
>   pinned tone cannot honestly promise a floor for a value the user picks. `{focus:accent}`
>   (a FOURTH marker in `curatedRefs`, beside `{accent.solid}`/`{on:…}`/`{ink:…}`) walks the
>   ramp up from tone 9 until WCAG 1.4.11 + APCA Lc 45 both clear, falling back to the
>   closest-to-passing tone rather than a fixed step — same no-fixed-fallback shape as
>   `solidInkPair`/`tintInkRef`. A saturated/cool accent still resolves to `{accent.9}`
>   (unchanged output for the common case); dark stays pinned at `{accent.11}`, whose own
>   six-seed search already showed no equivalent blind spot.
> - **`border.critical` and `border.warning` were already correct — verified, not touched.**
>   Light `error.9` = 3.76/64; dark jumps to `error.11` because `error.9`/`.10` hit the same
>   APCA blind spot as neutral (5.14 WCAG but Lc 37.6, then 44.2 — just short of 45).
>   `warning.11` has no tone below it that clears WCAG in light (tone 9 = 2.35, tone 10 =
>   2.75, both fail).
> - **`border.success` had one step of headroom `warning` didn't**: tone 10 clears both
>   metrics in both themes (3.31/60 light, 8.22/56 dark) — moved down from 11.
> - **The rule worth generalising**: a role whose value depends on a hue the USER supplies
>   cannot be a pinned tone, ever — it has to be solved. `border.focus` shipped a
>   documented, specific, and wrong contrast range for exactly that reason.
> - Full audit, the Radix upstream tables, and the per-role measured tables live in
>   `design-plans/border-roles-radix-band.md`. Deliberately excluded from this pass: the
>   FLAT role catalogue (materialized into `themes[theme]`, needs a `clearSemantics`-style
>   migration) and the ramp generator itself (the real fix for the dark stroke-band
>   compression, but it moves `ramps.golden` and every saved system's dark neutral — a
>   separate decision). Astryx/shadcn's own border groups were excluded for the stated
>   reason (a vendor architecture matches its contract) and are moot now anyway — see the
>   correction directly below.

> **UPDATE (SAME DAY, second pass): `border.default` ITSELF turned out to need solving, not
> pinning — the identical defect one level up from `border.focus`.** The contrast matrix
> (`contrast-matrix.test.ts`, 10 seeds × 4 algorithms) caught `border.default` failing at
> 2.96:1 (teal/radix) and 2.98:1 (green/radix): the neutral ramp gets tinted by the accent
> hue (`neutralFromBrand`, `linkNeutralToAccent`), so a tone that clears 3:1 on the default
> seed doesn't on every seed — the SAME "a pinned tone cannot promise a floor for a hue the
> user picks" defect this whole section exists to fix, just milder.
> - **`{focus:<fam>}` was replaced by two markers before it shipped**, because the fix for
>   `border.default` needed the identical walk-and-verify shape `border.focus` already had:
>   `{ui:<fam>.<start>}` walks up from `start` until WCAG 1.4.11 + APCA Lc 45 both clear
>   (`uiBoundaryRef`) — `border.default` is `{ui:neutral.8}` (start 8, was pinned there),
>   `border.focus` is `{ui:accent.9}` (start 9, both themes now — dark's own six-seed search
>   already landed on 11, exactly where a walk from 9 arrives, so the separate pin was
>   redundant). `{ui+:<fam>.<start>}` is the EMPHASIS step, one past whatever `{ui:…}`
>   actually resolved to — `border.strong` is `{ui+:neutral.8}`. This is what makes it
>   correct on the tinted-neutral systems: a pinned `border.strong` at tone 9 would have
>   collapsed onto `border.default` on exactly the systems where the boundary itself has to
>   walk to 9.
> - Every number in the target table above is unchanged for the DEFAULT seed — this is a
>   solver correction, not a retint. It only moves output on the handful of accent hues that
>   tint the neutral ramp into the 2.9-ish range at the boundary's starting tone.
> - `focusRingRef` no longer exists as a separate function; `uiBoundaryRef` supersedes it and
>   is called with `start: 9` for the focus ring, `start: 8` for the control boundary.

> **UPDATE (phase 1 of `design-plans/foundations-geometry-and-strokes.md`): the neutral
> strokes are split by JOB into FIVE roles, and the two names above moved.** The control
> boundary is `border.control` / `border.control-hover` now; `border.default` /
> `border.strong` became the middle and top rungs of a purely DECORATIVE ladder. **Every
> number in the two notes above is still true — it is attached to the new names. Not one
> resolved value moved.**
> - **Why.** Measured against the HeroUI DTCG export, the border family used **2 of the 6
>   rungs** the neutral ramp generates in the near-page band and skipped the four between:
>   ΔL to the light page went `subtle` 0.072 → *nothing* → `default` 0.352, a 4.9× jump.
>   The reference's whole ladder (separator 0.080 · border 0.099 · separator-2 0.121 ·
>   separator-3 0.151) fits inside that gap, and neutral tones **5 and 6 were referenced by
>   no role at all, in any theme**. The ramp was never the problem; the assignment was.
> - **The fix is not to soften the boundary.** That would trade a real 1.4.11 guarantee for
>   a look. It is to stop making one name do two jobs: decoration (separates regions,
>   carries no state, **no contrast floor**) is `subtle` / `default` / `strong`; the control
>   boundary (the stroke IS the control) is `control` / `control-hover`, inheriting the
>   `{ui:…}` / `{ui+:…}` solvers verbatim. Measured after: decorative 0.072 / 0.112 / 0.156
>   light and 0.084 / 0.117 / 0.165 dark; `control` still 3.26:1 / Lc 59.9 light and
>   11.99:1 / Lc 75.2 dark.
> - **`control-hover` is not a nicety — it is why the split needed five roles, not four.**
>   The Figma plugin already drew every control's hover stroke from `border.strong` (20+
>   call sites) on the old reading where `strong` WAS the emphasis boundary. Pointing those
>   at the new decorative `strong` would make hover *lighter* than rest — the stroke
>   receding on hover. It stays `{ui+:…}`-solved for the reason that note already gives.
> - **A rename like this is only safe if it is total, and the test suite proved it wasn't
>   at first** — seven failures, every one a consumer still naming the old role:
>   - **`themePresets.ts` was the dangerous one.** All six System Styles override the field
>     border with an alpha precisely because the solver has to walk to a near-white tone in
>     dark (the ΔL +0.63…+0.68 "highlight, not a boundary" measurement in that file's own
>     header). Those overrides now target `border.control` / `border.control-hover`; leaving
>     them on `default` would have handed every style back the hard border that note exists
>     to remove. Neo-Brutalism overrides **both** halves — its border IS the design.
>   - **`color/audit.ts`** audits `border.control` under the `ui-component` intent. Had that
>     entry stayed on `border.default`, the matrix would have started demanding 3:1 of a
>     decorative hairline *and* gone green the day someone repinned the real boundary. The
>     three decorative rungs are audited as `decorative` — measured and reported, no
>     threshold — so a rung drifting heavy enough to be mistaken for a boundary still shows.
>   - `previewTokens`, `SemanticSpecimens`, `foundationDocs`, `exporters` and the plugin's
>     `ARCH_ROLE_MAP` / `pair()` lookups all follow the boundary. Every lookup list keeps
>     the OLD name as a fallback candidate, so a payload predating the split resolves to the
>     same value.
> - **`PreviewTokens.borderDefault` (card edges) deliberately did NOT move** to the new
>   middle rung, even though tone 4 is the closer match to the reference. Every System Style
>   overrides `border.subtle` with its own alpha and none override the new `border.default`,
>   so the repoint silently gave six curated styles a solid neutral card edge. Tried,
>   measured, reverted — phase 1 separates the jobs, it does not redecorate.
> - **Two tests lock the shape**: `border.control` / `control-hover` still resolve to
>   `neutral.8` / `neutral.9` (light) and `neutral-dark.11` / `.12` (dark) — the same four
>   labels the pre-split test asserted — and the decorative ladder is three distinct,
>   ascending rungs **every one of which stays lighter than the boundary**. A decorative
>   stroke outweighing the boundary is this same bug pointing the other way.
> - Role count 61 → **63**. No `schemaVersion` bump: additive keys plus two renamed ones
>   under `colors.architecture.tokens`.

> **UPDATE: every architecture but Categorical was DELETED — Astryx, shadcn/ui, Apple-HIG
> Vibrancy, Material-3 Tonal and IBM Carbon are gone from the codebase, not merely hidden
> from the picker.** They had already been retired from `ARCHITECTURE_OPTIONS` in store v50
> (Categorical-only picker, `semanticArchitecture` migrated to `'categorical'` for every
> persisted system); this removed the ~850 lines of projection code, the four vendor
> reference tables (`carbon.ts`/`carbonReference.ts` + the `@carbon/*`/
> `@material/material-color-utilities` deps), their dedicated test files
> (`carbon.test.ts`, `material-hct.test.ts`, and `shadcn.test.ts`'s CONTRACT half — its
> CVD-validated chart-palette tests survive, renamed to `chart-palette.test.ts`, since the
> chart palette is Categorical's own), and every `architectureOverrides` bucket for a
> deleted key (store **v57** migration — `KEEP = new Set(['categorical', 'flat'])`).
> `SemanticArchitecture` is now `'flat' | 'categorical'`. `projectArchitecture` returns
> `null` for anything else, same as it always did for an unhandled kind — no behavior change
> for the one architecture that ships. Every comment in this file that compares Categorical
> against "Astryx" or "shadcn" by name is describing a design decision made while both
> existed (why a tone was chosen to AGREE with a sibling architecture, mostly) — the
> reasoning is still valid history, the sibling just isn't in the tree to check it against
> any more. Don't reintroduce one as a second projection: extend `CATEGORICAL_ROLES` or the
> marker vocabulary (`{fam.solid}`/`{on:…}`/`{ink:…}`/`{ui:…}`/`{ui+:…}`/`{step:…}`) instead.

> **UPDATE: `action.primary.hover`/`.pressed` were pinned tones written for a solid that
> isn't always tone 9 — same defect class as `border.focus`, found by an external audit
> this time.** `{accent.solid}` (`solidInkPair`) resolves the default fill to whichever tone
> can actually carry a label — measured, **8 of 12 seeded hues resolve to 11, not 9**
> (anything warm or low-luminance: green, sky, cyan, amber, yellow, lime, orange, teal).
> Hover and pressed were still pinned to `{accent.10}`/`{accent.11}` (light) and
> `{accent.10}`/`{accent.6}` (dark) — tones that only make sense relative to a solid of 9.
> - **Light hover measured under WCAG AA on those 8 hues** (as low as 1.78:1, yellow) —
>   the pinned tone 10 is LIGHTER than an 11-anchored solid, i.e. a step backward from the
>   fill it's supposed to darken/lighten for feedback.
> - **A second defect the audit didn't name**: on those same 8 hues, pinned `pressed`
>   (tone 11) was IDENTICAL to `default` (also 11) — no pressed state existed at all.
> - **Dark was worse than reported**: `{accent.6}`'s comment records it was "measured by
>   eye… read as a hover-again, not down" — against an ASSUMED solid of 9. Re-measured
>   against the actual resolved solid (11 for most hues), tone 6 gives **APCA Lc 0–24 across
>   every one of the 12 seeded hues** — not low-contrast, illegible.
> - **Fix: `{step:<fam>+<n>}`, a fifth `curatedRefs` marker.** Takes the family's
>   ALREADY-RESOLVED solid tone (the same memoised value `{accent.solid}` produced for this
>   theme — `solidToneFor(fam)`, reused not recomputed) and walks `n` steps past it through
>   the same `solidInkPair` search, clamped to 12. `hover = {step:accent+1}`,
>   `pressed = {step:accent+2}`. For every hue whose solid is 9, this resolves to EXACTLY
>   `accent.10`/`accent.11` — byte-identical output to the old pin, verified in
>   `categorical.test.ts` against a violet seed.
> - **Two things were tried and DIDN'T recover the tone-11 hues' missing third step — recorded
>   so neither gets re-attempted**: pure-black ink instead of `{neutral.12}` still misses Lc 75
>   at the anchor (amber 62.2, teal 55.7); relaxing the solved-solid target from Lc 75 to Lc 60
>   only moves ONE hue (yellow) and leaves green/sky/amber/teal still walking to 11. The
>   headroom loss is a property of the ramp, not a tuning miss.
> - **Residual, stated rather than hidden**: when the solid is already 11, hover AND pressed
>   both land on 12 — the ramp's last tone that can carry the label, so pressed is legible
>   but not visually distinct from hover. Still strictly better than the pin it replaced
>   (which, for those hues, had a hover that FAILED and a pressed that DIDN'T EXIST).

> **UPDATE (supersedes the two notes directly above): the solid is solved by
> `brandSolidPair`, not `solidInkPair`, and a button label is audited as
> `action-label` — WCAG AA 4.5 + APCA Lc 60, not Lc 75.** Reported as the System
> Styles being "broken" in the artefact view, and it was two compounding defects,
> both measured before anything was changed:
> - **Every dark theme's primary button was a near-white pastel.** Verified live for
>   all six styles: Core `rgb(209,231,255)`, Neo `rgb(251,225,178)`, Glass
>   `rgb(184,238,248)`, Material `rgb(241,222,255)`, Retro `rgb(255,224,212)`,
>   Nature `rgb(193,243,207)`. Six different accents, one washed-out CTA.
> - **`action.primary.default/hover/pressed` had collapsed onto ONE hex** in dark for
>   all six, and `hover === pressed` in light for five of six. Across the 29-seed
>   brand spectrum × both appearances, **47 of 58** combinations resolved fewer than
>   three distinct tones. The residual documented above ("legible, not distinct from
>   hover") understated it: when the solid itself reached 12, pressing changed
>   nothing at all.
>
> **The root cause is an orientation bug, and the note above ruled out the fix for
> the wrong reason.** `solidInkPair` walks `start → 12` and takes the first pass,
> which encodes "higher index = a better fill" — true only of a LIGHT ramp. On a
> dark ramp the tones get LIGHTER with index, so the walk runs away from the brand
> and stops at the near-white end. This is the exact defect `accessibleSolidTone`
> documents and fixed FOR ITSELF ("searching outward from the anchor is
> orientation-independent"); the function that generalised it never got the same
> fix. The note above tested Lc 60 *while keeping the upward walk* and correctly
> found it moved only one hue — the two changes only work together, which is why
> that negative result did not generalise.
> - **`brandSolidPair` (`colorUtils.ts`)** orders candidates by `|tone − anchor|`
>   ascending, tie-broken by chroma descending, and takes the first whose ink clears
>   the target. Measured over 58 seed×appearance combos: **30 move, chroma gained on
>   30, lost on 0, and zero pairs drop below WCAG AA.** Many hues land back on the
>   literal anchor — the brand hex itself as the button (Glass resolves `#22d3ee` in
>   BOTH appearances now). It falls back to `solidInkPair`'s argmax when nothing
>   clears, so the no-solution case is unchanged.
> - **`action-label` is a real intent class, not a loosened `body-text`.** It keeps
>   the FULL WCAG AA 4.5 — Escala's button labels render 17px/600 (measured), which
>   is neither WCAG large text (≥18.66px bold / ≥24px regular) nor eligible for 3:1 —
>   and scores APCA on the large/bold row (Lc 60) instead of the 400-weight
>   running-copy row (Lc 75). Reading the body row for a semibold button label was
>   not strictness, it was the wrong row of the table. `INTENT_THRESHOLDS` carries
>   it and `color/audit.ts` audits `content.on-action` and `status.*-on-solid` under
>   it; the full matrix still reports **0 failures across 1120 pairs**.
> - **`solidStepRef` asks a narrower question**: the nearest UNUSED tone that carries
>   **the solid's own ink**, up first (Radix's convention — 10 is the hover for 9)
>   and down when the ramp has no room. Re-running the SOLID search let a state pick
>   a different ink than the fill it is a state OF, so a hover could flip the label
>   from near-white to near-black mid-interaction. Collapse: **47 → 19 of 58**; the
>   remainder genuinely have only two label-carrying tones and now return the HOVER
>   tone for pressed rather than the solid, i.e. the documented residual instead of
>   "pressing is a no-op".
> - **`{step:…}` direction is not always "darker", and the test that assumed so was
>   wrong.** On a fill carrying a near-BLACK label the ramp has no darker tone that
>   stays legible (light amber: tone 9 is Lc 54, tone 10 is Lc 47), so its states run
>   8 → 7 → 6 and the button BRIGHTENS. `categorical.test.ts` now asserts what
>   actually matters — three distinct tones, moving monotonically in one direction —
>   instead of a rising tone index.
> - **`--accent-solid` in `Configurator.tsx` had to move with it.** It is required to
>   match `{accent.solid}` hex for hex; when both were wrong together the chrome's
>   accent buttons went pale in lockstep with the canvas, which is precisely why the
>   bug stayed invisible.
> - **It exposed a latent token misuse in `ButtonSpecimen`, which had to be fixed in
>   the same pass.** Outline/Ghost/Soft buttons used `statusColor` — a FILL — as their
>   label and stroke ink. That looked fine only by accident: the old solver dragged
>   the light fill down to tone 11, where it doubles as text. With the fill correctly
>   back on the brand (Neo light `#8e6300` brown → `#eebd62` gold), every ghost button
>   inherited fill-weight ink and measured **1.9:1**. `statusInk()` redirects Brand to
>   `t.brandText` (`content.accent`, audited `body-text`) — the role that exists for
>   exactly this — restoring 4.73:1, while the soft/pressed WASHES stay keyed to the
>   fill. **Only Brand is redirected**: the four status intents keep tone 9 and get no
>   ink field, per the `StatusSpecimen` note above (`errorInk`/`warningInk`/
>   `successInk` were deleted, not to be reintroduced). `Button`'s entry in
>   `componentColorFields.generated.ts` gains `brandText` — regenerate, don't hand-edit.
> - **Known residual, unchanged and deliberate**: a ghost button's ink on a step-2 CARD
>   measures 2.93–3.94:1 in light, because `content.accent` is solved against the
>   PAGE. That is the system-wide "text on a step-2/3 surface" residual already
>   documented above, not a regression — it is up from 1.9:1, and fixing it means
>   moving `content.accent` to tone 12, which that note explicitly leaves alone.

> **UPDATE: the four `PreviewTokens` severity fields were wired to the INK role while
> being painted as FILLS, and `status.*.surface-solid` was pinned to the near-white end
> of the dark ramp.** Reported from the artefact view: "el botón critical background está
> recibiendo `status.critical.content` cuando debe recibir el de surface."
> - **`put('errorColor', 'status.critical.content')`** (and the other three) pointed a
>   FILL field at the role solved to read as TEXT on a pale tint. `errorColor` is
>   documented "destructive accent", its flat definition is `pal.error[9]` — a solid —
>   and specimens paint it as one (Solid Danger's background, the ContextMenu Delete
>   pill, the Avatar presence dots). So a destructive button took its own label colour
>   as its fill. **It hid because in LIGHT the two roles resolve to the same hex** —
>   measured across all six styles, `content == surface-solid == #b94136` on Core. They
>   only diverge in dark, which is where it was seen. Now `status.*.surface-solid`,
>   whose own `[ROLE:]` comment reads "Solid fill for destructive badges and buttons".
> - **The dark pin went with it.** `surface-solid` was `{fam.solid}` light / `{fam.12}`
>   dark, carrying the reasoning "so the fill still reads as coloured on a dark page" —
>   exactly backwards, since tone 12 of a DARK ramp is the near-WHITE end. Measured
>   before: critical dark resolved `#ffddd5 · #ffddd5 · #ffded6 · #ffded6 · #ffdfd7 ·
>   #ffe0d8` across the six styles — one washed-out Delete button everywhere, the same
>   defect `brandSolidPair` exists to stop. Both appearances are `{fam.solid}` now, so
>   the fill is solved per appearance and lands near the anchor.
> - **Moving the fill broke the INK sites, so the pair is split at the point of use.**
>   Measured after the repoint: the fill used as dark-mode ink runs **2.85–3.52:1** where
>   the ink role runs 10.72–11.93. `statusInk`/`errorInkOf`/`warningInkOf`/`successInkOf`
>   (`specimens.tsx`) read `status.<sev>.content` for helper text, required asterisks,
>   the Dropzone error glyph and destructive menu rows; borders keep the fill (they are
>   `ui-component`, 3:1, and a severity stroke should be vivid). **This is NOT the
>   deleted `errorInk`/`warningInk`/`successInk`** — those SUBSTITUTED a repaired colour
>   when a token failed on its own tint, making one specimen disagree with every other
>   preview. Nothing is repaired here; each call site is pointed at the role for the job
>   it does, and a flat system falls back to today's value unchanged.
> - **`ButtonSpecimen`'s Solid branch used `t.onBrand` for every intent** — the ink
>   solved against the BRAND fill — so a red Danger button wore the label chosen for a
>   gold or cyan one. Measured in the collage: Neo **1.90:1**, Glass **2.16:1** (Core and
>   Retro passed by luck, their brand ink happening to be near-white). `statusOn()` reads
>   `status.<sev>.on-solid`, solved per severity against its own fill. After: all twelve
>   style×appearance Danger buttons clear AA, worst **4.76:1**.
> - **Two things `gen-component-color-fields` forces, learned the hard way.** It resolves
>   each specimen's field list as the transitive closure over this file's call graph, so
>   (a) a helper must be a `function` DECLARATION — an arrow const truncates the closure
>   and Label/Field/ContextMenu/DropdownMenu silently lost `errorColor` from their agent
>   context — and (b) a single-severity call site must NOT route through the generic
>   `statusInk` switch, or it inherits every field the dispatcher touches and a Label
>   starts advertising `successColor`. With both observed, the generated file is
>   byte-identical to before: the refactor changed which ROLE each site reads, not which
>   tokens any component touches.

> **UPDATE: destructive and confirming are ONE control painted ONE way, and which way
> is a style axis (`statusAction`).** Reported as the green success button getting a very
> different treatment from the destructive one. It did, and it was the collage's own
> fault: `SystemCollage` hardcoded `Style: 'Solid', Color: 'Danger'` beside
> `Style: 'Soft', Color: 'Success'` — two different STYLES, so the two severities read as
> unrelated components and could not be compared at all.
> - Unifying them raised the real question: unified as WHICH? Both answers are right for
>   different systems, so it is a style axis rather than a global default —
>   **`solid`** fills with the severity and puts the solved `on-solid` ink on top (near-
>   white on every seed here), **`soft`** washes it and uses the severity's OWN
>   `status.<sev>.content` text. Core · Neo · Material ship `solid`; Glass · Retro ·
>   Nature ship `soft`, so the set demonstrates both. It threads exactly like
>   `panelBackground` (foundation field → `PreviewTokens`), which is the same shape of
>   decision.
> - Verified live, both severities identical per style: Core `rgb(217,45,32)` /
>   `rgb(31,131,79)` solid; Glass `rgba(184,56,45,0.1)` / `rgba(112,210,128,0.1)` soft.

> **UPDATE: a button label is `text-sm`, not `text-md`.** It was a full step above
> `label` and above body copy, which made the button the LARGEST text on screen —
> measured **17px against 15px body** on the three styles using the `comfortable` type
> scale (×1.0625), because the scale multiplies every step and `text-md` IS the body
> size. A button label and a field label are the same TIER; the button is just heavier.
> Now 12–15px across the six, under the 16px ceiling a control label should respect, and
> desktop finally agrees with mobile, which already used `text-sm`.
> **Capping the resolved px was considered and rejected**: the CSS export emits
> `var(--font-size-text-md)` for this role, so a numeric clamp would preview 16px and
> ship 17px — the exact preview/export drift the alias model exists to prevent. Moving
> the ALIAS keeps one value in both.

> **UPDATE: `AvatarSpecimen` has TWO kinds, selected by `v.Variant` — the solid-gradient
> detour is reverted.** A first pass replaced the accent-tint + initials avatar with a
> solid `avatarFillOf()` gradient everywhere; it read as decoration, not identity, so the
> initials look is the default again (`soft(brandSolid)` + `brandText` + "MD").
> - **`Variant: 'Gradient'`** drops the letter and fills with a soft 3-stop. `v.Hue`
>   (degrees) rotates it off the accent through ONE lightness/chroma envelope
>   (`avatarHueGradient`), so a rotated set reads as a family — periwinkle → mint →
>   lavender → amber → coral, matching the reference the request attached. Omit `Hue` and
>   it uses the system's assigned avatar gradient (`avatarFillOf`, → `coverGradient` →
>   hue-0 fallback).
> - Both are **opt-in and inert**: every pre-existing call site omits `Variant` and gets
>   the initials avatar byte for byte, so `Avatar`'s `componentColorFields` entry is
>   unchanged (`brandSolid` · `brandText` · `neutralText`).
> - **`AVATAR_STACK_HUES = [0, 42, 96, 168, 214]`** is the cool→warm hue sequence; the
>   collage team stack takes the first FOUR — three `Gradient` avatars (hue-rotated) in a
>   run so the family reads as a set, THEN one initials default to break the rhythm, then
>   the count. Not a catalogue axis — the plugin's `Avatar` set is still `Size`-only;
>   `Variant`/`Hue` ride in `v` the same opt-in way `w`/`children` do.

> **UPDATE: `BadgeSpecimen` has a dotless COUNT form (`Dot: 'False'`) and `CloseButtonSpecimen`
> has a resting fill.** Both reported from the collage.
> - A "+5 more" overflow tag is a COUNT, not a status, so it should not carry the status
>   dot. `Dot: 'False'` drops the dot, symmetrises the padding and switches to
>   tabular-nums / medium. Opt-in and inert — every other Badge call keeps the dot, so the
>   `componentColorFields` entry is unchanged. **Its fill is `soft(neutralText)`, not
>   `neutralFill`**: the Soft-Neutral fill is `surface.layer-1`, the exact token a Card
>   resolves to, so a neutral count badge on a card was invisible (`rgb(250,250,250)` on
>   `rgb(250,250,250)`). The dot normally carried the badge; with no dot it needs a fill
>   that is a step off any surface, which the ~10% ink wash is in both themes. This is the
>   same `surface.layer-1 == card` collision the CloseButton fix hit.
> - A bare `×` on a card "se ve como perdida" — it was `background: transparent` at rest.
>   Now `soft(t.neutralText)`, a ~10% wash of the page ink: a faint LIGHT circle on a dark
>   theme, a faint GREY one on a light theme, always a step off the surface behind it.
>   Hover deepens the same wash (`tintOf(neutralText, '20', 0.16)`). `CloseButton`'s field
>   map swaps `neutralFill` → `neutralText` — regenerate.

> **UPDATE: Retro's input stroke is 1px.** It carried a 2px stroke copied from Neo, but
> the two are not doing the same job — measured, Neo's field is FLAT (ΔL 0.000 between
> fill and page, so the outline is the only thing identifying the control, which is the
> whole brutalist point) while Retro's field has a real fill at ΔL 0.032, the same
> separation Core gets with 1px. A vintage press rules fine lines; Retro's character is
> the warm ink COLOUR (`inkBorders`), which is untouched. Only the weight drops, so
> `border.control` still clears its 3:1 floor.
> - **Material's border was left alone deliberately, and it is the one that looks like it
>   should move.** Its fill is by far the strongest — ΔL 0.072–0.078 against the page,
>   ~2.5× every other style, exactly as M3's filled text field intends — but neither the
>   fill (1.24:1) nor a lighter border would clear WCAG 1.4.11's 3:1 on its own, and the
>   current alpha was solved to be the first ladder step that does. Lightening it is the
>   measured mistake the `ThemeStyleSemantics` note already warns about. The honest way
>   to give Material its M3 look is an underline FIELD SHAPE, which is a second axis and
>   its own change.

> **UPDATE: each System Style renders Phosphor at its OWN WEIGHT (`iconWeight`).**
> Requested — "que dependa del theme el tipo de style icon: thin, light, regular, bold,
> fill, duotone" — and to confirm the icons come from the recommended library. They do:
> `PreviewIcon` resolves every glyph from `@phosphor-icons/core` (committed under
> `src/generated/`, regenerated by the `predev`/`prebuild` hooks — the DOM masks the
> Phosphor path markup). The SET never changes; only the weight is a style axis, one of
> the cheapest ways to give a set character.
> - **`iconWeight` is a `ThemeFoundationOverride` field** (beside `panelBackground` /
>   `statusAction`), threaded through `resolveThemeFoundations` → `PreviewTokens` the same
>   way. Store field + `setIconWeight`, seeded `'regular'` (store v68 — `regular` is what
>   every pre-`iconWeight` system rendered).
> - **`PhosphorWeightProvider` (`specimens.tsx`) carries the loaded body map down a
>   subtree.** `regular` is `PHOSPHOR_CORE_BODIES`, synchronous. Every other weight is a
>   lazy chunk (`loadPhosphorWeight`), so a subtree renders `regular` for one frame then
>   swaps in. `PreviewIcon` reads the context — no call-site change, all 25 uses benefit.
>   `SystemCollage` and `ArtefactsPane` wrap their output in it from `t.iconWeight`.
> - **The set spans five of the six weights**: Core `regular` · Neo-Brutalism `bold` ·
>   Cupertino/Glass `light` · Material `fill` (filled icons ARE a Material signature) ·
>   Retro `bold` · Nature `duotone`. Duotone survives the CSS-mask path (`opacity="0.2"`
>   on the secondary path → 20%-alpha region → a real two-tone in one hue); verified by
>   the mask markup running ~130 chars longer for Nature than the others.

> **NOT DONE, and why — light and dark status solids resolving to the same hex.**
> Reported as dark picking the most muted colours for accessibility while light receives
> the same values. Measured: **11 of 30** status/action solids are byte-identical across
> the two appearances. The cause is structural — `brandSolidPair` prefers the tone
> nearest the anchor, and tone 9 IS the seed hex verbatim in BOTH ramps (the Radix
> two-scale model), so whenever the seed carries its own label in both, both resolve to
> it. Two principled ways to break it were built and measured, and BOTH are worse:
> - **A 3:1 floor against the page** (WCAG 1.4.11 — a button must be visible as a button)
>   takes identical from 11 → 1, but pushes dark solids back to the near-white end
>   (`#ffbcae`, `#ffbe92`, `#a7cfff`) and drags Neo's light gold `#eebd62` back to brown
>   `#8e6300`. It reintroduces both defects `brandSolidPair` was written to fix.
> - **Lifting the dark anchor one step** (ordering by `|t − 10|`) reaches tone 11 before
>   tone 8, so **24 of 30** dark solids become pastels — worse than the status quo.
> An identical hex at the anchor is the brand-faithful answer, so the variety comes from
> the seeds and from `statusAction` instead. Do not "fix" this without re-running those
> two measurements.

> **UPDATE: each System Style declares its OWN four severity seeds (`ThemeStylePreset.states`,
> resolved through `presetStates`).** Reported alongside the above: "veo esto repetitivo por
> todos los temas, no estás variando de colores para success, warning, error, info."
> - **Confirmed by measurement, and it was worse than "similar".** `previewHarmony` derives
>   the four from the accent via `recommendStateColors`, which blends CHROMA only — keeping
>   each severity's canonical hue and lightness, because a red drifting toward a green accent
>   stops reading as an error. That is right for a system whose accent the user picked, and
>   wrong for a curated set: six very different accents collapsed onto
>   `warning #ff8a00 · #f5911c · #f09434 · #ff8a00 · #ff8a00 · #f69011` and
>   `success #00b75f · #17b26a · #31b06e · #00b75f · #00b75f · #08b369` — Core, Material and
>   Retro shipping **byte-identical** warning and success.
> - **Each set is anchored to a real reference, not invented**: Core takes conventional
>   product severities, Neo near-primary saturated ones, Glass Apple's own systemRed/Orange/
>   Green/Blue verbatim, Material M3's baseline error `#b3261e` plus palette 800s, Retro muted
>   press inks (brick · mustard · moss · slate) and Nature earth pigments (clay · honey · leaf
>   · river). The hues still read as their severity — that constraint is not negotiable.
> - **`presetStates` is shared by the try-on and `adoptPreset`**, so a previewed style and the
>   theme it mints seed identical families — the `MintPages` rule applied to the severity
>   slots. `slotsFromAccent` takes the override as an optional third argument; omit `states`
>   and a preset falls back to the accent-derived recommendation exactly as before.
> - Verified after: **6/6 distinct** for all four severities (zero duplicates), worst
>   `on-solid` pair **4.57:1**, worst `content`-on-page **5.22:1**, and the full contrast
>   matrix still 0 failures across 1120 pairs.

> **UPDATE: `status.info.*` was missing entirely — the Info primitive (full generated ramp,
> exported to tokens.json) had zero Categorical roles referencing it.** A designer retinting
> Info saw nothing move anywhere in Semantics. Added `status.info.surface` (`{info.3}`) and
> `status.info.content` (`{info.11}`, **not** `{ink:info.3}`) — same shape as
> critical/warning/success. The `{ink:…}` marker was considered and rejected: it collapses
> to tone 12, and this table already documents (see the `status.critical.surface` comment
> above) that 12 "reads as near-black… and loses the severity hue" for exactly this kind of
> tint pairing — critical/warning/success are pinned to the chromatic tone 11 for that
> reason, and info follows the same rule rather than inventing a second mechanism for one
> severity. Measured against the live system's info seed (`#3690f5`): info.11 on info.3
> clears WCAG 4.35 / Lc 63.8 in light and 10.21 / Lc 73.6 in dark — the same range
> critical/warning/success already accept (critical's own residual is Lc ~42, kept anyway).
> `status.*.surface-solid`/`on-solid` were NOT added for info — critical is the only severity
> with a solid pair today; adding one for info alone would make it the second-best-equipped
> severity while warning/success still have none. One decision across all four, not an
> info-only addition. Role count: 39 → 41. **Now 51** — see "THE ALPHA LAYER"
> above: six `action.ghost.*` (split by intent), three `border.ring.*` and
> `border.rim-highlight` were added, and five existing roles (`surface.selected`
> + the four `status.*.surface`) moved from a solid tone to their alpha twin.
> **Now 61 — and the solid pair the note above deferred has landed, for all four
> severities at once, exactly as it said it would have to.** See
> `design-plans/foundations-geometry-and-strokes.md` (phase 0). What forced it was a
> real failure, not a tidy-up: in Figma, InlineAlert Info shipped a `#1570ef` stroke on
> a `#131c2a` fill — **both byte-identical to `code.ts`'s own `pair()` fallbacks**, so
> the role was provably binding to nothing. `ARCH_ROLE_MAP.categorical` had no
> `status-info` entry at all, and there was no `status.info.surface-solid` to bind a
> stroke to even if it had. Added `{warning,success,info}.surface-solid` + `.on-solid`
> (`{fam.solid}`/`{on:fam.solid}` light, `{fam.12}`/`{on:fam.12}` dark — critical's
> exact shape; measured 5.1–5.2:1 light and 9.5:1 dark, all four clear AA).
> - **`status.*.border` is new and is the load-bearing part.** The stroke of a status
>   surface was a magic number in *three* places that disagreed: the plugin's
>   InlineAlert at `fillP(k.solid, 0.4)`, its AlertBanner at `0.45`, and the
>   configurator's own specimen at `` `${c}33` `` — **40 % in Figma against 20 % in the
>   preview, same component**. That is precisely the drift the "every specimen is a
>   catalogue renderer" rule exists to stop, and nothing caught it because none of the
>   three read a token. All four severities now resolve `{fam-a.6}`, the same step
>   `border.ring.*` already uses. Verified live in the browser: the three alerts render
>   `rgba(6,114,244,0.37)` / `rgba(1,146,49,0.35)` / `rgba(244,117,6,0.37)`, matching
>   the projected token hex for hex.
> - **It is ALPHA by contract, and there's a test.** The tint it sits on is alpha too
>   (`status.*.surface` is `{fam-a.3}`), so a solid stroke composites against a
>   different backdrop than its own fill and the two drift apart on any surface that
>   isn't the page. `categorical.test.ts` asserts every `status.*.border` label ends in
>   `-a.N`, and a second test asserts all four severities carry the **identical** role
>   shape (`surface · content · surface-solid · on-solid · border`) — the
>   "one decision across all four" rule made checkable instead of re-argued.
> - **Not measured for WCAG 1.4.11**: this is the edge of a MESSAGE, not a control
>   boundary. The severity is carried by `status.*.content` and the glyph. The status
>   role that *does* bear a boundary obligation is `border.critical`/`.warning`/
>   `.success`, unchanged.
> - **No `schemaVersion` bump** — new keys under `colors.architecture.tokens`, the same
>   additive precedent as `shadowsDark`/`gradientsDark`; an older plugin ignores them.
> - **`fillOf()` in the plugin is alpha-aware now.** It read an 8-digit fallback hex
>   with `hexToRgb`, silently dropping the alpha channel and painting a translucent role
>   fully opaque whenever the variable was missing. v7 made semantic colours
>   translucent, so that was the "keeps working while quietly wrong" failure v7's own
>   note warns about — a scrim or an alert stroke at 100 %. A bound COLOR variable
>   supplies its own alpha, so both paths now agree.

> **DECISION: there is no `border.focus.critical` — an invalid, focused input shows the
> normal accent focus ring, not an error-coloured one.** Raised by the same external audit
> as a possible naming gap. Genuinely no wrong answer here, so it's recorded as a choice:
> focus wins over error-state colour, matching Material and Carbon (WCAG does not require a
> severity-coloured ring), and it keeps ONE focus-ring token instead of one per severity that
> would need the same solver treatment `border.focus` just got. If this is ever revisited,
> the mechanism already exists — `{ui:error.9}` through the same `uiBoundaryRef` — so it's a
> one-line addition, not a new solver.

> **UPDATE: `StatusSpecimen`'s alert/chip TEXT was reading Astryx's (and shadcn's) vivid
> tone-9 solid as literal ink on a tone-3 tint, and it failed contrast badly.** Reported as
> "Astryx manages status values better, make Categorical match it" — measuring the two
> side by side showed the opposite: Categorical's `status.*-fg` (`{error.12}` etc.) is the
> one that's correct, at 9.9–10.3:1 on a live system; Astryx's `status.error` used for the
> SAME purpose measured **2.05–3.10:1** (fails WCAG AA's 4.5:1 text minimum, and warning/
> success don't even clear the 3:1 non-text floor). Root cause: `status.error` IS Astryx's
> real contract — a vivid tone-9 fill/icon colour, correct for the dozen other places
> `PreviewTokens.errorColor` is used (a solid "Delete" button, focus rings, icons) — it was
> simply never meant to be text sitting on its own pale tint, and Astryx's real contract has
> no dedicated role for that (only `on-error` = `{on:error.9}`, solved ink for the SOLID,
> a different surface entirely). shadcn's `destructive.fill` has the identical gap, and by
> the source contract's own admission: "no paired -foreground in the source variables."
> Fixed WITHOUT touching either role table (no fabricated "real-looking" Astryx/shadcn role
> invented, and no export change — both still ship their real `status.error/destructive.fill`
> tone-9 values byte-for-byte) — `PreviewTokens` gained `errorInk`/`warningInk`/`successInk`
> (`previewTokens.ts`), tone 12 of each family in the previewed appearance, same maths
> Categorical's own `-fg` roles already run, computed once so every architecture can use it.
> `StatusSpecimen`'s `inkSlot()` wrapper still resolves the candidate list first (so the
> caption keeps naming the architecture's own token — `status.error` for Astryx, honest
> labelling per this file's own captioning rule) and only swaps in the accessible ink for
> the rendered colour, gated on `t.archTokens` being set (non-flat) so flat's own matching,
> already-tracked `content-error` gap (see "known, accepted residuals" above) is left alone
> exactly as that note says — it's MATERIALIZED per-theme and needs a role-catalogue
> migration, not a preview patch.
>
> **SUPERSEDED TWICE, and the substitution is GONE. Do not bring it back in any form.**
> The idea was: when a status fg reads under AA on its own tint, paint a legible tone
> instead and disclose it. It was narrowed once (unconditional → measured), then removed
> entirely, because **a colour repaired in one preview is a colour that disagrees with every
> other preview about the same token** — reported twice, from opposite directions:
> once when the Status preview showed `#ffbdb2` while the Color collage showed `#f36456`,
> and again when it showed `#0c3b22` while the collage showed `#2ea064`.
>
> It cannot be fixed by moving the guard DOWN either: the collage renders `SPECIMENS`, which
> is what the Figma plugin ships, so a preview-only contrast fudge there would make the
> specimen disagree with the exported component (the collage's "never hand-rolled markup"
> rule). The guard had nowhere correct to live, so:
> - **Every slot renders the token's REAL value.** `ContrastFlag` reports a failing pair as a
>   ratio badge (same vocabulary as the architecture picker's contrast strip) instead of
>   repairing it. An honestly unreadable alert is information — it is exactly that unreadable
>   in production, and the row it sits on is the row you'd go fix.
> - **The "failure" was mostly a MODELLING error, not a token error.** Astryx/shadcn ship no
>   text-on-tint role; their `status.error` / `destructive.fill` is a FILL for icons and solid
>   buttons. Forcing it into a text slot is what made them fail. Those systems put neutral
>   text on a muted tint and spend the severity colour on the DOT — so the fg list falls
>   through to their own `text.primary` / `base.foreground`, and `sev.dot` carries the
>   severity solid. Verified on Astryx: chip dots `#f04438 / #f79009 / #17b26a`, byte-identical
>   to the Color collage's pills, and **zero contrast flags** — nothing needed nudging once the
>   modelling was right. Categorical is unaffected (its `status.*-fg` IS the text role, so fg
>   and dot resolve to the same token there).
> - **A flag is a real finding, not decoration.** Verified on a hand-edited Categorical
>   override (`success-fg {success.10}` on `success-bg {success.4}`): the alert renders the
>   user's actual `#2ea064` — matching the picker and the collage — with a `2.6:1` badge.
>   Before, that same override was silently repainted `#0c3b22` in this one view.
> - **`PreviewTokens.errorInk`/`warningInk`/`successInk` were deleted** — they existed only to
>   feed this substitution. Their absence is documented in `ButtonPreview.tsx` so they don't
>   get re-added as an obvious-looking "missing" field.
> - **Audited the rest of `specimens.tsx` for the same bug class** (a vivid state colour used
>   as literal TEXT sitting on a TINT of itself) and found none: Dropzone's error state pairs
>   `t.errorColor` text/icon with `soft()`/`softer()` backgrounds (5–10% alpha over the
>   surface, not a muted-tone tint), measured 4.69–4.90:1, passes. PasswordStrength's meter
>   text sits on plain `t.surface`, not a tint of itself — 4.72–5.10:1, passes. The failure is
>   specific to the STATUS tint (a much stronger fill than a 5–10% overlay), not to "vivid
>   colour as text" generally — don't generalize without measuring. **Two-tier fallback matters**: `errorInk` must fall back to
> the plain global scale (`kind === 'dark' ? errorDarkScale : errorScale`) before a hardcoded
> constant, same as `errorColor` above it — `pal` (`resolveThemePalette`) returns `undefined`
> whenever `themeSources` doesn't reference a custom family for that slot, which is the
> COMMON case (any system with no custom "+Theme" families has an empty `themeSources`), not
> an edge case; a first pass that read `pal?.error?.[12]` with no second tier silently
> produced `undefined` for exactly that common case and the bug looked unfixed.

> **`GRAY_DARK_SCALE` (the hardcoded fallback constant) was ALSO a leftover pre-Radix
> ramp — same bug class, one level lower.** It's `1: '#fafafa' … 12: '#0c0e12'`: light at
> tone 1, `darkBackground` at tone 12 — the OLD mirrored convention, inverted relative to
> what `generateDarkColorScale()` has produced for a long time (tone 1 IS the dark page).
> It's not just an inert fallback: it was `makeDesignDefaults()`'s literal seed for
> `grayDarkScale`, meaning **every brand-new system shipped with an inverted dark neutral
> ramp until the user's first edit to Gray/Neutral regenerated it correctly.** Symptom: a
> fresh system previewed in dark mode before ever touching a colour control rendered
> backwards — near-white "page," near-black "text" — reproducible by clearing storage and
> checking `grayDarkScale[1]` against `darkBackground` before touching anything. Fixed by
> adding **`DEFAULT_GRAY_DARK_SCALE`** — the SAME ramp `generateDarkColorScale()` computes
> for the default accent/gray/darkBackground, computed once at module load so it can't
> drift from the live generator — and switching every "when missing, fall back to X" site
> (`makeDesignDefaults()`, `tokenGenerator.ts`, `previewTokens.ts`, `semanticRoles.ts`) to
> it. **`GRAY_DARK_SCALE` itself is UNTOUCHED and must stay that way** — the v31→v32
> migration explicitly seeds it into pre-v32 localStorage to preserve "the exact dark they
> already had"; changing its values would silently alter what that migration produces for
> anyone still carrying genuinely ancient state. If you ever need "the correct default dark
> neutral ramp," that's `DEFAULT_GRAY_DARK_SCALE` — `GRAY_DARK_SCALE` has exactly one
> remaining job and it isn't that.

---

## Component Catalogue

**The Figma plugin is the source of truth** (`../escala-figma-plugin/src/code.ts`): each catalogue `key` equals a plugin CATALOG `gate`, `axes` mirrors the plugin's SPECS variant matrix, `figmaSets` lists every component set the key unlocks in Figma, and `category` mirrors the plugin's "❖ Category" divider pages. When the plugin's CATALOG/SPECS change, mirror them here — never the reverse.

The catalogue holds **59 components**. The original plugin families were split into standalone entries (Button Group, Input OTP, Radio, Chip, Alert Banner… each owns the plugin set its parent used to bundle). The catalogue-first state (`figmaSets: []`, meaning the plugin gate doesn't exist yet) still exists as a mechanism — the doc pane shows a "not in the Figma library yet" note whenever it's hit — but **measured 2026-08-24, zero entries are currently in it**: the plugin has shipped a gate for every catalogue key. Don't assume any entry is spec-only without checking `figmaSets` directly; the last time this file claimed a count ("~20 entries") it had gone stale without anyone noticing. When a set lands in the plugin, fill in its `figmaSets`. Display-name renames (keys stay stable for plugin gates + export): `Toggle`→"Switch", `Divider`→"Separator", `Breadcrumb`→"Breadcrumbs".

`src/lib/componentCatalogue.ts` contains the `COMPONENTS` array (pure data — imported by the store, the catalogue list, and `docs/componentArticle`). Each definition has:

```ts
interface ComponentDef {
  key: string         // unique ID — plugin gate; matches export key in tokens.json `atoms`
  label: string       // display name
  category: string    // Button & Actions | Form Controls | Indicators | Content & Surfaces | Feedback | Navigation
  description: string // one-liner
  usage: string       // when to use / when not to use
  axes: { name: string; values: string[] }[]  // plugin variant matrix; [] = single component
  figmaSets: string[] // Figma component sets this key unlocks (plugin CATALOG entries)
  props: { name, type, description }[]
  accessibility: string
}
```

**To add a new component:** add its gate + spec in the plugin first, then mirror it in `COMPONENTS`. The catalogue list renders it automatically and it's included by default.

**Docs are an interactive playground** (`docs/componentArticle.tsx` + `docs/specimens.tsx`) — and there is exactly ONE page per component, not a separate "browse" and "read" pair (see the Navigation model's merge note): a live token-driven specimen on a canvas with per-axis controls (dropdowns / switches driving the exact plugin axes) and a Preview/Code toggle whose snippet tracks those controls, a **"Use it" block** (Figma · Code · AI, see below), a usage snippet with Copy, per-axis Examples, a "Ships in Figma" section (figmaSets + variant count), the props + variants tables, and accessibility. To support a new component, add its render to the `SPECIMENS` registry and a case to `snippetFor()` in `docs/specimens.tsx`.

> **Every element documented answers "how do I consume this" the same way: `docs/useIt.ts` → "Use it" (Figma · Code · AI).**
> Both page kinds — a component article and a foundation article — render the
> identical block right after their description, before any conceptual prose,
> the slot Create UI's own component docs give "Installation". It supersedes
> the old `ShipsAs` (a static 3-row table of hand-written NAMING patterns —
> `--color-<family>-<tone>`, not a real value, and not copyable) with tabs
> whose content is **live and derived**: Figma names the real `figmaSets` (or
> says "not in the Figma library yet" for a spec-only entry — never invents
> one); Code is a real, resolved excerpt via `buildSectionExport(key, 'css')`
> or the hero's own `snippetFor()` snippet; AI is the actual MCP call for
> THIS element (`resolve_token` / `get_component`) with the real project slug
> from `syncProjectId()`. Nothing is authored per element — with 59
> components and 9 foundations that would be unmaintainable, so every string
> composes an existing builder; if `buildCSS` renames a variable, the block
> renames with it.
> **One contract, three outputs, not three copies of the truth.** The same
> `UseIt` descriptor also serialises into `foundationMarkdown()` / the
> component's agent-context markdown ("Copy Page") — so a pasted spec can
> never claim a destination the page doesn't show — and `src/lib/__tests__/
> useIt.test.ts` asserts the Figma tab and MCP's `get_component` name the same
> `figmaSets` for every catalogue entry, turning what used to be a coincidence
> (both read `COMPONENTS`) into a guarantee. `CopyButton` on every tab copies
> EXACTLY the pane's own content — for Color's 89 roles that's a representative
> excerpt (`CSS_PREVIEW_LINES` in `useIt.ts`), with an explicit "+N more" line
> and a pointer to Export → Code for the full file, never a silent truncation.
> Deliberately NOT covered yet: a "Styling" section naming which semantic
> roles a component consumes — `specimens.tsx` reads them off `PreviewTokens`
> without declaring them anywhere, so that would mean ~59 hand-written lists
> today. Needs a `tokens: string[]` field on `ComponentDef`, mirrored from the
> plugin like every other catalogue field, before it can be derived.

---

## Token Export Format

```json
{
  "schemaVersion": 3,
  "project": "my-system",
  "colors": {
    "primitive": { "1": "#f5f0ff", ... "12": "#1a0a3d" },
    "semantic": { "text-primary": "#101828", "surface-0": "#ffffff", "action-primary": "#7f56d9", ... },
    "semanticDark": { ... },
    "themes": { "light": { ... }, "dark": { ... }, "<custom>": { ... } },
    "themeOrder": ["light", "dark", "<custom>"]
  },
  "typography": {
    "fontFamily": "Inter",
    "headingFontFamily": "Inter",
    "sizes": { "text-xs": "12px", "text-sm": "14px", ... "display-2xl": "72px" },
    "lineHeights": { "text-xs": "18px", "text-sm": "20px", ... "display-2xl": "90px" },
    "weights": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 }
  },
  "spacing": { "1": "4px", "2": "8px", ... },
  "gradients": { "brand-cover": "linear-gradient(135deg, #7f56d9 0%, #432e73 100%)", "aurora": "...", ... },
  "gradientsDark": { "brand-cover": "linear-gradient(135deg, #7f56d9 0%, #e1bfff 100%)", "aurora": "...", ... },
  "gradientAssignments": { "cover": "brand-cover", "avatar": "aurora" },
  "radius": { "none": "0px", "sm": "4px", "md": "8px", "lg": "12px", "full": "9999px" },
  "shadows": { "xs": "0 1px 2px rgba(10,13,18,0.05)", ... "2xl": "..." },
  "shadowsDark": { "xs": "0 0 0 1px rgba(255,255,255,0.048), 0 1px 2px rgba(0,0,0,0.265)", ... },
  "grid": { "columns": "12", "gutter": "24px", "margin": "32px", "container": "1280px", "breakpoint-sm": "640px", ... },
  "sizes": { "xs": "24px", "sm": "32px", "md": "40px", "lg": "48px", "xl": "56px", "2xl": "64px" },
  "icons": { "library": "lucide", "name": "Lucide", "package": "lucide-react", "custom": [{ "name": "star", "svg": "<svg…>" }] },
  "atoms": ["Button", "Input", "Badge", ...]   // ← canonical field name the Figma plugin expects (NOT "components")
}
```

`tokenGenerator.ts` generates this (the README markdown in `ExportView.tsx` mirrors it, incl. an Icons section). If you add fields to the store, also add them to `generateTokenJSON()` and the markdown. `schemaVersion` (`TOKEN_SCHEMA_VERSION` in `tokenGenerator.ts`, now **7**) versions the contract the plugin checks. v4 added the per-family dark primitives (`accent-dark-*`, `error-dark-*`, … alongside `neutral-dark-*`) — additive, so an older plugin ignores them; **the plugin still needs updating to import them as a dark mode**. v5 REMOVED `opacity` (see "Opacity is retired" below) — the plugin's own import is already guarded (`if (tokens.opacity)`), so it degrades gracefully without a plugin-side change; the bump is a signal for anything else that might treat an absent field as a gap rather than "not part of this system." `shadowsDark` was added WITHOUT a bump, on the `gradientsDark` precedent: a complete parallel map under the same keys is purely additive, so an older plugin ignoring it is the correct outcome (see "Shadows ship a DARK TWIN" above). **v7 is the one to know about: semantic colours can now be TRANSLUCENT.** `colors.architecture.tokens` ships 8-digit `#rrggbbaa` for the 16 alpha-backed roles. The SHAPE is unchanged, which is precisely why it needed a version signal rather than riding in silently like `shadowsDark`/`gradientsDark` did — those added ignorable KEYS, while this changes the value domain of keys that already existed, so a consumer parsing with a 6-digit assumption keeps "working" while silently dropping the alpha and painting an opaque scrim over the page it was meant to dim. `colors.primitive` and `colors.themes` (the flat catalogue) stay fully opaque — only the architecture projection carries alpha. The plugin was updated in the same pass (`SUPPORTED_SCHEMA_VERSION` 7): `archValueRgba`/`hexToRgba` already handled 8-digit hex and Figma COLOR variables carry alpha natively, so translucent roles import as genuinely translucent variables; the `{family.tone}` fallback path DID need fixing (`primitiveRefHex`), since it looked only in `colors.primitive` where no alpha key has ever existed. The plugin also reads optional `copy` / `borders` sections that the configurator does **not** emit yet (plugin-ready forward-compat).

---

## API — /api/tokens

- `GET /api/tokens?project=<id>` → returns that system's tokens (Blob key `tokens/<id>.json`). Public, unauthenticated.
- `GET /api/tokens` (no project) → `400`. There is no global latest blob.
- `GET /api/tokens?list=1` → `{ systems: [], listing: false }` — query param kept, enumeration disabled.
- `POST /api/tokens?project=<id>` → write from this app only (`Origin` + per-slug claim after first publish). Not a user login. Durable save is GitHub (`.escala/system.json`).
- `POST /api/tokens` (no project) → `400`. Same as GET.
- CORS headers allow `*` — required for Figma plugin GET, not a reason to leave POST open.
- Uses `@vercel/blob` (free tier, 1GB). Do NOT switch to KV — it requires paid plan.
- **Per-system scoping (Fase 2)** — each design system publishes to its own scoped key, derived from `slugify(projectName)`. The plugin syncs one system by pasting its scoped URL; switching systems no longer overwrites another's tokens. The plugin names its Figma variable collection after `project`, so different systems land in different collections.

**Publishing flow** (`src/lib/figmaSync.ts` — the single source for POSTing tokens):
- `syncProjectId()` = `slugify(projectName)`; `syncPath()`/`syncUrl()` build the scoped `/api/tokens?project=<id>` endpoint shown in FigmaSyncView / ExportView / HomeView.
- `publishTokens()` POSTs `generateTokenJSON()` to the scoped endpoint and records `figmaLastPublishAt`. Used by the explicit manual request owned by **`Configurator`** (Workspace settings' **Sync now** or `FigmaSyncView`'s **Sync now** button) and the auto-sync subscription. Opening details alone never publishes; the download screen has no publish call at all.
- `useAutoFigmaSync()` (mounted in `Configurator.tsx`): while `autoSyncFigma` is on, debounce-republishes ~1.5s after edits stop. The change signal is the JSON of `generateTokenJSON()`, so the `figmaLastPublishAt` write can't loop. Toggle lives in `FigmaSyncView`.

> **This repo consumes its own MCP server — `.mcp.json` at the root wires
> `escala-tokens` → `https://escalatokens.com/api/mcp` into Claude Code.** The
> product publishes an MCP server whose whole purpose is that an agent resolves
> real tokens instead of inventing hex; the repo not using it was the one place
> that claim went untested. Six tools: `get_tokens`, `resolve_token`,
> `list_components`, `get_component`, `list_icons`, `check_contrast`
> (`lib/agentAccess/types.ts`).
> - **THE RULE: the MCP reads the PUBLISHED BLOB, not the editor.** Every
>   `project`-taking tool answers from the last `POST /api/tokens`. So a token
>   you just edited will NOT show up until someone hits **Sync now** — that is a
>   missing publish, not a bug, and the server says so itself: an unknown role
>   comes back with "the published system may predate it: re-publish from the
>   configurator". Measured 2026-09-06, the `escala` slug was serving
>   `schemaVersion 6` with **39 roles** against a codebase at **64** — i.e. no
>   alpha layer, no `status.*.border`, and no `border.control`/`border.default`
>   split. Worse than the absent roles are the CHANGED ones: `brandSolidPair`
>   and `uiBoundaryRef` moved `action.primary.*` and `border.focus`, so a stale
>   Blob hands back the values from *before* those accessibility fixes — exactly
>   the failure the `AgentInstallPanel` note above describes. **Check
>   `schemaVersion` before trusting a resolved value.**
> - **The two strings in `.mcp.json` are NOT hand-maintained.** They must equal
>   `MCP_SERVER_NAME` and `mcpEndpoint(DEFAULT_PUBLISH_ORIGIN)` from
>   `lib/agentInstall.ts` — the same pair `mcpClaudeAddCommand()` prints to
>   users in Docs, so the repo's own config can't disagree with what the product
>   tells everyone else. `__tests__/mcpConfig.test.ts` asserts it, including
>   that the host is the **apex**: the certificate carries only
>   `DNS:escalatokens.com`, so a `www.` URL dies at the TLS handshake before a
>   single JSON-RPC byte and reads as "the MCP is broken".
> - Publishing needs the per-slug claim in the publisher's own `localStorage`
>   (`publishTrust.claimStorageKey`), so **an agent cannot re-publish for you** —
>   only the person with the browser that first claimed the slug can.

---

## Figma Plugin

Lives at `../escala-figma-plugin/`. Separate project, separate `package.json`.

```
src/
├── code.ts    ← Figma Plugin API sandbox (importVariables, importStyles, importComponents)
└── ui.html    ← Self-contained plugin UI (Import tab, Live Sync tab, Log tab)
```

Build with `npm run build` (esbuild). Load in Figma via manifest.json.

**Live sync URL for plugin:** `https://www.escalatokens.com/api/tokens?project=<slug>`

---

## Design Principles

1. **No bloat** — every feature should earn its place. If it doesn't help the designer configure tokens, it doesn't belong.
2. **Tokens first** — all visual choices (colors, radius, spacing) come from the store. Never hardcode design values in components. Live previews resolve tokens via `usePreviewTokens()`.
3. **Workspace, not wizard** — the shell (top nav · controls · canvas) has no linear step counter, progress bar, or Continue/Back nav between sections (see Navigation model).
4. **Accessibility** — all interactive elements need keyboard support and ARIA. The component docs we generate should model this.
5. **Light & dark** — both themes are supported; **dark is the default** (see the dark-chrome note below — this REVERSED an earlier light default). Use the semantic color utilities (`bg-app`/`bg-surface`/`bg-elevated`, `text-fg`/`text-fg-muted`/`text-fg-faint`, `border-line`/`border-line-strong`) defined in `src/index.css` — NOT raw `neutral-*`. Dark mode = the `.dark` class on `<html>` (toggled in the **preview panel header**, persisted as `localStorage['sd-theme']`, applied pre-paint by the inline script in `index.html`). Keep `text-white` only on colored/accent fills; the user's token colors/previews are theme-independent (atoms render on `tokens.surface`).

   > **The chrome has its OWN status + type tokens now — use them, don't reach for raw Tailwind palette classes or `text-[Npx]` literals.**
   > - **Status:** `--status-{danger,success,warning,info}` (the INK — text/icon on the page, at any opacity for soft tints) and `--status-{…}-solid` (the FILL — buttons, dots, paired with `text-white`). Both flip with `.dark` / `.light` (registered via `@property`, values = the Tailwind shades the code used before — `-600`/`-400` for ink, `-500` for solid). So `text-status-danger` replaces `text-red-600 dark:text-red-400`, `bg-status-success-solid` replaces `bg-emerald-500`, `bg-status-warning/10` replaces `bg-amber-500/10`. A `dark:` variant on a status class is a smell — the token already switches. The one gap: an **inverted** surface (`bg-fg` toast, `background-overlay` chip) wants the opposite chrome's status value and there's no token for that — decorative status glyphs there are close enough, don't invent one.
   > - **Type scale:** `text-nano`(8) · `text-micro`(9) · `text-mini`(10) · `text-caption`(11) · `text-body`(12) · `text-ui`(13) · `text-strong`(14) · `text-title`(17) · `text-heading`(20) · `text-display`(26) — `@theme` in `index.css`, fixed px (they don't scale with the root media query, matching the `text-[Npx]` behaviour they replaced), font-size only (leading is inherited). Roles, not a t-shirt ramp, so no collision with Tailwind's `text-xs/sm/base…` (still ~220 uses in older code, un-migrated — leave them unless you're already reworking that file, since changing them IS a visual change: `text-xs` = 13.5px at this 18px root). **Type SPECIMENS** (a `style={{fontFamily}}` element rendering a chosen px) keep their `text-[Npx]` — that px is the spec, not chrome.
   > - Retired files (`NewTokenWizard`, `WorkbenchLayout`, `PickerColor`, `HomeView`) still carry the old raw classes — that's fine, they're unwired.

---

## Conventions

- Component files: `PascalCase.tsx`
- Step files: `StepN_Name.tsx` where N is the step number (foundation sections, rendered as-is in the center pane)
- Preview atoms: `components/preview/atoms/*Preview.tsx`, each takes `tokens: PreviewTokens` and styles inline from tokens
- Store actions: `set` prefix (`setProjectName`, `setTypography`, `setIconLibrary`)
- CSS: Tailwind utility classes for chrome (use the semantic theme utilities — `bg-app`, `bg-surface`, `text-fg`, `border-line`, `text-status-danger`, `bg-status-success-solid`… — never raw `neutral-*` / `red-*` / `emerald-*`; type via the `text-caption`/`text-body`/`text-ui`… roles, not `text-[Npx]`). Preview atoms + type specimens are the deliberate exceptions: they use inline `style` / literal px from resolved tokens.
- Animations: Framer Motion (`motion.div`, `AnimatePresence`) for transitions between states
- No `console.log` in production code
- TypeScript strict mode — no `any` unless absolutely necessary

### Colour layer — non-negotiables

> These exist because the codebase used to carry two independent implementations
> of WCAG contrast. It now carries one, and these rules are enforced by
> `src/lib/__tests__/no-duplication.test.ts` rather than by memory.

- **One contrast implementation.** The WCAG and APCA formulas live in
  `lib/color/apca.ts` and nowhere else. `colorUtils.checkContrast` is an alias
  for `wcagRatio`, not a second implementation. **Never reintroduce
  `chroma.contrast` for hex strings.**
- **Two `chroma.contrast` call sites survive on purpose** — inside
  `lightnessForContrast`'s bisection and `readableAccent`, where the input is an
  un-quantised `chroma.Color`, not an emitted token. Both are annotated
  `CONTINUOUS-PRECISION`, and the guard test **fails on any unannotated one**.
  If you add a call site, either route it through `checkContrast` or annotate it.
- **Report both metrics.** WCAG 2.1 is the compliance floor; APCA `Lc` is what
  users perceive. A pair that clears one and fails the other is a finding, not a
  rounding difference — 26 % of role pairs are in exactly that bucket today.
- **APCA is directional**: `apcaLc(foreground, background)`. WCAG is symmetric.
- **Never emit a colour by clipping.** Use `gamut.oklchToHex`, not
  `chroma.oklch(l,c,h).hex()` — per-channel clipping shifts hue by up to 10° and
  lightness by 0.06 on out-of-gamut steps.
- **Every semantic role declares an intent class** (`body-text`, `large-text`,
  `ui-component`, `decorative`, `surface`). A role without one cannot be audited.
- **The colour layer is DOM-free.** If something needs jsdom to compute a colour,
  it has a dependency it should not have.
- **`it.fails` marks a known defect**, not a broken test. It passes while the
  defect exists and fails the moment it is fixed — at which point delete the
  `.fails` and the assertion becomes a permanent guarantee.
- **Ramp output is snapshot-pinned.** Any change to `buildScale` or its inputs
  moves `__snapshots__/ramps.golden.test.ts.snap`. Do not run `vitest -u`
  reflexively: read the diff, confirm it is the change you intended, and say so
  in the commit message.
- **One sRGB transfer function.** `gamut.hexToLinearRgb` is it. Anything working
  in linear light (CVD simulation, compositing, luminance) borrows it. A second
  decode would let a palette pass the CVD gate and fail the contrast audit on
  the same hexes; the guard test fails on the constants.
- **Never eyeball a categorical palette.** Run `cvd.validateCategorical()`.
  Evenly spaced hues look obviously distinct in review and still collapse under
  a deutan simulation — that is exactly how `--chart-1…5` was nearly shipped
  wrong. CVD ΔE ≥ 8 is the target; 6–8 is legal ONLY with a second encoding.
- **Vendor architectures match their published contract, not a resemblance of
  it.** Carbon's layer model, shadcn's variable list, Astryx's token groups —
  each is asserted by its own test file. A missing token in a published contract
  is a defect, not a scope decision.
- **`*Reference.ts` files are GENERATED.** Regenerate with `npm run gen:*`;
  never hand-edit. Each has a test asserting the committed file reproduces
  byte-for-byte from the installed package.
- **Never restate a union that already exists.** `PreviewTokens.architecture`
  hand-copied `SemanticArchitecture` and fell a member behind when Carbon
  landed — invisible to 269 passing tests. Import the type.
- **`npm run build` typechecks the tests too.** `tsc -b` runs `tsconfig.test.json`
  alongside the app. A green `npm test` proves nothing about types — vitest
  transpiles without checking.

> **Scrollbars are thin and hover-revealed, APP-WIDE — a `*` rule in `index.css`, not a
> per-panel opt-in.** Used to be `.scrollbar-thin`, applied to exactly two call sites
> (`TokenDetailsModal`'s 360px dialog); every other `overflow-y-auto` — the 198px family
> rail, every railed table's own scroll body, the whole center column — rendered the OS
> default (14–17px, opaque), which is as wide as a token swatch in a dense editor screen.
> Reported as "la barra de scroll está muy gorda." Fixed at the system, not the instance,
> per this file's own rule for that.
> - **Invisible at rest, thumb fades in on hover** (`transition: background 0.15s ease-out`
>   on the WebKit thumb; Firefox's `scrollbar-color` has no separate thumb pseudo-element to
>   transition, so it snaps, revealed by hovering the scrollable region). A permanently
>   visible thin line still reads as one more border in a screen already dense with them —
>   fading it in is what keeps a table's own borders the only lines that are always there.
>   Verified: `getComputedStyle(nav).scrollbarColor` reads `transparent transparent` at
>   rest and `rgb(64,64,64) transparent` (`--line-strong`, dark theme) while hovered.
> - **`:hover` alone, no scrolling-state detection** — this project is desktop/laptop only
>   (see the top of this file), so there's no touch-scroll case needing a different trigger.
> - **`.scrollbar-thin` still exists and still works** — every element `*` matches includes
>   it, so it's now a harmless synonym for the default rather than a second behaviour. Don't
>   remove it; the two call sites that reference it by name still read as intentional.
> - **6px, matching the pre-existing value** — not invented fresh, so nothing that already
>   measured against the old `.scrollbar-thin` (like `PANEL_W` above) needed re-checking.

---

## Deploy

```bash
# Configurator
cd ~/sync-ds-platform/escala-tokens
npm test               # 161 assertions + 4 documented defects — run BEFORE build
npm run color:report   # optional: contrast audit → reports/color-audit.json
npm run build          # verify
npx vercel --prod      # deploy

# Plugin (after code changes)
cd ~/sync-ds-platform/escala-figma-plugin
npm run build          # outputs dist/code.js + dist/ui.html
# Reload in Figma: Plugins → Development → Escala DS → ⟳

# Refresh the downloadable plugin zip served by "Bring to Figma"
cd ~/sync-ds-platform/escala-tokens
npm run bundle:plugin  # → public/escala-figma-plugin.zip + src/lib/pluginVersion.ts (commit both; Vercel only builds this repo)
```

---

## What's next (backlog)

- [x] Components: live component previews rendered with user tokens (starter set: buttons, input, badge, toggle, sign-up card — extend `preview/atoms/` with more)
- [x] Export: "Bring to Figma" — downloadable plugin zip + guided install (`FigmaDownloadView`) + explicit publish to `/api/tokens` with persistent in-flight feedback (`FigmaSyncView`), surfaced through Workspace settings' Figma row
- [x] Export: "Save to GitHub" — PAT connect, repo pick/create, push tokens+css+README (`GitHubConnectView` + `lib/github.ts`)
- [x] Foundations: Opacity / Shadow / Grid / Sizes token tables (`TokenTable` + Step6–9)
- [x] Color: custom named color families with auto 1–12 scales (`customColors`)
- [x] Semantic: multi-theme matrix (`themes`/`themeOrder`/`themeKinds`, "+ Theme" duplicates an existing one)
- [x] Home: onboarding view — name/description, connection status, share endpoint
- [x] Icons: live Iconify browser per library + sanitized custom SVG upload (`customIcons`)
- [x] Gradients: `Foundations · Gradients` — named linear/radial gradients with a rich HSV `ColorField` picker (opacity + hex + saved swatches), assignable to card covers + avatars, exported as tokens (`gradients` + `--gradient-*` + README)
- [ ] GitHub: OAuth App flow (popup + serverless token exchange) to replace the manual PAT
- [x] Semantic: `themePalettes` (per-theme ramps) retired for `themeSources` (per-theme
      family references) — store v39 migrates old palettes into real Primitives families
- [ ] Semantic: surface custom color families as token sources (needs per-family role generation in Step3)
- [ ] Plugin: import `icons.custom` SVGs as Figma components; import extra `colors.themes` as Variable modes
- [ ] Plugin: consume the new `gradients` map (e.g. Figma gradient paint styles / variables) — the configurator emits it but the plugin ignores it for now
- [ ] Gradients: surface the `ColorField` picker in `ColorSelect`'s custom row + more assignable targets (brand sections, page background)
- [ ] Plugin: publish to Figma Community → replace the zip download with a one-click "Open in Figma" deep link
- [ ] Preview: independent per-theme token preview (render atoms from any `themes[key]`) instead of driving the global theme
- [ ] Components: "Copy usage snippet" button per component
- [ ] Export: Generate per-component CSS with token references
- [ ] Plugin: TextStyle creation for typography tokens
- [ ] Plugin: Two-way sync — read Figma Variables → update configurator
- [ ] Plugin: Diff view before import (show what changed)
