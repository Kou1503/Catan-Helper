import { DICE_WEIGHTS } from "./constants.js";

export class RobberEngine {
  evaluate(state, perspectivePlayerId) {
    const opponents = Array.from(state.players.values()).filter((player) => player.id !== perspectivePlayerId);

    const tileScores = Array.from(state.board.tiles.values())
      .filter((tile) => tile.resource && tile.resource !== "desert" && tile.id !== state.robberTileId)
      .filter((tile) => hasOpponentVictim(tile, state, perspectivePlayerId))
      .map((tile) => {
        const productionBlocked = blockedProduction(tile, state, perspectivePlayerId);
        const threatBlocked = blockedThreat(tile, opponents);
        const stealGain = expectedStealValue(tile, state, perspectivePlayerId);

        return {
          tileId: tile.id,
          resource: tile.resource,
          token: tile.token,
          score: productionBlocked * 0.45 + threatBlocked * 0.35 + stealGain * 0.2,
          productionBlocked,
          threatBlocked,
          stealGain
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      bestTile: tileScores[0] || null,
      rankings: tileScores.slice(0, 10)
    };
  }
}

function hasOpponentVictim(tile, state, perspectivePlayerId) {
  return (tile.vertices || []).some((vertexId) => {
    const occupant = state.board.vertices.get(vertexId)?.occupant;
    return occupant && occupant.playerId !== perspectivePlayerId;
  });
}

function blockedProduction(tile, state, perspectivePlayerId) {
  const weight = DICE_WEIGHTS[tile.token] || 0;
  let aggregate = 0;

  for (const vertexId of tile.vertices || []) {
    const vertex = state.board.vertices.get(vertexId);
    if (!vertex?.occupant || vertex.occupant.playerId === perspectivePlayerId) continue;
    aggregate += weight * (vertex.occupant.building === "city" ? 2 : 1);
  }

  return aggregate;
}

function blockedThreat(tile, opponents) {
  const occupiedBy = opponents.filter((player) =>
    [...player.settlements, ...player.cities].some((vertexId) => (tile.vertices || []).includes(vertexId))
  );

  return occupiedBy.reduce((acc, player) => {
    const economy = Object.values(player.incomeRate).reduce((a, b) => a + b, 0);
    return acc + economy + player.victoryPoints * 3 + player.devCardsKnown * 2;
  }, 0);
}

function expectedStealValue(tile, state, perspectivePlayerId) {
  let bestTargetValue = 0;

  for (const vertexId of tile.vertices || []) {
    const vertex = state.board.vertices.get(vertexId);
    if (!vertex?.occupant || vertex.occupant.playerId === perspectivePlayerId) continue;

    const player = state.players.get(vertex.occupant.playerId);
    if (!player) continue;

    const pool = Object.entries(player.resourceEstimates).filter(([, count]) => count > 0);
    const total = pool.reduce((acc, [, count]) => acc + count, 0);
    if (total === 0) continue;

    const usefulWeight = pool.reduce((acc, [resource, count]) => {
      const usefulness = resource === "ore" || resource === "grain" ? 1.2 : 1;
      return acc + count * usefulness;
    }, 0);

    bestTargetValue = Math.max(bestTargetValue, usefulWeight / total);
  }

  return bestTargetValue;
}
