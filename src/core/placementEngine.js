import { DICE_WEIGHTS, RESOURCE_TYPES } from "./constants.js";

export class PlacementEngine {
  evaluate(state, perspectivePlayerId) {
    const validVertices = Array.from(state.board.vertices.values()).filter((vertex) => isValidSetupVertex(vertex, state));
    const scarcity = computeScarcityModel(state);

    const ranked = validVertices
      .map((vertex) => {
        const score = this.scoreVertex(vertex, state, perspectivePlayerId, scarcity);
        return {
          vertexId: vertex.id,
          score,
          detail: describeVertex(vertex, state, scarcity)
        };
      })
      .sort((a, b) => b.score - a.score);

    const pairRecommendations = rankSettlementPairs(ranked, state, perspectivePlayerId, scarcity);

    return {
      rankedVertices: ranked,
      rankedPairs: pairRecommendations,
      suggestedRoad: pairRecommendations[0]?.suggestedRoad ?? null
    };
  }

  scoreVertex(vertex, state, perspectivePlayerId, scarcity) {
    const tileScores = vertex.adjacentTiles.map((tileId) => {
      const tile = state.board.tiles.get(tileId);
      if (!tile || tile.resource === "desert") return 0;
      const pip = DICE_WEIGHTS[tile.token] || 0;
      const scarcityBonus = scarcity[tile.resource] || 1;
      return pip * scarcityBonus;
    });

    const productionScore = tileScores.reduce((a, b) => a + b, 0);
    const diversityScore = diversity(vertex, state) * 2.5;
    const expansionScore = expansionPotential(vertex, state) * 1.5;
    const pickOrderScore = snakeOrderModifier(state, perspectivePlayerId);

    return productionScore + diversityScore + expansionScore + pickOrderScore;
  }
}

function computeScarcityModel(state) {
  const counts = Object.fromEntries(RESOURCE_TYPES.map((resource) => [resource, 0]));

  for (const vertex of state.board.vertices.values()) {
    if (!vertex.occupant) continue;
    for (const tileId of vertex.adjacentTiles) {
      const tile = state.board.tiles.get(tileId);
      if (!tile || !counts[tile.resource]) continue;
      counts[tile.resource] += 1;
    }
  }

  return Object.fromEntries(
    RESOURCE_TYPES.map((resource) => {
      const observed = counts[resource];
      return [resource, observed === 0 ? 1.25 : Math.max(0.75, 1.25 - observed * 0.08)];
    })
  );
}

function diversity(vertex, state) {
  const resources = new Set();
  for (const tileId of vertex.adjacentTiles) {
    const tile = state.board.tiles.get(tileId);
    if (tile && tile.resource && tile.resource !== "desert") {
      resources.add(tile.resource);
    }
  }
  return resources.size;
}

function expansionPotential(vertex, state) {
  return vertex.neighbors.reduce((acc, neighborId) => {
    const neighbor = state.board.vertices.get(neighborId);
    if (!neighbor || neighbor.occupant) return acc;
    const blocked = neighbor.neighbors.some((nextId) => {
      const next = state.board.vertices.get(nextId);
      return next?.occupant;
    });
    return acc + (blocked ? 0.2 : 1);
  }, 0);
}

function snakeOrderModifier(state, perspectivePlayerId) {
  const playerCount = state.players.size || 4;
  const setupTurn = state.setupTurn;
  if (setupTurn < playerCount) {
    return 1;
  }

  const reverseTurn = setupTurn - playerCount;
  const projectedSecondPick = playerCount - reverseTurn;
  return projectedSecondPick <= 2 ? 2.5 : 0.5 + (perspectivePlayerId ? 0.2 : 0);
}

function isValidSetupVertex(vertex, state) {
  if (vertex.occupant) return false;
  return !vertex.neighbors.some((neighborId) => state.board.vertices.get(neighborId)?.occupant);
}

function describeVertex(vertex, state, scarcity) {
  const resources = vertex.adjacentTiles
    .map((tileId) => state.board.tiles.get(tileId))
    .filter(Boolean)
    .map((tile) => `${tile.resource}:${tile.token}x${(scarcity[tile.resource] || 1).toFixed(2)}`);

  return resources.join(", ");
}

function rankSettlementPairs(rankedVertices, state, perspectivePlayerId, scarcity) {
  const top = rankedVertices.slice(0, 12);
  const pairs = [];

  for (let i = 0; i < top.length; i += 1) {
    for (let j = i + 1; j < top.length; j += 1) {
      const a = state.board.vertices.get(top[i].vertexId);
      const b = state.board.vertices.get(top[j].vertexId);
      if (!a || !b) continue;
      if (a.neighbors.includes(b.id) || b.neighbors.includes(a.id)) continue;

      const resourceCoverage = pairResourceCoverage(a, b, state);
      const comboScore = top[i].score + top[j].score + resourceCoverage * 3;

      pairs.push({
        first: top[i].vertexId,
        second: top[j].vertexId,
        score: comboScore,
        suggestedRoad: suggestRoadDirection(a, b, state, perspectivePlayerId, scarcity)
      });
    }
  }

  return pairs.sort((x, y) => y.score - x.score).slice(0, 8);
}

function pairResourceCoverage(a, b, state) {
  const resources = new Set();
  for (const vertex of [a, b]) {
    for (const tileId of vertex.adjacentTiles) {
      const tile = state.board.tiles.get(tileId);
      if (tile && tile.resource !== "desert") resources.add(tile.resource);
    }
  }
  return resources.size;
}

function suggestRoadDirection(firstVertex, secondVertex, state) {
  const pivot = firstVertex.neighbors
    .map((id) => state.board.vertices.get(id))
    .filter(Boolean)
    .filter((v) => !v.occupant)
    .sort((a, b) => expansionPotential(b, state) - expansionPotential(a, state))[0];

  if (!pivot) {
    return null;
  }

  return {
    from: firstVertex.id,
    to: pivot.id,
    rationale: `Road extends toward high-access corridor (target ${pivot.id}) while preserving reach to ${secondVertex.id}.`
  };
}
