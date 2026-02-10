/**
 * Normalizes Colonist websocket payloads into engine events.
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
