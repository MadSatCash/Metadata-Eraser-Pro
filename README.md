# Metadata Eraser Pro

Metadata Eraser Pro is a lightweight Electron desktop app for cleaning image metadata without recompressing the file.

It was built for a very practical reason: some platforms inspect embedded metadata and provenance chunks, then show labels such as AI-generated image. This app helps remove common metadata from JPG and PNG files, including EXIF and non-essential PNG chunks, while preserving image quality because it does not re-encode the pixels.

## What it does

- Removes EXIF metadata from JPG and JPEG images
- Removes non-essential PNG chunks from PNG images
- Preserves the visible image without lossy recompression
- Shows which metadata fields or chunks were removed
- Supports drag and drop
- Includes a simple Spanish and English interface

## Why this can be useful

- Protect privacy before sharing images online
- Remove hidden camera, software, or provenance information
- Clean PNG auxiliary chunks such as text, timestamps, color profile metadata, and EXIF-like blocks
- Reduce the chance of platforms reading embedded provenance markers

Important note: this can help when a platform is relying on embedded metadata, but it does not guarantee that every service will stop labeling an image. Some systems may also use other detection methods.

## Supported formats

- JPG / JPEG
- PNG

## How it works

- JPG files are processed by stripping EXIF data
- PNG files are rebuilt keeping only essential image chunks needed for display
- Cleaned files are saved next to the original using a `_clean_<timestamp>` suffix

## Run locally

Requirements:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

## Project structure

```text
main.js              Electron main process
src/preload.js       Safe bridge between UI and filesystem actions
src/renderer.js      UI logic
src/cleaner.js       Metadata cleaning logic for JPG and PNG
src/index.html       App layout
src/style.css        Styling
```

## Disclaimer

Use this only on images you own or have permission to modify. Always keep the original file if the metadata may still be relevant for archival, legal, or authorship purposes.
