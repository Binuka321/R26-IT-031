/**
 * removeSeedData.js
 * Deletes seeded/demo records inserted by the seed script.
 * Run: `node utils/removeSeedData.js` from the `backend` folder (ensure MONGO_URI is set in .env).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import SafeZone from "../models/SafeZone.js";
import Camp from "../models/Camp.js";
import Resource from "../models/Resource.js";
import DiseaseResult from "../models/DiseaseResult.js";
import Notification from "../models/Notification.js";

dotenv.config();

const seedZoneNames = [
  "Colombo North Safe Zone",
  "Kandy Highland Zone",
  "Galle Fort Zone",
  "Kurunegala Town Zone",
  "Ratnapura Hill Zone",
];

const seedResourceNames = [
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

const seedNotificationTitle = "System Initialized";

async function remove() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI not set in environment");
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ Connected to MongoDB");

    // Delete by created_by == null (system/seed data)
    const safeZoneDel = await SafeZone.deleteMany({ created_by: null });
    console.log(`🗑️  Removed safe zones with created_by=null: ${safeZoneDel.deletedCount}`);

    const resourceDel = await Resource.deleteMany({ created_by: null });
    console.log(`🗑️  Removed resources with created_by=null: ${resourceDel.deletedCount}`);

    const campDel = await Camp.deleteMany({ created_by: null });
    console.log(`🗑️  Removed camps with created_by=null: ${campDel.deletedCount}`);

    const diseaseDel = await DiseaseResult.deleteMany({ created_by: null });
    console.log(`🗑️  Removed disease results with created_by=null: ${diseaseDel.deletedCount}`);

    const notifDel = await Notification.deleteMany({ created_by: null });
    console.log(`🗑️  Removed notifications with created_by=null: ${notifDel.deletedCount}`);

    // Also delete by explicit seed name patterns (extra safety)
    const resourcesByName = await Resource.deleteMany({ resource_name: { $in: seedResourceNames } });
    console.log(`🗑️  Removed resources by name: ${resourcesByName.deletedCount}`);

    const zonesByName = await SafeZone.deleteMany({ name: { $in: seedZoneNames } });
    console.log(`🗑️  Removed safe zones by name: ${zonesByName.deletedCount}`);

    // Remove camps that match Alpha/Beta/Gamma template
    const namedCampsRes = await Camp.deleteMany({ camp_name: { $regex: "\\b(Alpha|Beta|Gamma)\\b", $options: "i" } });
    console.log(`🗑️  Removed named seed camps: ${namedCampsRes.deletedCount}`);

    // Remove disease results that reference non-existent camps (orphan results)
    const remainingCamps = await Camp.find({}, "_id").lean();
    const remainingCampIds = remainingCamps.map((c) => c._id);
    const orphanDisease = await DiseaseResult.deleteMany({ camp_id: { $nin: remainingCampIds } });
    console.log(`🗑️  Removed orphan disease results: ${orphanDisease.deletedCount}`);

    // Remove seed notification(s) by title as well
    const notifByTitle = await Notification.deleteMany({ title: seedNotificationTitle });
    console.log(`🗑️  Removed notifications titled "${seedNotificationTitle}": ${notifByTitle.deletedCount}`);

    console.log("\n🎉 Seed data removal complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error removing seed data:", error);
    process.exit(1);
  }
}

remove();

    // Remove seed notification(s)
    const notifRes = await Notification.deleteMany({
      title: seedNotificationTitle,
    });
    console.log(
      `🗑️  Removed notifications titled "${seedNotificationTitle}": ${notifRes.deletedCount}`,
    );

    console.log("\n🎉 Seed data removal complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error removing seed data:", error);
    process.exit(1);
  }
}

remove();
