# 🍌 Nano Banana CLI

Generate images using Gemini 3 Pro Image Preview.

## Install

```bash
npm install
```

## Usage

```bash
node bin/nano-banana.js "a cyberpunk banana"
```

With Discord send:

```bash
node bin/nano-banana.js "a cyberpunk banana" --send
```

## Environment

Create a `.env` file:

```
GOOGLE_API_KEY=your_key
DISCORD_WEBHOOK=your_webhook
```

If `GOOGLE_API_KEY` is not set, a mock 1x1 PNG will be generated for testing.
