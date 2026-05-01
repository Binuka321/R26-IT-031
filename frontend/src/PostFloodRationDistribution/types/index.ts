// TypeScript interfaces for Post-Flood Rescue & Ration Distribution System

export interface SafeZone {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  capacity: number;
  current_population: number;
  nearby_road_access: string;
  safety_status: 'Safe' | 'At Risk' | 'Compromised';
  description: string;
  createdAt: string;
}

export interface Camp {
  _id: string;
  camp_name: string;
  safe_zone_id: string | SafeZone;
  latitude: number;
  longitude: number;
  population: number;
  children_count: number;
  elderly_count: number;
  food_available: number;
  water_available: number;
  medicine_available: number;
  sanitary_available: number;
  disease_risk_level: 'Low' | 'Medium' | 'High';
  priority_level: 'Low' | 'Medium' | 'High';
  priority_score: number;
  distance_from_distribution_center: number;
  camp_capacity: number;
  contact_person: string;
  contact_phone: string;
  status: 'Active' | 'Inactive' | 'Evacuated';
  last_updated: string;
  createdAt: string;
}

export interface DiseaseResult {
  _id: string;
  camp_id: string | Camp;
  disease_type: string;
  risk_level: 'Low' | 'Medium' | 'High';
  detected_date: string;
  medicine_urgency: 'Low' | 'Medium' | 'High';
  sanitary_urgency: 'Low' | 'Medium' | 'High';
  affected_count: number;
  notes: string;
  status: 'Active' | 'Contained' | 'Resolved';
}

export interface Resource {
  _id: string;
  resource_name: string;
  resource_type: 'food' | 'water' | 'medicine' | 'sanitary' | 'clothes' | 'baby_care' | 'emergency';
  total_quantity: number;
  allocated_quantity: number;
  available_quantity: number;
  unit: string;
  low_stock_threshold: number;
  description: string;
}

export interface PriorityPrediction {
  _id: string;
  camp_id: string | Camp;
  priority_level: 'Low' | 'Medium' | 'High';
  priority_score: number;
  confidence_score: number;
  model_version: string;
  prediction_source: 'rule_based' | 'ml_model';
  factors: {
    population_score: number;
    resource_shortage_score: number;
    disease_risk_score: number;
    vulnerable_population_score: number;
    distance_score: number;
  };
  predicted_at: string;
}

export interface ItemPriority {
  _id: string;
  camp_id: string | Camp;
  food_priority: 'Low' | 'Medium' | 'High';
  water_priority: 'Low' | 'Medium' | 'High';
  medicine_priority: 'Low' | 'Medium' | 'High';
  sanitary_priority: 'Low' | 'Medium' | 'High';
  recommended_food_qty: number;
  recommended_water_qty: number;
  recommended_medicine_qty: number;
  recommended_sanitary_qty: number;
  overall_urgency: 'Low' | 'Medium' | 'High';
  notes: string;
}

export interface RouteData {
  _id: string;
  camp_id: string | Camp;
  route_name: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  route_coordinates: number[][];
  distance: number;
  estimated_time: string;
  estimated_time_minutes: number;
  safety_score: number;
  route_status: 'Active' | 'Blocked' | 'Flooded' | 'Alternative';
  route_type: 'Safest' | 'Shortest' | 'Alternative';
  warnings: string[];
}

export interface Distribution {
  _id: string;
  camp_id: string | Camp;
  route_id: string | RouteData;
  assigned_team_id: string | { _id: string; name: string };
  priority_level: 'Low' | 'Medium' | 'High';
  item_list: { item_name: string; item_type: string; quantity: number; unit: string }[];
  delivery_method: 'truck' | 'boat' | 'helicopter' | 'hand-delivery';
  status: 'Pending' | 'On the Way' | 'Delivered' | 'Failed';
  notes: string;
  created_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'priority_alert' | 'disease_alert' | 'low_stock' | 'route_alert' | 'delivery_alert' | 'system';
  severity: 'info' | 'warning' | 'critical';
  target_role: string;
  related_camp_id: string | Camp | null;
  status: 'unread' | 'read';
  createdAt: string;
}

export interface DashboardStats {
  totalSafeZones: number;
  totalCamps: number;
  highPriority: number;
  medPriority: number;
  lowPriority: number;
  totalPopulation: number;
  totalDistributions: number;
  pendingDistributions: number;
  completedDistributions: number;
  totalFood: number;
  totalWater: number;
  totalMedicine: number;
  totalSanitary: number;
}

export interface CampNeeds {
  population: number;
  children_count: number;
  elderly_count: number;
  vulnerable_ratio: string;
  food: { available: number; needed: number; shortage: number; coverage_days: string };
  water: { available: number; needed: number; shortage: number; coverage_days: string };
  medicine: { available: number; needed: number; shortage: number; adequacy: string };
  sanitary: { available: number; needed: number; shortage: number; adequacy: string };
  disease_risk_level: string;
  overall_need_score: number;
}

export type PageName = 'dashboard' | 'map' | 'safe-zones' | 'camps' | 'camp-details' |
  'camp-priority' | 'item-priority' | 'resources' | 'route-planning' |
  'distributions' | 'reports' | 'notifications';
