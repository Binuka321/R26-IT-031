/**
 * Camp Priority Engine — Rule-based camp priority calculation
 * Weights: resource shortage (30%), disease risk (20%), population (20%),
 *          vulnerable population (15%), distance (10%), last distribution time (10%)
 *
 * Changes:
 *  - W5: Dynamic confidence score based on data completeness (replaces hardcoded 0.75)
 *  - W6: Added last_distribution_hours as a 10% weight factor
 */

export class CampPriorityEngine {

  /**
   * Calculate priority for a single camp
   * @param {Object} camp - Camp data
   * @returns {Object} - { priority_level, priority_score, confidence_score, factors }
   */
  static calculatePriority(camp) {
    const factors = {};

    // 1. Population Score (20%) — higher population = higher priority
    const popScore = Math.min(camp.population / 500, 1) * 100;
    factors.population_score = Math.round(popScore);

    // 2. Resource Shortage Score (30%) — average shortage across all resource types
    const foodShortage = camp.population > 0
      ? Math.max(0, 1 - (camp.food_available / (camp.population * 3))) * 100
      : 0;
    const waterShortage = camp.population > 0
      ? Math.max(0, 1 - (camp.water_available / (camp.population * 5))) * 100
      : 0;
    const medicineShortage = camp.population > 0
      ? Math.max(0, 1 - (camp.medicine_available / (camp.population * 0.5))) * 100
      : 0;
    const sanitaryShortage = camp.population > 0
      ? Math.max(0, 1 - (camp.sanitary_available / (camp.population * 2))) * 100
      : 0;

    const resourceShortageScore = (foodShortage + waterShortage + medicineShortage + sanitaryShortage) / 4;
    factors.resource_shortage_score = Math.round(resourceShortageScore);

    // 3. Disease Risk Score (20%)
    const diseaseRiskMap = { 'Low': 20, 'Medium': 60, 'High': 100 };
    const diseaseRiskScore = diseaseRiskMap[camp.disease_risk_level] || 20;
    factors.disease_risk_score = diseaseRiskScore;

    // 4. Vulnerable Population Score (15%) — children + elderly as percentage of total
    const vulnerableRatio = camp.population > 0
      ? ((camp.children_count || 0) + (camp.elderly_count || 0)) / camp.population
      : 0;
    const vulnerableScore = Math.min(vulnerableRatio * 2, 1) * 100;
    factors.vulnerable_population_score = Math.round(vulnerableScore);

    // 5. Distance Score (10%) — farther camps may need early planning
    const distanceScore = Math.min((camp.distance_from_distribution_center || 0) / 50, 1) * 100;
    factors.distance_score = Math.round(distanceScore);

    // 6. W6 Fix: Last Distribution Time Score (10%)
    //    Camps not restocked for 48+ hours score 100 on this factor.
    const lastDistHours = camp.last_distribution_hours != null ? camp.last_distribution_hours : 24;
    const lastDistScore = Math.min(lastDistHours / 48, 1) * 100;
    factors.last_distribution_score = Math.round(lastDistScore);

    // Weighted total — weights sum to 100%
    const totalScore =
      (factors.population_score            * 0.20) +
      (factors.resource_shortage_score     * 0.30) +
      (factors.disease_risk_score          * 0.20) +
      (factors.vulnerable_population_score * 0.15) +
      (factors.distance_score              * 0.10) +  // reduced from 0.15
      (factors.last_distribution_score     * 0.10);   // W6: new factor

    const priorityScore = Math.round(totalScore);

    // Determine urgency band from continuous score
    let urgencyBand: string;
    if (priorityScore >= 70) {
      urgencyBand = 'Critical';
    } else if (priorityScore >= 45) {
      urgencyBand = 'Moderate';
    } else {
      urgencyBand = 'Stable';
    }

    // W5 Fix: Dynamic confidence score based on data completeness
    const confidenceScore = CampPriorityEngine._calculateConfidence(camp);

    return {
      priority_level: priorityLevel,
      priority_score: priorityScore,   // continuous 0-100 urgency score
      urgency_score: priorityScore,    // alias — explicitly named for consumers
      urgency_band: urgencyBand,       // human-readable tier from continuous score
      confidence_score: confidenceScore,
      factors
    };
  }

  /**
   * W5 Fix: Compute confidence based on how complete the camp's data fields are.
   * Missing critical fields reduce confidence, alerting operators to update the camp record.
   * @param {Object} camp
   * @returns {number} - value between 0.0 and 1.0
   */
  static _calculateConfidence(camp) {
    let score = 0;
    if (camp.population > 0)                                              score += 0.20;
    if (camp.disease_risk_level)                                          score += 0.15;
    if (camp.food_available != null)                                      score += 0.15;
    if (camp.water_available != null)                                     score += 0.15;
    if (camp.medicine_available != null)                                  score += 0.10;
    if (camp.distance_from_distribution_center > 0)                      score += 0.10;
    if (camp.last_distribution_hours != null)                             score += 0.10;
    if (((camp.children_count || 0) + (camp.elderly_count || 0)) > 0)   score += 0.05;
    return Math.round(score * 100) / 100;
  }

  /**
   * Calculate priorities for multiple camps
   * @param {Array} camps - Array of camp data
   * @returns {Array} - Array of priority results
   */
  static calculateBatchPriority(camps) {
    return camps.map(camp => ({
      camp_id: camp._id,
      camp_name: camp.camp_name,
      ...this.calculatePriority(camp)
    }));
  }

  /**
   * Rank camps by priority score (descending)
   */
  static rankCamps(campPriorities) {
    return [...campPriorities].sort((a, b) => b.priority_score - a.priority_score);
  }
}

export default CampPriorityEngine;
