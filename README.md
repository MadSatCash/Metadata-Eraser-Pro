# Metadata Eraser Pro

Metadata Eraser Pro is a fast desktop app for cleaning hidden metadata from JPG and PNG images without recompressing their pixels.

## Download for Windows

The ready-to-run **Windows Portable edition** is available from the [official releases page](https://github.com/MadSatCash/Metadata-Eraser-Pro/releases/latest). It needs no installer and includes the desktop runtime.

If the app saves you time, the suggested Supporter Edition price is **USD 20 equivalent in Bitcoin Cash**. The source remains free and the download is intentionally honor-based: supporters pay for the convenient build and continued maintenance, not for secret code.

[Get the Supporter Edition or contribute](https://madsatcash.github.io/Metadata-Eraser-Pro/)

Released executables are not Authenticode-signed. Windows may show an unknown-publisher warning. Verify the file against `SHA256SUMS.txt` on the release page before running it.

## What it does

- Removes EXIF, XMP, Photoshop/IPTC, comments, C2PA/JUMBF and other non-essential metadata from JPG/JPEG images
- Removes non-essential PNG chunks, including text, timestamps, EXIF-like data and C2PA blocks
- Preserves the original compressed JPEG image data and avoids lossy pixel recompression
- Preserves technical color blocks in JPEG when they may be required for correct rendering
- Shows which metadata fields or chunks were removed
- Saves a new cleaned copy next to the original; the original is not overwritten
- Supports drag and drop and batch selection
- Includes Spanish and English interfaces
- Processes images locally; images are never uploaded by the app

## Why this can be useful

- Protect privacy before sharing images online
- Remove hidden camera, GPS, software, authorship or provenance information
- Clean images before posting, sharing, archiving or reusing them
- Reduce the chance of a platform reading embedded provenance markers

Important: removing embedded metadata does not guarantee that a platform will stop labeling or classifying an image. Services can use signals that are not stored inside the file.

## Supported formats

- JPG / JPEG
- PNG

## How it works

- JPEG segments containing non-essential metadata are removed while the compressed image stream is verified byte-for-byte
- PNG files are rebuilt from essential display chunks
- Cleaned files use a `_clean_<timestamp>` suffix
- Output is first written to a temporary file and then renamed atomically

## Run from source

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm test
npm start
```

## Project structure

```text
main.js              Electron main process
src/preload.js       Safe bridge between UI and filesystem actions
src/renderer.js      UI logic
src/cleaner.js       Metadata cleaning logic for JPG and PNG
tests/cleaner.test.js Lossless regression tests
```

## License and disclaimer

The source is available under the [ISC License](LICENSE). Selling the ready-to-run build does not restrict the rights granted by that license.

Use this only on images you own or have permission to modify. Keep the original if metadata may be relevant for archival, legal or authorship purposes. The software is provided as-is, without warranty.

