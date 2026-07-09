export class RoutePlanningEngine {
  static generateRoute(start, end, options = {}) {
    const {
      floodZones = [],
      blockedRoads = [],
      routeType = "Safest",
    } = options;

    const bounds = this._buildBounds(start, end, floodZones, blockedRoads);
    // W7 Fix: Adaptive grid resolution — scale to route distance to balance accuracy vs performance
    const roughDistance = this.haversineDistance(start.latitude, start.longitude, end.latitude, end.longitude);
    const gridSize = this._getGridSize(roughDistance);
    const grid = this._buildGrid(bounds, gridSize);
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
    const mobilityPlan = this._buildMobilityPlan(routeCoordinates, floodZones, blockedRoads);

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
      mobility_plan: mobilityPlan,
      safety_score: Math.round(safetyScore),
      emergency_safety_profile: this._buildEmergencySafetyProfile(
        routeCoordinates,
        floodZones,
        blockedRoads,
      ),
      route_status: this._routeStatus(safetyScore),
      route_type: "Safest",
      route_algorithm: algorithm,
      warnings: this._generateWarnings(safetyScore, floodZones, blockedRoads),
      route_source: "grid_fallback",
      accuracy_level: "Estimated",
      accuracy_notes:
        "Estimated route generated from a local grid because verified road-network routing was not available.",
    };
  }

  static assessRoadNetworkRoute(routeCoordinates, options = {}) {
    const { floodZones = [], blockedRoads = [], routeType = "Safest" } = options;
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
    const mobilityPlan = this._buildMobilityPlan(routeCoordinates, floodZones, blockedRoads);

    return {
      distance: Math.round(distance * 100) / 100,
      estimated_time: estimatedTime,
      estimated_time_minutes: estimatedTimeMinutes,
      mobility_plan: mobilityPlan,
      safety_score: Math.round(safetyScore),
      emergency_safety_profile: this._buildEmergencySafetyProfile(
        routeCoordinates,
        floodZones,
        blockedRoads,
      ),
      route_status: this._routeStatus(safetyScore),
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

  /**
   * W7 Fix: Return grid size scaled to route distance.
   * Short routes use a fine grid for precision; long routes use a coarser grid.
   */
  static _getGridSize(distanceKm) {
    if (distanceKm < 5)  return 8;
    if (distanceKm < 20) return 12;
    if (distanceKm < 50) return 16;
    return 20;
  }

  /**
   * W8 Fix: Generate a deterministic, reproducible hash for a set of route criteria.
   * This ensures duplicate route requests for identical start/end/options are cached correctly.
   */
  static buildCriteriaHash(start, end, options = {}) {
    const { floodZones = [], blockedRoads = [], routeType = 'Safest' } = options;
    const floodIds = [...floodZones].map(z => `${+z.latitude.toFixed(4)},${+z.longitude.toFixed(4)}`).sort().join('|');
    const roadIds  = [...blockedRoads].map(r => `${+r.latitude.toFixed(4)},${+r.longitude.toFixed(4)}`).sort().join('|');
    const raw = [
      `${+start.latitude.toFixed(4)},${+start.longitude.toFixed(4)}`,
      `${+end.latitude.toFixed(4)},${+end.longitude.toFixed(4)}`,
      routeType,
      floodIds,
      roadIds,
    ].join('::');
    // Simple, deterministic djb2 hash
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash) + raw.charCodeAt(i);
      hash |= 0; // Convert to 32-bit int
    }
    return Math.abs(hash).toString(36);
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
    if (!routeCoordinates.length) return 0;

    let totalPointRisk = 0;
    let floodCoreHits = 0;
    let blockedRoadCloseHits = 0;

    // Score by average route exposure instead of subtracting once per vertex.
    // OSRM routes can contain many coordinates, so raw cumulative penalties
    // unfairly push long routes to zero even when only a small segment is risky.
    for (const coord of routeCoordinates) {
      let floodPointRisk = 0;
      let roadPointRisk = 0;

      for (const zone of floodZones) {
        const distance = this.haversineDistance(
          coord[0],
          coord[1],
          Number(zone.latitude),
          Number(zone.longitude),
        );
        const radius = Number(zone.radius_km || 2);
        if (distance <= radius * 0.5) {
          floodPointRisk = Math.max(floodPointRisk, 18);
          floodCoreHits += 1;
        } else if (distance <= radius) {
          floodPointRisk = Math.max(floodPointRisk, 10);
        } else if (distance <= radius + 2) {
          floodPointRisk = Math.max(floodPointRisk, 4);
        }
      }

      for (const road of blockedRoads) {
        const distance = this.haversineDistance(
          coord[0],
          coord[1],
          Number(road.latitude),
          Number(road.longitude),
        );
        if (distance <= 0.5) {
          roadPointRisk = Math.max(roadPointRisk, 25);
          blockedRoadCloseHits += 1;
        } else if (distance <= 1.5) {
          roadPointRisk = Math.max(roadPointRisk, 10);
        }
      }

      totalPointRisk += Math.min(35, floodPointRisk + roadPointRisk);
    }

    const pointCount = routeCoordinates.length;
    const averagePointRisk = totalPointRisk / pointCount;
    const floodCoreShare = floodCoreHits / pointCount;
    const blockedRoadCloseShare = blockedRoadCloseHits / pointCount;
    const score =
      100 -
      averagePointRisk * 2 -
      floodCoreShare * 25 -
      blockedRoadCloseShare * 35;

    return Math.max(0, Math.min(100, score));
  }

  static _buildEmergencySafetyProfile(routeCoordinates, floodZones, blockedRoads) {
    const nearestFloodKm = this._nearestHazardDistance(routeCoordinates, floodZones);
    const nearestBlockedRoadKm = this._nearestHazardDistance(routeCoordinates, blockedRoads);
    const floodExposurePoints = this._countExposurePoints(routeCoordinates, floodZones);
    const blockedRoadExposurePoints = this._countExposurePoints(routeCoordinates, blockedRoads, 1.5);
    const riskLevel =
      blockedRoadExposurePoints > 0 || floodExposurePoints >= 3
        ? "High"
        : floodExposurePoints > 0 || nearestFloodKm <= 2 || nearestBlockedRoadKm <= 2
          ? "Moderate"
          : "Low";

    const reasons = [];
    if (floodZones.length) {
      reasons.push(`${floodZones.length} active flood hazard area(s) avoided or penalized`);
    }
    if (blockedRoads.length) {
      reasons.push(`${blockedRoads.length} road blockage/incident point(s) avoided or penalized`);
    }
    if (!reasons.length) {
      reasons.push("No active flood or road-blockage hazards were reported in the route corridor");
    }
    reasons.push("Safety score prioritizes hazard avoidance before travel distance");

    return {
      model: "Emergency risk-aware safest route",
      priority: "safety_over_distance",
      risk_level: riskLevel,
      nearest_flood_hazard_km: Number.isFinite(nearestFloodKm)
        ? Math.round(nearestFloodKm * 100) / 100
        : null,
      nearest_blocked_road_km: Number.isFinite(nearestBlockedRoadKm)
        ? Math.round(nearestBlockedRoadKm * 100) / 100
        : null,
      flood_exposure_points: floodExposurePoints,
      blocked_road_exposure_points: blockedRoadExposurePoints,
      reasons,
    };
  }

  static _nearestHazardDistance(routeCoordinates, hazards) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const coord of routeCoordinates) {
      for (const hazard of hazards) {
        const distance = this.haversineDistance(
          coord[0],
          coord[1],
          Number(hazard.latitude),
          Number(hazard.longitude),
        );
        if (distance < nearest) nearest = distance;
      }
    }
    return nearest;
  }

  static _countExposurePoints(routeCoordinates, hazards, fallbackRadiusKm = 2) {
    let count = 0;
    for (const coord of routeCoordinates) {
      const exposed = hazards.some((hazard) => {
        const radius = Number(hazard.radius_km || fallbackRadiusKm);
        const distance = this.haversineDistance(
          coord[0],
          coord[1],
          Number(hazard.latitude),
          Number(hazard.longitude),
        );
        return distance <= radius;
      });
      if (exposed) count += 1;
    }
    return count;
  }

  static _routeStatus(safetyScore) {
    if (safetyScore < 50) return "Alternative";
    return "Active";
  }

  static _generateWarnings(safetyScore, floodZones, blockedRoads) {
    const warnings = [];
    if (safetyScore < 50) warnings.push("Route has safety concerns");
    if (safetyScore < 25) warnings.push("Route has very high risk and needs field verification");
    if (floodZones.length > 0) warnings.push(`${floodZones.length} flood zone(s) considered`);
    if (blockedRoads.length > 0) warnings.push(`${blockedRoads.length} blocked road(s) considered`);
    return warnings;
  }

  static _buildMobilityPlan(routeCoordinates, floodZones = [], blockedRoads = []) {
    const segments = [];
    const transferPoints = [];
    let truckDistanceKm = 0;
    let boatDistanceKm = 0;
    let handDeliveryDistanceKm = 0;

    for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
      const start = routeCoordinates[index];
      const end = routeCoordinates[index + 1];
      const distanceKm = this.haversineDistance(start[0], start[1], end[0], end[1]);
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) continue;

      const midpoint = [
        (Number(start[0]) + Number(end[0])) / 2,
        (Number(start[1]) + Number(end[1])) / 2,
      ];
      const exposure = this._segmentMobilityExposure([start, midpoint, end], floodZones, blockedRoads);
      const mode = exposure.mode;
      const reason = exposure.reason;

      if (mode === "boat") boatDistanceKm += distanceKm;
      else if (mode === "hand-delivery") handDeliveryDistanceKm += distanceKm;
      else truckDistanceKm += distanceKm;

      const previous = segments[segments.length - 1];
      if (previous && previous.mode === mode && previous.reason === reason) {
        previous.distance_km += distanceKm;
        previous.end = end;
        previous.path.push(end);
      } else {
        if (previous) {
          transferPoints.push({
            latitude: Number(start[0]),
            longitude: Number(start[1]),
            from_mode: previous.mode,
            to_mode: mode,
            reason,
          });
        }
        segments.push({
          mode,
          distance_km: distanceKm,
          path: [start, end],
          start,
          end,
          reason,
        });
      }
    }

    const roundedSegments = segments.map((segment) => ({
      ...segment,
      distance_km: this._roundKm(segment.distance_km),
    }));
    const roundedTruckKm = this._roundKm(truckDistanceKm);
    const roundedBoatKm = this._roundKm(boatDistanceKm);
    const roundedHandKm = this._roundKm(handDeliveryDistanceKm);
    const estimatedTruckMinutes = Math.round((truckDistanceKm / 35) * 60);
    const estimatedBoatMinutes = Math.round((boatDistanceKm / 10) * 60);
    const estimatedHandMinutes = Math.round((handDeliveryDistanceKm / 4) * 60);
    const activeModes = [
      roundedTruckKm > 0.01 ? "truck" : null,
      roundedBoatKm > 0.01 ? "boat" : null,
      roundedHandKm > 0.01 ? "hand-delivery" : null,
    ].filter(Boolean);

    const notes = [
      "Truck distance is the route length outside known flood/blocked exposure zones.",
      "Boat distance is the route length inside reported flood or impassable road exposure zones.",
    ];
    if (transferPoints.length) {
      notes.push(`${transferPoints.length} vehicle transfer point(s) estimated from hazard boundary crossings.`);
    }

    return {
      truck_distance_km: roundedTruckKm,
      boat_distance_km: roundedBoatKm,
      hand_delivery_distance_km: roundedHandKm,
      estimated_truck_minutes: estimatedTruckMinutes,
      estimated_boat_minutes: estimatedBoatMinutes,
      estimated_hand_delivery_minutes: estimatedHandMinutes,
      estimated_mixed_time_minutes: estimatedTruckMinutes + estimatedBoatMinutes + estimatedHandMinutes,
      primary_mode: activeModes.length > 1 ? "mixed" : activeModes[0] || "truck",
      transfer_points: transferPoints,
      segments: roundedSegments,
      notes,
    };
  }

  static _segmentMobilityExposure(points, floodZones, blockedRoads) {
    for (const point of points) {
      const flood = this._nearestHazardAtPoint(point, floodZones);
      if (flood?.inside) {
        return {
          mode: "boat",
          reason: "Flood exposure on this route segment",
        };
      }
    }

    for (const point of points) {
      const blocked = this._nearestHazardAtPoint(point, blockedRoads, 0.5);
      if (blocked?.inside) {
        return {
          mode: "boat",
          reason: "Road is blocked or not truck-passable on this segment",
        };
      }
    }

    return {
      mode: "truck",
      reason: "Road segment is outside known flood/blockage exposure",
    };
  }

  static _nearestHazardAtPoint(point, hazards, fallbackRadiusKm = 2) {
    for (const hazard of hazards) {
      const distance = this.haversineDistance(
        Number(point[0]),
        Number(point[1]),
        Number(hazard.latitude),
        Number(hazard.longitude),
      );
      const radius = Number(hazard.radius_km || fallbackRadiusKm);
      if (distance <= radius) {
        return { inside: true, distance, hazard };
      }
    }
    return null;
  }

  static _roundKm(value) {
    return Math.round(Number(value || 0) * 100) / 100;
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
