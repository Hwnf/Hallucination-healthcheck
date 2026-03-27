# Nano Banana — Product Specification

## Purpose
Nano Banana is a persistent CLI image generation tool built on Google Gemini image models.

## Default Model
models/gemini-3-pro-image-preview

## Authentication
- Uses GOOGLE_API_KEY from .env
- No Vertex / service account required (Ultra skipped for now)

## CLI Interface
Command:

    nano-banana "your prompt here"

Optional flags:

    --send   → Automatically send generated image to Discord

## Behavior
- Calls Gemini 3 Pro Image Preview via Generative Language API
- Receives base64 PNG image
- Decodes and saves to:

    nano-banana/images/

- Filename format:

    <timestamp>-slug.png

## Future Expansion
- Optional model switching (Imagen 4 Ultra via Vertex)
- JSON output mode for agent integration
- Skill wrapper for multi-agent invocation

## Current State
- Image generation working manually
- Discord send working
- CLI not yet finalized
- Next session will build persistent module structure
