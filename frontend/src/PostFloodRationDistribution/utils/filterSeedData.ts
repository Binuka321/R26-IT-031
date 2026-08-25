// Helpers to filter out seeded/demo data from API responses

const seedSafeZoneNames = [
  "colombo north safe zone",
  "kandy highland zone",
  "galle fort zone",
  "kurunegala town zone",
  "ratnapura hill zone",
];

const seedResourceNames = [
  "rice packs (5kg)",
  "dry ration packs",
  "drinking water (1l)",
  "water purification tablets",
  "first aid kits",
  "paracetamol packs",
  "sanitary pad packs",
  "disinfectant spray",
  "clothing bundles",
  "baby care kits",
  "emergency kits",
];

export function filterOutSeedSafeZones(items: any[] = []) {
  return (items || []).filter((i) => {
    const name = String(i?.name || "").toLowerCase();
    return !seedSafeZoneNames.includes(name);
  });
}

export function filterOutSeedCamps(items: any[] = []) {
  return (items || []).filter((i) => {
    const name = String(i?.camp_name || i?.name || "").toLowerCase();
    // Seed camps use Alpha/Beta/Gamma in the template
    if (/\b(alpha|beta|gamma)\b/i.test(name)) return false;
    return true;
  });
}

export function filterOutSeedResources(items: any[] = []) {
  return (items || []).filter((i) => {
    const name = String(
      i?.resource_name || i?.resource || i?.item_name || "",
    ).toLowerCase();
    return !seedResourceNames.includes(name);
  });
}

export function filterOutSeedDiseaseResults(items: any[] = []) {
  return (items || []).filter((i) => {
    const notes = String(i?.notes || "").toLowerCase();
    const diseaseType = String(i?.disease_type || "").toLowerCase();
    // Seeded disease results include "post-flood" phrasing and dengue outbreaks
    if (notes.includes("post-flood") || notes.includes("outbreak detected"))
      return false;
    if (
      diseaseType === "dengue" &&
      String(i?.risk_level || "").toLowerCase() === "high" &&
      notes.includes("dengue")
    )
      return false;
    return true;
  });
}

export function filterOutSeedNotifications(items: any[] = []) {
  return (items || []).filter((i) => {
    const title = String(i?.title || "").toLowerCase();
    if (
      title.includes("system initialized") ||
      title.includes("system initialized")
    )
      return false;
    return true;
  });
}
