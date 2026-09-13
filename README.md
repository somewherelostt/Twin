<p align="center">
  <img src="public/twin-mark.svg" alt="Twin" width="96" />
</p>

<h1 align="center">Twin</h1>

Twin is a desktop voice interface for writing and acting across your computer. Dictation turns natural speech into clean text. Action mode combines the app on screen with a spoken request, then carries out a reviewable workflow across connected work apps.

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

## How it works

Press `Alt+Space` anywhere to open Twin.

Drag the grip above the composer to place Twin anywhere on screen. Its position is remembered when it is reopened.

- **Dictate** records speech, removes filler words and self-corrections, and pastes clean text into the previous app.
- **Act** captures the screen behind Twin, records the request, and creates a clear action card. Nothing is sent or changed until **Run action** is pressed.
- A single approved action can use several connected apps. Destructive tools and remote code execution are disabled.

## Setup

Install dependencies and start the desktop client:

```bash
pnpm install
pnpm dev
```

Open Settings in Twin and add AssemblyAI, OpenAI, and Composio API keys. Credentials are encrypted with the operating system credential service, stay in the Electron main process, and are never exposed to the renderer. A `.env` file based on `.env.example` can also be used during development.

## Build for Windows

```bash
pnpm package:win
```

The installer is written to `release/Twin Setup 0.1.0.exe`.
