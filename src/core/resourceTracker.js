import { RESOURCE_TYPES } from "./constants.js";

export class ResourceTracker {
  applyEvent(event, state) {
    if (!event?.type) return;

    switch (event.type) {
      case "BOARD_SNAPSHOT":
        state.ingestBoardSnapshot(event.payload);
        break;
      case "PLAYER_JOIN":
        state.ensurePlayer(event.payload.playerId, event.payload.name);
        break;
      case "SETTLEMENT_PLACED":
        state.registerSettlementPlacement(event.payload.playerId, event.payload.vertexId);
        this.adjustResources(event.payload.playerId, {
          brick: -1,
          lumber: -1,
          grain: -1,
          wool: -1
        }, state);
        break;
      case "ROAD_PLACED":
        state.registerRoadPlacement(event.payload.playerId, event.payload.edgeKey);
        this.adjustResources(event.payload.playerId, { brick: -1, lumber: -1 }, state);
        break;
      case "CITY_PLACED":
        state.registerCityUpgrade(event.payload.playerId, event.payload.vertexId);
        this.adjustResources(event.payload.playerId, { grain: -2, ore: -3 }, state);
        break;
      case "DICE_ROLL":
        state.registerDiceRoll(event.payload.value);
        if (event.payload.value !== 7) {
          this.applyIncomeRoll(event.payload.value, state);
        }
        break;
      case "TRADE":
        this.adjustResources(event.payload.fromPlayerId, negate(event.payload.offer), state);
        this.adjustResources(event.payload.toPlayerId, negate(event.payload.request), state);
        this.adjustResources(event.payload.fromPlayerId, event.payload.request, state);
        this.adjustResources(event.payload.toPlayerId, event.payload.offer, state);
        break;
      case "ROBBER_MOVED":
        state.setRobberTile(event.payload.tileId);
        break;
      case "ROBBER_STEAL":
        this.adjustResources(event.payload.fromPlayerId, { [event.payload.resource]: -1 }, state);
        this.adjustResources(event.payload.toPlayerId, { [event.payload.resource]: 1 }, state);
        break;
      case "DEV_CARD_PLAYED":
        this.adjustDevCards(event.payload.playerId, -1, state);
        break;
      case "DEV_CARD_BOUGHT":
        this.adjustDevCards(event.payload.playerId, 1, state);
        this.adjustResources(event.payload.playerId, { grain: -1, wool: -1, ore: -1 }, state);
        break;
      default:
        break;
    }
  }

  applyIncomeRoll(diceValue, state) {
    for (const tile of state.board.tiles.values()) {
      if (tile.token !== diceValue || tile.id === state.robberTileId) continue;
      if (!tile.resource || tile.resource === "desert") continue;

      for (const vertexId of tile.vertices || []) {
        const vertex = state.board.vertices.get(vertexId);
        if (!vertex?.occupant) continue;
        const delta = vertex.occupant.building === "city" ? 2 : 1;
        this.adjustResources(vertex.occupant.playerId, { [tile.resource]: delta }, state);
      }
    }
  }

  adjustResources(playerId, delta, state) {
    if (!delta) return;
    const player = state.ensurePlayer(playerId);

    for (const resource of RESOURCE_TYPES) {
      if (delta[resource] == null) continue;
      player.resourceEstimates[resource] = Math.max(0, player.resourceEstimates[resource] + delta[resource]);
    }
  }

  adjustDevCards(playerId, delta, state) {
    const player = state.ensurePlayer(playerId);
    player.devCardsKnown = Math.max(0, player.devCardsKnown + delta);
  }

  summarizeBuildOptions(player) {
    const r = player.resourceEstimates;
    return {
      road: r.brick >= 1 && r.lumber >= 1,
      settlement: r.brick >= 1 && r.lumber >= 1 && r.grain >= 1 && r.wool >= 1,
      city: r.grain >= 2 && r.ore >= 3,
      devCard: r.grain >= 1 && r.wool >= 1 && r.ore >= 1
    };
  }
}

function negate(resourceBundle) {
  if (!resourceBundle) return null;
  return Object.fromEntries(Object.entries(resourceBundle).map(([key, value]) => [key, -value]));
}
