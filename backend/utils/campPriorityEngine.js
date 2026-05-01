/**
 * Camp Priority Engine — Rule-based camp priority calculation
 * Weights: resource shortage (30%), disease risk (20%), population (20%),
 *          vulnerable population (15%), distance from distribution center (15%)
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

    // 5. Distance Score (15%) — farther camps may need early planning
    const distanceScore = Math.min((camp.distance_from_distribution_center || 0) / 50, 1) * 100;
    factors.distance_score = Math.round(distanceScore);

    // Weighted total
    const totalScore =
      (factors.population_score * 0.20) +
      (factors.resource_shortage_score * 0.30) +
      (factors.disease_risk_score * 0.20) +
      (factors.vulnerable_population_score * 0.15) +
      (factors.distance_score * 0.15);

    const priorityScore = Math.round(totalScore);

    // Determine priority level
    let priorityLevel;
    if (priorityScore >= 65) {
      priorityLevel = 'High';
    } else if (priorityScore >= 35) {
      priorityLevel = 'Medium';
    } else {
      priorityLevel = 'Low';
    }

    // Confidence score (rule-based = 0.75 fixed)
    const confidenceScore = 0.75;

    return {
      priority_level: priorityLevel,
      priority_score: priorityScore,
      confidence_score: confidenceScore,
      factors
    };
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
