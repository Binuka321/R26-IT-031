export class RoutePlanningEngine {
  static generateRoute(start, end, options = {}) {
    const {
      floodZones = [],
      blockedRoads = [],
      routeType = "Safest",
    } = options;

    const bounds = this._buildBounds(start, end, floodZones, blockedRoads);
    const grid = this._buildGrid(bounds, 12);
    const startNode = this._closestNode(grid, start);
    const endNode = this._closestNode(grid, end);

    const algorithm = routeType === "Shortest" ? "Dijkstra" : "A*";
    const path = this._findPath(grid, startNode, endNode, {
      floodZones,
      blockedRoads,
      routeType,
      algorithm,
    });

    const routeCoordinates = [
      [start.latitude, start.longitude],
      ...path.slice(1, -1).map((node) => [node.latitude, node.longitude]),
      [end.latitude, end.longitude],
    ];

    const distance = this._routeDistance(routeCoordinates);
    const safetyScore = this._calculateSafetyScore(
      routeCoordinates,
      floodZones,
      blockedRoads,
    );
    const avgSpeed = routeType === "Shortest" ? 40 : 30;
    const estimatedTimeMinutes = Math.max(1, Math.round((distance / avgSpeed) * 60));
    const hours = Math.floor(estimatedTimeMinutes / 60);
    const minutes = estimatedTimeMinutes % 60;
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return {
      route_coordinates: routeCoordinates,
      waypoints: routeCoordinates.slice(1, -1).map((coord, index) => ({
        latitude: coord[0],
        longitude: coord[1],
        description: `Waypoint ${index + 1}`,
      })),
      distance: Math.round(distance * 100) / 100,
      estimated_time: estimatedTime,
      estimated_time_minutes: estimatedTimeMinutes,
      safety_score: Math.round(safetyScore),
      route_status: this._routeStatus(safetyScore),
      route_type: routeType,
      route_algorithm: algorithm,
      warnings: this._generateWarnings(safetyScore, floodZones, blockedRoads),
    };
  }

  static haversineDistance(lat1, lon1, lat2, lon2) {
    const earthRadiusKm = 6371;
    const dLat = this._toRad(lat2 - lat1);
    const dLon = this._toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this._toRad(lat1)) *
        Math.cos(this._toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  static _findPath(grid, startNode, endNode, options) {
    const distances = new Map();
    const previous = new Map();
    const openSet = new Set([startNode.id]);

    for (const node of grid.nodes) {
      distances.set(node.id, Number.POSITIVE_INFINITY);
    }
    distances.set(startNode.id, 0);

    while (openSet.size > 0) {
      const currentId = this._lowestCostNode(openSet, distances, grid, endNode, options.algorithm);
      const current = grid.nodeMap.get(currentId);

      if (currentId === endNode.id) {
        return this._reconstructPath(previous, current, grid);
      }

      openSet.delete(currentId);

      for (const neighbor of this._neighbors(grid, current)) {
        const weight = this._edgeWeight(current, neighbor, options);
        if (!Number.isFinite(weight)) continue;

        const nextDistance = distances.get(currentId) + weight;
        if (nextDistance < distances.get(neighbor.id)) {
          distances.set(neighbor.id, nextDistance);
          previous.set(neighbor.id, currentId);
          openSet.add(neighbor.id);
        }
      }
    }

    return [startNode, endNode];
  }

  static _lowestCostNode(openSet, distances, grid, endNode, algorithm) {
    let bestId = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const nodeId of openSet) {
      const node = grid.nodeMap.get(nodeId);
      const heuristic =
        algorithm === "A*"
          ? this.haversineDistance(
              node.latitude,
              node.longitude,
              endNode.latitude,
              endNode.longitude,
            )
          : 0;
      const score = distances.get(nodeId) + heuristic;

      if (score < bestScore) {
        bestScore = score;
        bestId = nodeId;
      }
    }

    return bestId;
  }

  static _edgeWeight(from, to, options) {
    const distance = this.haversineDistance(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude,
    );

    if (options.routeType === "Shortest") {
      return distance + this._blockedRoadPenalty(to, options.blockedRoads, true);
    }

    const floodPenalty = this._floodPenalty(to, options.floodZones);
    const blockedPenalty = this._blockedRoadPenalty(to, options.blockedRoads);
    const alternativePenalty = options.routeType === "Alternative" ? this._centerPenalty(to) : 0;

    return distance + floodPenalty + blockedPenalty + alternativePenalty;
  }

  static _floodPenalty(node, floodZones) {
    let penalty = 0;
    for (const zone of floodZones) {
      const radius = Number(zone.radius_km || 2);
      const distance = this.haversineDistance(
        node.latitude,
        node.longitude,
        Number(zone.latitude),
        Number(zone.longitude),
      );
      if (distance <= radius * 0.5) penalty += 50;
      else if (distance <= radius) penalty += 20;
      else if (distance <= radius + 2) penalty += 5;
    }
    return penalty;
  }

  static _blockedRoadPenalty(node, blockedRoads, shortestMode = false) {
    let penalty = 0;
    for (const road of blockedRoads) {
      const distance = this.haversineDistance(
        node.latitude,
        node.longitude,
        Number(road.latitude),
        Number(road.longitude),
      );
      if (distance <= 0.4) return shortestMode ? 100 : Number.POSITIVE_INFINITY;
      if (distance <= 1.5) penalty += shortestMode ? 5 : 25;
    }
    return penalty;
  }

  static _calculateSafetyScore(routeCoordinates, floodZones, blockedRoads) {
    let score = 100;

    for (const coord of routeCoordinates) {
      for (const zone of floodZones) {
        const distance = this.haversineDistance(
          coord[0],
          coord[1],
          Number(zone.latitude),
          Number(zone.longitude),
        );
        const radius = Number(zone.radius_km || 2);
        if (distance <= radius * 0.5) score -= 18;
        else if (distance <= radius) score -= 10;
        else if (distance <= radius + 2) score -= 4;
      }

      for (const road of blockedRoads) {
        const distance = this.haversineDistance(
          coord[0],
          coord[1],
          Number(road.latitude),
          Number(road.longitude),
        );
        if (distance <= 0.5) score -= 25;
        else if (distance <= 1.5) score -= 10;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  static _routeStatus(safetyScore) {
    if (safetyScore < 25) return "Blocked";
    if (safetyScore < 50) return "Alternative";
    return "Active";
  }

  static _generateWarnings(safetyScore, floodZones, blockedRoads) {
    const warnings = [];
    if (safetyScore < 50) warnings.push("Route has safety concerns");
    if (safetyScore < 25) warnings.push("Route may be blocked");
    if (floodZones.length > 0) warnings.push(`${floodZones.length} flood zone(s) considered`);
    if (blockedRoads.length > 0) warnings.push(`${blockedRoads.length} blocked road(s) considered`);
    return warnings;
  }

  static _buildBounds(start, end, floodZones, blockedRoads) {
    const points = [
      start,
      end,
      ...floodZones.map((zone) => ({
        latitude: Number(zone.latitude),
        longitude: Number(zone.longitude),
      })),
      ...blockedRoads.map((road) => ({
        latitude: Number(road.latitude),
        longitude: Number(road.longitude),
      })),
    ].filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const padding = 0.03;

    return {
      minLat: Math.min(...latitudes) - padding,
      maxLat: Math.max(...latitudes) + padding,
      minLng: Math.min(...longitudes) - padding,
      maxLng: Math.max(...longitudes) + padding,
    };
  }

  static _buildGrid(bounds, size) {
    const nodes = [];
    const nodeMap = new Map();
    const latStep = (bounds.maxLat - bounds.minLat) / (size - 1);
    const lngStep = (bounds.maxLng - bounds.minLng) / (size - 1);

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const node = {
          id: `${row}:${col}`,
          row,
          col,
          latitude: bounds.minLat + latStep * row,
          longitude: bounds.minLng + lngStep * col,
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      }
    }

    return { nodes, nodeMap, size };
  }

  static _neighbors(grid, node) {
    const neighbors = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) continue;

        const row = node.row + rowOffset;
        const col = node.col + colOffset;
        if (row < 0 || col < 0 || row >= grid.size || col >= grid.size) continue;

        const neighbor = grid.nodeMap.get(`${row}:${col}`);
        if (neighbor) neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  static _closestNode(grid, point) {
    let closest = grid.nodes[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const node of grid.nodes) {
      const distance = this.haversineDistance(
        point.latitude,
        point.longitude,
        node.latitude,
        node.longitude,
      );
      if (distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    }

    return closest;
  }

  static _reconstructPath(previous, current, grid) {
    const path = [current];
    let currentId = current.id;

    while (previous.has(currentId)) {
      currentId = previous.get(currentId);
      path.unshift(grid.nodeMap.get(currentId));
    }

    return path;
  }

  static _routeDistance(routeCoordinates) {
    let distance = 0;
    for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
      distance += this.haversineDistance(
        routeCoordinates[index][0],
        routeCoordinates[index][1],
        routeCoordinates[index + 1][0],
        routeCoordinates[index + 1][1],
      );
    }
    return distance;
  }

  static _centerPenalty(node) {
    const centerRow = 5.5;
    const centerCol = 5.5;
    const distanceFromCenter = Math.abs(node.row - centerRow) + Math.abs(node.col - centerCol);
    return Math.max(0, 8 - distanceFromCenter);
  }

  static _toRad(degrees) {
    return (degrees * Math.PI) / 180;
  }
}

export default RoutePlanningEngine;
