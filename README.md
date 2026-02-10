# Catan Helper (Colonist.io Chrome Extension)

A Manifest V3 Chrome extension scaffold for a **read-only strategic analytics overlay** on Colonist.io.

## What this prototype includes

- **WebSocket event interception (read-only):** content script injects a page hook that mirrors inbound socket messages to the extension runtime.
- **Internal game-state model:** tracks board geometry, placements, robber tile, inferred resources, and player income rates.
- **Early-game settlement engine:** ranks setup vertices and settlement pairs with snake-order awareness, scarcity modeling, expansion potential, and road-direction hints.
- **Robber recommendation engine:** ranks robber targets by blocked production, opponent threat, and estimated steal utility.
- **Resource I/O tracker:** consumes normalized events for dice rolls, trades, builds, dev cards, robber movement, and steals.
- **In-page overlay:** shows top setup picks, best pair, road direction, robber target, and player build capability estimates.
- **Draggable UI:** drag the overlay by its handle and keep it out of the way during gameplay.

## Folder layout

```txt
manifest.json
src/
  background.js
  backgroundWorker.js
  backgroundMain.js
  content/
    contentScript.js
    overlayRuntime.js
    runtimeCore.js
    pageHook.js
  core/
    constants.js
    eventParser.js
    gameState.js
    placementEngine.js
    resourceTracker.js
    robberEngine.js
  ui/
    overlay.css
```

## Load locally in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository root (`Catan-Helper`).
5. Open Colonist.io and start a game.

## Important notes for Colonist integration

- The event parser (`src/core/eventParser.js`) currently contains a generalized message mapping.
- You should inspect real Colonist payloads and map exact message schemas to normalized events.
- The extension never modifies outgoing traffic or server messages.

## Suggested next steps

1. Capture and catalog real Colonist websocket events.
2. Expand parser coverage (development card subtypes, maritime trade, monopoly/year of plenty, etc.).
3. Add confidence scoring around hidden information inference.
4. Add persisted game logs for post-game analysis.
5. Add unit tests for engines and parser mappings.


## If you still see stale service-worker syntax errors

If Chrome keeps showing old errors like `Unexpected identifier 'diagnostics'` or `Unexpected identifier 'Helper'` after a reload, do a hard refresh of the extension install:

1. Go to `chrome://extensions`.
2. Remove **Catan Helper Overlay**.
3. Click **Load unpacked** and select this repo root again.
4. Confirm the version is `0.1.4` in the extension card details.

This forces Chrome to register the latest worker entrypoint (`src/backgroundMain.js`) instead of stale cached worker code.

After reinstalling the extension, close any already-open Colonist tabs and open a fresh tab before testing. This avoids running a page that still has old injected content scripts in memory.
