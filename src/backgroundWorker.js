import "./backgroundMain.js";
import { GameState } from "./core/gameState.js";
import { PlacementEngine } from "./core/placementEngine.js";
import { RobberEngine } from "./core/robberEngine.js";
import { ResourceTracker } from "./core/resourceTracker.js";
import { parseInboundMessage } from "./core/eventParser.js";

const gameState = new GameState();
const placementEngine = new PlacementEngine();
const robberEngine = new RobberEngine();
const resourceTracker = new ResourceTracker();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "COLONIST_SOCKET_MESSAGE") {
    let events = [];

    try {
      events = parseInboundMessage(message.payload);
      for (const event of events) {
        resourceTracker.applyEvent(event, gameState);
      }
    } catch (error) {
      sendResponse({ ok: false, eventsProcessed: 0, error: String(error?.message || error) });
      return true;
    }

    broadcastEvaluation(sender?.tab?.id);
    sendResponse({ ok: true, eventsProcessed: events.length });
    return true;
  }

  if (message?.type === "REQUEST_STATE") {
    sendResponse(buildOverlayPayload());
    return true;
  }

  return false;
});

function broadcastEvaluation(tabId) {
  if (!tabId) return;

  chrome.tabs.sendMessage(tabId, {
    type: "OVERLAY_DATA",
    payload: buildOverlayPayload()
  });
}

function buildOverlayPayload() {
  const perspectivePlayerId = pickPerspectivePlayerId();
  const placement = gameState.isSetupPhase()
    ? placementEngine.evaluate(gameState, perspectivePlayerId)
    : { rankedVertices: [], rankedPairs: [], suggestedRoad: null };

  const robber = robberEngine.evaluate(gameState, perspectivePlayerId);

  const players = Array.from(gameState.players.values()).map((player) => ({
    ...player,
    buildOptions: resourceTracker.summarizeBuildOptions(player)
  }));

  return {
    phase: gameState.isSetupPhase() ? "setup" : "main",
    setupTurn: gameState.setupTurn,
    placement,
    robber,
    players,
    robberTileId: gameState.robberTileId,
    lastDiceRoll: gameState.lastDiceRoll
  };
}

function pickPerspectivePlayerId() {
  return gameState.players.keys().next().value || null;
}
