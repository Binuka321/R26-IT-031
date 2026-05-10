import fetch from "node-fetch";

const POST_FLOOD_ML_SERVICE_URL =
  process.env.POST_FLOOD_ML_SERVICE_URL || "http://localhost:5050";
const REQUEST_TIMEOUT_MS = Number(process.env.POST_FLOOD_ML_TIMEOUT_MS || 15000);

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export class PostFloodMLService {
  static buildCampPayload(camp) {
    const population = Number(camp.population || 0);
    const children = Number(camp.children_count || 0);
    const elderly = Number(camp.elderly_count || 0);
    const infants = Number(camp.infants_count || Math.ceil(population * 0.06));
    const pregnantWomen = Number(
      camp.pregnant_women_count || Math.ceil(population * 0.035),
    );
    const disabledPeople = Number(
      camp.disabled_people_count || Math.ceil(population * 0.05),
    );
    const chronicPatients = Number(
      camp.chronic_patients_count || Math.ceil(elderly * 0.35 + population * 0.03),
    );
    const campCapacity = Number(camp.camp_capacity || 1);
    const vulnerableCount =
      children + elderly + infants + pregnantWomen + disabledPeople + chronicPatients;

    return {
      population,
      children_count: children,
      elderly_count: elderly,
      infants_count: infants,
      pregnant_women_count: pregnantWomen,
      disabled_people_count: disabledPeople,
      chronic_patients_count: chronicPatients,
      food_available: Number(camp.food_available || 0),
      water_available: Number(camp.water_available || 0),
      medicine_available: Number(camp.medicine_available || 0),
      sanitary_available: Number(camp.sanitary_available || 0),
      last_distribution_hours: Number(camp.last_distribution_hours || 24),
      vehicle_capacity_total: Number(camp.vehicle_capacity_total || 0),
      distance_from_distribution_center: Number(
        camp.distance_from_distribution_center || 0,
      ),
      camp_capacity: campCapacity,
      camp_occupancy_ratio: Number(
        camp.camp_occupancy_ratio || Math.min(population / campCapacity, 1),
      ),
      vulnerable_ratio: Number(
        camp.vulnerable_ratio || Math.min(vulnerableCount / Math.max(population, 1), 1),
      ),
      road_access_status: camp.road_access_status || "Good",
    };
  }

  static async predictCampNeeds(camp) {
    const response = await fetchWithTimeout(`${POST_FLOOD_ML_SERVICE_URL}/api/ml/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PostFloodMLService.buildCampPayload(camp)),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Post-flood ML prediction failed");
    }

    return result.prediction;
  }

  static async predictBatchCampNeeds(camps) {
    const payload = {
      camps: camps.map((camp) => ({
        camp_id: String(camp._id),
        ...PostFloodMLService.buildCampPayload(camp),
      })),
    };

    const response = await fetchWithTimeout(
      `${POST_FLOOD_ML_SERVICE_URL}/api/ml/predict-batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Post-flood ML batch prediction failed");
    }

    return result;
  }

  static async getServiceStatus() {
    try {
      const response = await fetchWithTimeout(
        `${POST_FLOOD_ML_SERVICE_URL}/api/ml/health`,
      );
      const result = await response.json();

      return {
        available: response.ok && result.status === "OK",
        url: POST_FLOOD_ML_SERVICE_URL,
        ...result,
      };
    } catch (error) {
      return {
        available: false,
        url: POST_FLOOD_ML_SERVICE_URL,
        status: "UNAVAILABLE",
        message: error.message,
      };
    }
  }

  static async isServiceAvailable() {
    try {
      const response = await fetchWithTimeout(`${POST_FLOOD_ML_SERVICE_URL}/api/ml/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export default PostFloodMLService;
