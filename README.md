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

Works on normal websites with `<audio>` / `<video>` (YouTube, etc.), including media inside iframes.

Does not work on `chrome://` pages, the Chrome Web Store, or Chrome's PDF viewer. Chrome simply doesn't let extensions hook those. Local `file://` pages only work if you enable **Allow access to file URLs** on the extension's card in `chrome://extensions`.

Some sites wire their own Web Audio graph. If a page has already taken over an element, this extension can't attach a second gain node to it.

## How it works

A content script inserts a [GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) in front of media elements. The popup talks to a service worker, which stores `{ volume, muted }` per tab in `chrome.storage.session` and pushes it to every frame in that tab. Refreshing keeps the boost; closing the tab (or Chrome) forgets it.

## Permissions

- **storage** — so the boost survives a refresh during the same browser session.
- The content script runs on all URLs, because the whole point is to control whatever tab you're actually watching.

No accounts, no analytics, no network requests. The only stored data is volume and mute state, keyed by tab id, and it never leaves the machine.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run build` | TypeScript + CSS, then zip |
| `bun run typecheck` | `tsc --noEmit` |

## License

[MIT](LICENSE). Use it, fork it, ship it.

Bundled fonts: [Space Grotesk](https://fontsource.org/fonts/space-grotesk) and [DM Mono](https://fontsource.org/fonts/dm-mono) (SIL OFL). Icons: [Font Awesome Free](https://fontawesome.com) (CC BY 4.0 / SIL OFL / MIT).
