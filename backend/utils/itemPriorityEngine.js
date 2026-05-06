/**
 * Item Priority Engine — Rule-based relief item prioritization
 * Determines which items are most urgent for each camp and recommends quantities
 */

export class ItemPriorityEngine {

  /**
   * Calculate item priorities for a camp
   * @param {Object} camp - Camp data with population and resource availability
   * @param {Object} diseaseData - Disease risk info (optional)
   * @returns {Object} - Item priorities and recommended quantities
   */
  static calculateItemPriorities(camp, diseaseData = null) {
    const pop = camp.population || 1;
    const children = camp.children_count || 0;
    const elderly = camp.elderly_count || 0;

    // --- Food Priority ---
    const foodPerPersonPerDay = 3; // 3 food packs per person per day
    const foodNeededFor2Days = pop * foodPerPersonPerDay * 2;
    const foodRatio = camp.food_available / Math.max(foodNeededFor2Days, 1);
    let food_priority = 'Low';
    if (foodRatio < 0.3) food_priority = 'High';
    else if (foodRatio < 0.7) food_priority = 'Medium';

    const recommended_food_qty = Math.max(0, Math.round(foodNeededFor2Days - (camp.food_available || 0)));

    // --- Water Priority ---
    const waterPerPersonPerDay = 5; // 5 liters per person per day
    const waterNeededFor2Days = pop * waterPerPersonPerDay * 2;
    const waterRatio = camp.water_available / Math.max(waterNeededFor2Days, 1);
    let water_priority = 'Low';
    if (waterRatio < 0.3) water_priority = 'High';
    else if (waterRatio < 0.7) water_priority = 'Medium';

    const recommended_water_qty = Math.max(0, Math.round(waterNeededFor2Days - (camp.water_available || 0)));

    // --- Medicine Priority ---
    const medicinePerPerson = 0.5; // 0.5 medicine kits per person
    const medicineNeeded = pop * medicinePerPerson;
    const medicineRatio = camp.medicine_available / Math.max(medicineNeeded, 1);
    let medicine_priority = 'Low';
    if (medicineRatio < 0.3) medicine_priority = 'High';
    else if (medicineRatio < 0.7) medicine_priority = 'Medium';

    // Disease risk boosts medicine priority
    const diseaseRisk = diseaseData?.risk_level || camp.disease_risk_level || 'Low';
    if (diseaseRisk === 'High') medicine_priority = 'High';
    else if (diseaseRisk === 'Medium' && medicine_priority === 'Low') medicine_priority = 'Medium';

    // High elderly/children count boosts medicine priority
    if ((children + elderly) / pop > 0.4 && medicine_priority !== 'High') {
      medicine_priority = medicine_priority === 'Low' ? 'Medium' : 'High';
    }

    const recommended_medicine_qty = Math.max(0, Math.round(medicineNeeded - (camp.medicine_available || 0)));

    // --- Sanitary Priority ---
    const sanitaryPerPerson = 2; // 2 sanitary items per person
    const sanitaryNeeded = pop * sanitaryPerPerson;
    const sanitaryRatio = camp.sanitary_available / Math.max(sanitaryNeeded, 1);
    let sanitary_priority = 'Low';
    if (sanitaryRatio < 0.3) sanitary_priority = 'High';
    else if (sanitaryRatio < 0.7) sanitary_priority = 'Medium';

    // Disease risk boosts sanitary priority
    if (diseaseRisk === 'High') sanitary_priority = 'High';
    else if (diseaseRisk === 'Medium' && sanitary_priority === 'Low') sanitary_priority = 'Medium';

    const recommended_sanitary_qty = Math.max(0, Math.round(sanitaryNeeded - (camp.sanitary_available || 0)));

    // --- Overall Urgency ---
    const priorityValues = { 'Low': 1, 'Medium': 2, 'High': 3 };
    const avgPriority = (
      priorityValues[food_priority] +
      priorityValues[water_priority] +
      priorityValues[medicine_priority] +
      priorityValues[sanitary_priority]
    ) / 4;

    let overall_urgency = 'Low';
    if (avgPriority >= 2.5) overall_urgency = 'High';
    else if (avgPriority >= 1.5) overall_urgency = 'Medium';

    return {
      food_priority,
      water_priority,
      medicine_priority,
      sanitary_priority,
      recommended_food_qty,
      recommended_water_qty,
      recommended_medicine_qty,
      recommended_sanitary_qty,
      overall_urgency,
      notes: this._generateNotes(food_priority, water_priority, medicine_priority, sanitary_priority, diseaseRisk)
    };
  }

  static _generateNotes(food, water, medicine, sanitary, diseaseRisk) {
    const notes = [];
    if (food === 'High') notes.push('Critical food shortage');
    if (water === 'High') notes.push('Critical water shortage');
    if (medicine === 'High') notes.push('Urgent medicine needed');
    if (sanitary === 'High') notes.push('Sanitary items critically low');
    if (diseaseRisk === 'High') notes.push('High disease risk area');
    return notes.join('. ') || 'Resources adequate';
  }
}

export default ItemPriorityEngine;
