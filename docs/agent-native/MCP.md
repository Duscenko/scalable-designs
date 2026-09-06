# Escala MCP

Read-only Model Context Protocol endpoint. Does **not** replace `/api/tokens`.

- **Discovery:** `GET /api/mcp`
- **JSON-RPC:** `POST /api/mcp` (`initialize`, `tools/list`, `tools/call`, `ping`)
- **Schema:** `/docs/agent-native/tokens.schema.json` (copy of `docs/agent-native/tokens.schema.json`)
- **Publish/fetch:** still `GET|POST /api/tokens?project=`

## Tools

| Tool | Needs published JSON | Notes |
|---|---|---|
| `get_tokens` | yes | Same payload the plugin fetches |
| `resolve_token` | yes | Catalogue id or Figma slashes → CSS + hex |
| `list_components` | no | Catalogue only |
| `get_component` | no | Props + a11y + Figma sets |
| `list_icons` | yes | `icons.aiSource` + custom names |
| `check_contrast` | no | `lib/color/apca.ts` (`evaluate`) |

## Cursor

```json
{
  "mcpServers": {
    "escala-tokens": {
      "url": "https://escalatokens.com/api/mcp",
      "type": "http"
    }
  }
}
```

Public, no auth (same as `/api/tokens`). CORS `*`. Apex host only — `www.escalatokens.com` fails TLS (certificate SAN is `DNS:escalatokens.com`).

Human install (About / Docs → Use in code / Export wizard): paste the JSON above into `.cursor/mcp.json`, or run `claude mcp add --transport http --scope project escala-tokens https://escalatokens.com/api/mcp`. VS Code uses `.vscode/mcp.json` with key `servers`, not `mcpServers`. `npx @escala/cli mcp init` / `skill --from <slug>` remain as an offline fallback once the package is on npm. Do not invent a second MCP URL. Token tools (`get_tokens`, `resolve_token`, `list_icons`) require `project`.

Implementation: `src/lib/agentAccess/` (pure) + `api/mcp.ts` (Blob read). `src/lib/agentInstall.ts` is the snippet/command builder. `src/lib/cliInstall.ts` is the installer.
