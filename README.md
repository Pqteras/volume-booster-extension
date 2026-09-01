# Volume Booster

Chrome extension for when 100% is still too quiet. Boosts the current tab up to 670%. Each tab keeps its own level until you close it.

It does not change system volume, and it does not send anything anywhere.

670% is loud. Don't cook your headphones.

## Install from source

You need [Bun](https://bun.sh).

```sh
bun install
bun run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked**
4. Select the `dist` folder

`bun run build` also writes `volume-booster-extension.zip`. That zip has `manifest.json` at the root, which is what the Chrome Web Store expects.

## What it can and can't do

Works on all websites, including cross-origin media CDNs, streaming platforms (YouTube, ASMR/video sites, Netflix, Twitch, Vimeo), iframes, and WebAudio.

Does not work on `chrome://` pages, the Chrome Web Store, or Chrome's internal PDF viewer (Chrome security restrictions).

## How it works

Uses Manifest V3 `chrome.tabCapture` and an Offscreen Document audio engine. When volume is boosted, Chrome captures the tab's mixed output audio stream and feeds it into a Web Audio [GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) in the offscreen document. This avoids cross-origin CORS media restrictions entirely. When volume is set back to 100%, tab capture is released cleanly.

## Permissions

- **storage** — keeps tab volume state in session storage.
- **tabCapture** — captures tab audio output for volume amplification.
- **offscreen** — runs the Web Audio engine in an MV3 offscreen document.

No accounts, no analytics, no network requests. The only stored data is volume and mute state, keyed by tab id, and it never leaves your machine.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run build` | TypeScript + CSS, then zip |
| `bun run typecheck` | `tsc --noEmit` |

## License

[MIT](LICENSE). Use it, fork it, ship it.

Bundled fonts: [Space Grotesk](https://fontsource.org/fonts/space-grotesk) and [DM Mono](https://fontsource.org/fonts/dm-mono) (SIL OFL). Icons: [Font Awesome Free](https://fontawesome.com) (CC BY 4.0 / SIL OFL / MIT).
