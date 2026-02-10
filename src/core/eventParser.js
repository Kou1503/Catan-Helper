/**
 * Normalizes Colonist websocket payloads into engine events.
 * Tries multiple schema variants and recursively scans nested payloads.
 */
export function parseInboundMessage(rawData) {
  const payload = normalizePayload(rawData);
  if (!payload) return [];

  const candidates = collectCandidates(payload);
  const events = [];

  for (const candidate of candidates) {
    const mapped = mapKnownEvent(candidate);
    if (mapped) events.push(mapped);
  }

  return dedupeEvents(events);
}

function normalizePayload(rawData) {
  if (rawData == null) return null;
  if (typeof rawData === "object") return rawData;
  if (typeof rawData !== "string") return null;

  const trimmed = rawData.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const socketIoPrefix = trimmed.match(/^\d+(\{.*\}|\[.*\])$/s);
    if (socketIoPrefix) {
      try {
        return JSON.parse(socketIoPrefix[1]);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function collectCandidates(root) {
  const out = [];
  const queue = [root];
  const seen = new Set();
  let scans = 0;

  while (queue.length && scans < 1200) {
    scans += 1;
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    out.push(current);

    if (Array.isArray(current)) {
      for (const value of current) queue.push(value);
      continue;
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return out;
}

function mapKnownEvent(message) {
  const typeKey = String(message?.type || message?.event || message?.action || message?.name || "").toUpperCase();

  if (looksLikeBoardSnapshot(message)) {
    return { type: "BOARD_SNAPSHOT", payload: extractBoardSnapshot(message) };
  }

  if (typeKey.includes("PLAYER") && (typeKey.includes("JOIN") || typeKey.includes("ADD"))) {
    const playerId = message.playerId ?? message.id ?? message.player?.id;
    const name = message.name ?? message.playerName ?? message.player?.name ?? playerId;
    if (playerId != null) {
      return { type: "PLAYER_JOIN", payload: { playerId, name } };
    }
  }

  if (typeKey.includes("DICE") || typeKey.includes("ROLL")) {
    const value = Number(message.value ?? message.roll ?? message.dice ?? message.number ?? message.payload?.value);
    if (Number.isFinite(value)) {
      return { type: "DICE_ROLL", payload: { value } };
    }
  }

  if (typeKey.includes("SETTLEMENT") && (typeKey.includes("PLACE") || typeKey.includes("BUILD"))) {
    const playerId = message.playerId ?? message.player?.id ?? message.ownerId;
    const vertexId = message.vertexId ?? message.nodeId ?? message.vertex ?? message.location;
    if (playerId != null && vertexId != null) {
      return { type: "SETTLEMENT_PLACED", payload: { playerId, vertexId } };
    }
  }

  if (typeKey.includes("CITY") && (typeKey.includes("PLACE") || typeKey.includes("BUILD") || typeKey.includes("UPGRADE"))) {
    const playerId = message.playerId ?? message.player?.id ?? message.ownerId;
    const vertexId = message.vertexId ?? message.nodeId ?? message.vertex ?? message.location;
    if (playerId != null && vertexId != null) {
      return { type: "CITY_PLACED", payload: { playerId, vertexId } };
    }
  }

  if (typeKey.includes("ROAD") && (typeKey.includes("PLACE") || typeKey.includes("BUILD"))) {
    const playerId = message.playerId ?? message.player?.id ?? message.ownerId;
    const edgeKey = message.edgeKey ?? message.edgeId ?? message.roadId ?? message.edge;
    if (playerId != null && edgeKey != null) {
      return { type: "ROAD_PLACED", payload: { playerId, edgeKey } };
    }
  }

  if (typeKey.includes("TRADE")) {
    const fromPlayerId = message.fromPlayerId ?? message.from ?? message.traderA;
    const toPlayerId = message.toPlayerId ?? message.to ?? message.traderB;
    const offer = message.offer ?? message.give ?? message.offerResources;
    const request = message.request ?? message.receive ?? message.requestResources;
    if (fromPlayerId != null && toPlayerId != null && offer && request) {
      return { type: "TRADE", payload: { fromPlayerId, toPlayerId, offer, request } };
    }
  }

  if (typeKey.includes("ROBBER") && (typeKey.includes("MOVE") || typeKey.includes("PLACED") || typeKey.includes("SET"))) {
    const tileId = message.tileId ?? message.hexId ?? message.tile ?? message.location;
    if (tileId != null) {
      return { type: "ROBBER_MOVED", payload: { tileId } };
    }
  }

  if (typeKey.includes("STEAL") || (typeKey.includes("ROBBER") && typeKey.includes("CARD"))) {
    const fromPlayerId = message.fromPlayerId ?? message.victimId ?? message.from;
    const toPlayerId = message.toPlayerId ?? message.thiefId ?? message.to;
    const resource = message.resource ?? message.cardType;
    if (fromPlayerId != null && toPlayerId != null && resource) {
      return { type: "ROBBER_STEAL", payload: { fromPlayerId, toPlayerId, resource } };
    }
  }

  if (typeKey.includes("DEV") && typeKey.includes("BOUGHT")) {
    const playerId = message.playerId ?? message.player?.id;
    if (playerId != null) return { type: "DEV_CARD_BOUGHT", payload: { playerId } };
  }

  if (typeKey.includes("DEV") && typeKey.includes("PLAY")) {
    const playerId = message.playerId ?? message.player?.id;
    if (playerId != null) return { type: "DEV_CARD_PLAYED", payload: { playerId } };
 * Supports generic fallback and can be extended with concrete schema mappings.
 */
export function parseInboundMessage(rawData) {
  let payload = rawData;

  try {
    payload = JSON.parse(rawData);
  } catch {
    return [];
  }

  if (!payload) return [];

  if (Array.isArray(payload.events)) {
    return payload.events.map(mapKnownEvent).filter(Boolean);
  }

  const mapped = mapKnownEvent(payload);
  return mapped ? [mapped] : [];
}

function mapKnownEvent(message) {
  if (!message?.type) return null;

  const t = message.type.toUpperCase();
  if (t === "DICE_ROLL") {
    return { type: "DICE_ROLL", payload: { value: message.value } };
  }
  if (t === "SETTLEMENT_PLACED") {
    return {
      type: "SETTLEMENT_PLACED",
      payload: { playerId: message.playerId, vertexId: message.vertexId }
    };
  }
  if (t === "ROAD_PLACED") {
    return {
      type: "ROAD_PLACED",
      payload: { playerId: message.playerId, edgeKey: message.edgeKey }
    };
  }
  if (t === "CITY_PLACED") {
    return {
      type: "CITY_PLACED",
      payload: { playerId: message.playerId, vertexId: message.vertexId }
    };
  }
  if (t === "BOARD_SNAPSHOT") {
    return { type: "BOARD_SNAPSHOT", payload: message.board };
  }
  if (t === "PLAYER_JOIN") {
    return {
      type: "PLAYER_JOIN",
      payload: { playerId: message.playerId, name: message.name }
    };
  }
  if (t === "TRADE") {
    return {
      type: "TRADE",
      payload: {
        fromPlayerId: message.fromPlayerId,
        toPlayerId: message.toPlayerId,
        offer: message.offer,
        request: message.request
      }
    };
  }
  if (t === "ROBBER_MOVED") {
    return { type: "ROBBER_MOVED", payload: { tileId: message.tileId } };
  }
  if (t === "ROBBER_STEAL") {
    return {
      type: "ROBBER_STEAL",
      payload: {
        fromPlayerId: message.fromPlayerId,
        toPlayerId: message.toPlayerId,
        resource: message.resource
      }
    };
  }
  if (t === "DEV_CARD_PLAYED") {
    return { type: "DEV_CARD_PLAYED", payload: { playerId: message.playerId } };
  }
  if (t === "DEV_CARD_BOUGHT") {
    return { type: "DEV_CARD_BOUGHT", payload: { playerId: message.playerId } };
  }

  return null;
}

function looksLikeBoardSnapshot(message) {
  const board = message?.board ?? message?.payload?.board ?? message?.game?.board ?? message;
  if (!board || typeof board !== "object") return false;

  const hasTiles = Array.isArray(board.tiles) || Array.isArray(board.hexes);
  const hasVertices = Array.isArray(board.vertices) || Array.isArray(board.nodes);

  return hasTiles && hasVertices;
}

function extractBoardSnapshot(message) {
  const board = message?.board ?? message?.payload?.board ?? message?.game?.board ?? message;

  const rawTiles = Array.isArray(board.tiles) ? board.tiles : board.hexes || [];
  const rawVertices = Array.isArray(board.vertices) ? board.vertices : board.nodes || [];

  const tiles = rawTiles
    .map((tile, index) => ({
      id: tile.id ?? tile.tileId ?? tile.hexId ?? index,
      resource: tile.resource ?? tile.resourceType ?? tile.type ?? "desert",
      token: Number(tile.token ?? tile.number ?? tile.dice ?? 0),
      vertices: tile.vertices ?? tile.vertexIds ?? tile.nodes ?? []
    }))
    .filter((tile) => tile.id != null);

  const vertices = rawVertices
    .map((vertex, index) => ({
      id: vertex.id ?? vertex.vertexId ?? vertex.nodeId ?? index,
      adjacentTiles: vertex.adjacentTiles ?? vertex.tiles ?? vertex.hexes ?? [],
      neighbors: vertex.neighbors ?? vertex.adjacentVertices ?? vertex.links ?? [],
      occupant: normalizeOccupant(vertex.occupant ?? vertex.building ?? vertex.owner)
    }))
    .filter((vertex) => vertex.id != null);

  return { tiles, vertices };
}

function normalizeOccupant(raw) {
  if (!raw) return null;
  if (typeof raw !== "object") return null;

  const playerId = raw.playerId ?? raw.ownerId ?? raw.player ?? raw.id;
  if (playerId == null) return null;

  const buildingRaw = String(raw.building ?? raw.type ?? raw.kind ?? "settlement").toLowerCase();
  const building = buildingRaw.includes("city") ? "city" : "settlement";

  return { playerId, building };
}

function dedupeEvents(events) {
  const seen = new Set();
  const out = [];

  for (const event of events) {
    const key = `${event.type}:${JSON.stringify(event.payload)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }

  return out;
}
