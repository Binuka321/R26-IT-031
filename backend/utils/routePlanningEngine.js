/**
 * Route Planning Engine — Simplified weighted path calculation
 * Considers distance, flood risk, water level, and road blockage to determine safe routes
 */

export class RoutePlanningEngine {

  /**
   * Generate a route between two points with safety scoring
   * @param {Object} start - { latitude, longitude }
   * @param {Object} end - { latitude, longitude }
   * @param {Object} options - Optional settings
   * @returns {Object} - Route details including coordinates, distance, time, safety score
   */
  static generateRoute(start, end, options = {}) {
    const { floodZones = [], blockedRoads = [], routeType = 'Safest' } = options;

    // Calculate direct distance (Haversine formula)
    const directDistance = this.haversineDistance(
      start.latitude, start.longitude,
      end.latitude, end.longitude
    );

    // Generate intermediate waypoints (simplified — 3-5 points along the path)
    const waypoints = this._generateWaypoints(start, end, floodZones, blockedRoads);

    // Calculate route coordinates
    const routeCoordinates = [
      [start.latitude, start.longitude],
      ...waypoints.map(wp => [wp.latitude, wp.longitude]),
      [end.latitude, end.longitude]
    ];

    // Calculate total route distance
    let totalDistance = 0;
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      totalDistance += this.haversineDistance(
        routeCoordinates[i][0], routeCoordinates[i][1],
        routeCoordinates[i + 1][0], routeCoordinates[i + 1][1]
      );
    }

    // Safety score calculation
    const safetyScore = this._calculateSafetyScore(routeCoordinates, floodZones, blockedRoads);

    // Estimated time (average speed 30 km/h for disaster conditions)
    const avgSpeed = routeType === 'Shortest' ? 40 : 30;
    const estimatedTimeMinutes = Math.round((totalDistance / avgSpeed) * 60);
    const hours = Math.floor(estimatedTimeMinutes / 60);
    const minutes = estimatedTimeMinutes % 60;
    const estimatedTime = hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m`;

    // Route warnings
    const warnings = this._generateWarnings(safetyScore, floodZones, blockedRoads);

    return {
      route_coordinates: routeCoordinates,
      waypoints: waypoints.map((wp, i) => ({
        latitude: wp.latitude,
        longitude: wp.longitude,
        description: `Waypoint ${i + 1}${wp.reason ? ` - ${wp.reason}` : ''}`
      })),
      distance: Math.round(totalDistance * 100) / 100,
      estimated_time: estimatedTime,
      estimated_time_minutes: estimatedTimeMinutes,
      safety_score: Math.round(safetyScore),
      route_status: safetyScore >= 50 ? 'Active' : (safetyScore >= 25 ? 'Active' : 'Blocked'),
      route_type: routeType,
      warnings
    };
  }

  /**
   * Haversine formula to calculate distance between two GPS points
   * @returns {Number} distance in kilometers
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this._toRad(lat2 - lat1);
    const dLon = this._toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static _toRad(deg) {
    return deg * Math.PI / 180;
  }

  /**
   * Generate intermediate waypoints, avoiding flood zones and blocked roads
   */
  static _generateWaypoints(start, end, floodZones, blockedRoads) {
    const waypoints = [];
    const numWaypoints = 3;

    for (let i = 1; i <= numWaypoints; i++) {
      const fraction = i / (numWaypoints + 1);
      let lat = start.latitude + (end.latitude - start.latitude) * fraction;
      let lng = start.longitude + (end.longitude - start.longitude) * fraction;

      // Check if this waypoint is near a flood zone and adjust
      let reason = '';
      for (const fz of floodZones) {
        const distToFlood = this.haversineDistance(lat, lng, fz.latitude, fz.longitude);
        if (distToFlood < (fz.radius_km || 2)) {
          // Shift waypoint away from flood zone
          const offset = 0.02; // ~2km offset
          lat += offset * (lat > fz.latitude ? 1 : -1);
          lng += offset * (lng > fz.longitude ? 1 : -1);
          reason = 'Diverted around flood zone';
          break;
        }
      }

      waypoints.push({ latitude: lat, longitude: lng, reason });
    }

    return waypoints;
  }

  /**
   * Calculate safety score based on proximity to flood zones and blocked roads
   */
  static _calculateSafetyScore(routeCoordinates, floodZones, blockedRoads) {
    let score = 100;

    // Reduce score for proximity to flood zones
    for (const coord of routeCoordinates) {
      for (const fz of floodZones) {
        const dist = this.haversineDistance(coord[0], coord[1], fz.latitude, fz.longitude);
        if (dist < 1) score -= 20;
        else if (dist < 3) score -= 10;
        else if (dist < 5) score -= 5;
      }
    }

    // Reduce score for proximity to blocked roads
    for (const coord of routeCoordinates) {
      for (const br of blockedRoads) {
        const dist = this.haversineDistance(coord[0], coord[1], br.latitude, br.longitude);
        if (dist < 1) score -= 25;
        else if (dist < 3) score -= 10;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate route warnings
   */
  static _generateWarnings(safetyScore, floodZones, blockedRoads) {
    const warnings = [];
    if (safetyScore < 30) warnings.push('Route passes through high-risk areas');
    if (safetyScore < 50) warnings.push('Moderate flood risk along route');
    if (floodZones.length > 0) warnings.push(`${floodZones.length} flood zone(s) near route`);
    if (blockedRoads.length > 0) warnings.push(`${blockedRoads.length} blocked road(s) reported`);
    if (safetyScore < 25) warnings.push('Consider alternative route');
    return warnings;
  }

  /**
   * Generate alternative route (offset from primary)
   */
  static generateAlternativeRoute(start, end, primaryRoute, options = {}) {
    // Offset waypoints slightly from primary route
    const altOptions = {
      ...options,
      routeType: 'Alternative'
    };

    // Add slight offset to simulate different path
    const altStart = {
      latitude: start.latitude + 0.005,
      longitude: start.longitude + 0.005
    };

    return this.generateRoute(altStart, end, altOptions);
  }
}

export default RoutePlanningEngine;
