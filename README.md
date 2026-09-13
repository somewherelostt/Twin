# Twin

Twin is a desktop voice interface for writing and acting across your computer. Dictation turns natural speech into clean text. Action mode uses connected apps to carry out reviewable work from one command.

## Initial integrations

- Slack
- Jira
- Gmail
- GitHub

## Stack

- Electron, React, TypeScript, and Vite
- AssemblyAI Dictation API
- OpenAI Responses API
- Composio Tool Router

## Development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The application opens with `Alt+Space`. API credentials stay in the Electron main process and are never exposed to the renderer.
