# Podcastr

Podcastr is an open-source desktop app for generating, storing, and listening to AI-made podcast episodes.

It is built around a simple idea: give the user a topic, ground the model with current web research, generate a long-form script, turn that script into speech, and store the finished episode locally on the device.

The app is intentionally local-first. Episodes, settings, transcripts, and generated assets are saved on the user’s machine. When web search is enabled, Podcastr uses live sources to keep episode grounding current instead of relying only on model memory.

## What it does

- Collects topic preferences during onboarding
- Lets users configure OpenAI and Exa API keys in settings
- Generates podcast scripts with a multi-step writing pipeline
- Uses web research to ground the script in recent sources
- Renders voice audio to disk for later playback
- Generates consistent episode artwork
- Stores episode metadata in SQLite through Tauri
- Shows full episode pages with transcript, research context, and source cards

## Why it exists

Most AI audio demos feel like summaries, not episodes. Podcastr is trying to get closer to a real hosted show:

- longer scripts
- a clearer episode shape
- intro and conclusion segments
- web-grounded details
- line-by-line transcript playback
- reusable source references for deeper reading

The goal is not to make AI sound impressive. The goal is to make the episode feel human enough that someone would actually want to listen to it.

## Stack

- React
- Vite
- Bun
- Tauri v2
- SQLite
- OpenAI for script, speech, and image generation
- Exa for web search and current research
- shadcn/ui for the interface primitives

## Getting started

### Prerequisites

- Bun
- Rust toolchain
- Tauri system dependencies for your platform

### Install

```bash
bun install
```

### Run in development

```bash
bun run start
```

This starts the Tauri desktop app.

To run the Vite frontend only:

```bash
bun run dev
```

### Build

```bash
bun run build
```

## API keys

Podcastr can read keys from the app settings or from environment variables.

Required for generation:

- `OPENAI_API_KEY`

Optional for grounded research:

- `EXA_API_KEY`

You can also enter both keys from the app’s Settings screen. The app stores them locally on the user’s machine.

## Data storage

Podcastr stores data locally:

- SQLite database: app settings, onboarding state, and generated episodes
- Generated audio: app-local data directory under `generated-audio/`
- Generated artwork: app-local data directory under `generated-images/`

Nothing is meant to require a server for day-to-day use.

## Episode flow

1. Select topics during onboarding
2. Configure voice, model, and API keys in settings
3. Generate an episode
4. Podcastr searches the web when Exa is enabled
5. The script is written in multiple passes
6. The host voice is rendered to disk
7. Episode art is generated
8. The finished episode appears in the library and can be opened in its own detail page

## Notes

- Podcastr is a desktop app, not a hosted SaaS.
- Episode files are written locally so they survive app restarts.
- The project is open source and intended to be modified.

## License

Add the license that matches your distribution model before publishing releases.
