export const SEED_SAFE_ZONE_NAMES = [
  "Colombo North Safe Zone",
  "Kandy Highland Zone",
  "Galle Fort Zone",
  "Kurunegala Town Zone",
  "Ratnapura Hill Zone",
];

export const SEED_RESOURCE_NAMES = [
  "Rice Packs (5kg)",
  "Dry Ration Packs",
  "Drinking Water (1L)",
  "Water Purification Tablets",
  "First Aid Kits",
  "Paracetamol Packs",
  "Sanitary Pad Packs",
  "Disinfectant Spray",
  "Clothing Bundles",
  "Baby Care Kits",
  "Emergency Kits",
];

export const seedCampNameFilter = {
  $not: /\b(Alpha|Beta|Gamma)\b/i,
};

export const realCampFilter = (extra = {}) => ({
  ...extra,
  is_demo: { $ne: true },
  camp_name: seedCampNameFilter,
});

export const realSafeZoneFilter = (extra = {}) => ({
  ...extra,
  name: { $nin: SEED_SAFE_ZONE_NAMES },
});

export const realResourceFilter = (extra = {}) => ({
  ...extra,
  resource_name: { $nin: SEED_RESOURCE_NAMES },
});

export const realDistributionFilter = (extra = {}) => ({
  ...extra,
  is_demo: { $ne: true },
});

export const realNeedReportFilter = (extra = {}) => ({
  ...extra,
  is_demo: { $ne: true },
});
