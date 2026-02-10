import { RESOURCE_TYPES, SETUP_TURNS } from "./constants.js";

export class GameState {
  constructor() {
    this.players = new Map();
    this.board = {
      tiles: new Map(),
      vertices: new Map()
    };
    this.setupTurn = 0;
    this.placements = [];
    this.robberTileId = null;
    this.lastDiceRoll = null;
  }

  ingestBoardSnapshot(snapshot) {
    if (!snapshot) return;

    if (Array.isArray(snapshot.tiles)) {
      this.board.tiles.clear();
      for (const tile of snapshot.tiles) {
        this.board.tiles.set(tile.id, {
          id: tile.id,
          resource: tile.resource,
          token: tile.token,
          vertices: tile.vertices || []
        });
      }
    }

    if (Array.isArray(snapshot.vertices)) {
      this.board.vertices.clear();
      for (const vertex of snapshot.vertices) {
        this.board.vertices.set(vertex.id, {
          id: vertex.id,
          adjacentTiles: vertex.adjacentTiles || [],
          neighbors: vertex.neighbors || [],
          occupant: vertex.occupant || null
        });
      }
    }
  }

  ensurePlayer(playerId, playerName = playerId) {
    if (!this.players.has(playerId)) {
      this.players.set(playerId, {
        id: playerId,
        name: playerName,
        resourceEstimates: Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0])),
        incomeRate: Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0])),
        devCardsKnown: 0,
        victoryPoints: 0,
        settlements: [],
        cities: [],
        roads: []
      });
    }

    return this.players.get(playerId);
  }

  isSetupPhase() {
    return this.setupTurn < SETUP_TURNS;
  }

  registerSettlementPlacement(playerId, vertexId) {
    const vertex = this.board.vertices.get(vertexId);
    if (!vertex) return;

    vertex.occupant = {
      playerId,
      building: "settlement"
    };

    const player = this.ensurePlayer(playerId);
    player.settlements.push(vertexId);

    if (this.isSetupPhase()) {
      this.setupTurn += 1;
      this.placements.push({ playerId, vertexId, order: this.setupTurn });
    }

    this.recomputeIncomeRates();
  }

  registerRoadPlacement(playerId, edgeKey) {
    const player = this.ensurePlayer(playerId);
    player.roads.push(edgeKey);
  }

  registerCityUpgrade(playerId, vertexId) {
    const vertex = this.board.vertices.get(vertexId);
    if (!vertex) return;

    vertex.occupant = {
      playerId,
      building: "city"
    };

    const player = this.ensurePlayer(playerId);
    player.cities.push(vertexId);
    player.settlements = player.settlements.filter((id) => id !== vertexId);

    this.recomputeIncomeRates();
  }

  recomputeIncomeRates() {
    for (const player of this.players.values()) {
      player.incomeRate = Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0]));
    }

    for (const vertex of this.board.vertices.values()) {
      if (!vertex.occupant) continue;
      const { playerId, building } = vertex.occupant;
      const player = this.ensurePlayer(playerId);
      const multiplier = building === "city" ? 2 : 1;

      for (const tileId of vertex.adjacentTiles) {
        const tile = this.board.tiles.get(tileId);
        if (!tile || tile.id === this.robberTileId) continue;
        if (!tile.resource || tile.resource === "desert") continue;
        const pipWeight = tokenToWeight(tile.token);
        player.incomeRate[tile.resource] += pipWeight * multiplier;
      }
    }
  }

  setRobberTile(tileId) {
    this.robberTileId = tileId;
    this.recomputeIncomeRates();
  }

  registerDiceRoll(value) {
    this.lastDiceRoll = value;
  }

  toJSON() {
    return {
      setupTurn: this.setupTurn,
      robberTileId: this.robberTileId,
      lastDiceRoll: this.lastDiceRoll,
      players: Array.from(this.players.values()),
      board: {
        tiles: Array.from(this.board.tiles.values()),
        vertices: Array.from(this.board.vertices.values())
      },
      placements: this.placements
    };
  }
}

function tokenToWeight(token) {
  const values = {
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    8: 5,
    9: 4,
    10: 3,
    11: 2,
    12: 1
  };

  return values[token] || 0;
}
