/**
 * Seed Data Script — Populates the database with sample data for development/demo
 * Run: node utils/seedData.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SafeZone from '../models/SafeZone.js';
import Camp from '../models/Camp.js';
import Resource from '../models/Resource.js';
import DiseaseResult from '../models/DiseaseResult.js';
import Notification from '../models/Notification.js';

dotenv.config();

const seedSafeZones = [
  { name: 'Colombo North Safe Zone', latitude: 6.9500, longitude: 79.8700, radius_km: 3, capacity: 2000, current_population: 0, nearby_road_access: 'A1 Highway', safety_status: 'Safe', description: 'Northern Colombo elevated area' },
  { name: 'Kandy Highland Zone', latitude: 7.2906, longitude: 80.6337, radius_km: 4, capacity: 1500, current_population: 0, nearby_road_access: 'A5 Road', safety_status: 'Safe', description: 'Central highlands safe area' },
  { name: 'Galle Fort Zone', latitude: 6.0300, longitude: 80.2200, radius_km: 2, capacity: 800, current_population: 0, nearby_road_access: 'Galle Road', safety_status: 'Safe', description: 'Elevated fort area in Galle' },
  { name: 'Kurunegala Town Zone', latitude: 7.4863, longitude: 80.3623, radius_km: 3, capacity: 1200, current_population: 0, nearby_road_access: 'A6 Road', safety_status: 'Safe', description: 'Kurunegala safe area' },
  { name: 'Ratnapura Hill Zone', latitude: 6.6828, longitude: 80.4000, radius_km: 2.5, capacity: 1000, current_population: 0, nearby_road_access: 'A4 Road', safety_status: 'At Risk', description: 'Hill zone near Ratnapura' }
];

const seedResources = [
  { resource_name: 'Rice Packs (5kg)', resource_type: 'food', total_quantity: 5000, allocated_quantity: 800, unit: 'packs', low_stock_threshold: 500 },
  { resource_name: 'Dry Ration Packs', resource_type: 'food', total_quantity: 3000, allocated_quantity: 500, unit: 'packs', low_stock_threshold: 300 },
  { resource_name: 'Drinking Water (1L)', resource_type: 'water', total_quantity: 10000, allocated_quantity: 2000, unit: 'bottles', low_stock_threshold: 1000 },
  { resource_name: 'Water Purification Tablets', resource_type: 'water', total_quantity: 2000, allocated_quantity: 300, unit: 'tablets', low_stock_threshold: 200 },
  { resource_name: 'First Aid Kits', resource_type: 'medicine', total_quantity: 500, allocated_quantity: 100, unit: 'kits', low_stock_threshold: 50 },
  { resource_name: 'Paracetamol Packs', resource_type: 'medicine', total_quantity: 1000, allocated_quantity: 200, unit: 'packs', low_stock_threshold: 100 },
  { resource_name: 'Sanitary Pad Packs', resource_type: 'sanitary', total_quantity: 2000, allocated_quantity: 400, unit: 'packs', low_stock_threshold: 200 },
  { resource_name: 'Disinfectant Spray', resource_type: 'sanitary', total_quantity: 800, allocated_quantity: 150, unit: 'bottles', low_stock_threshold: 80 },
  { resource_name: 'Clothing Bundles', resource_type: 'clothes', total_quantity: 1500, allocated_quantity: 300, unit: 'bundles', low_stock_threshold: 150 },
  { resource_name: 'Baby Care Kits', resource_type: 'baby_care', total_quantity: 300, allocated_quantity: 50, unit: 'kits', low_stock_threshold: 30 },
  { resource_name: 'Emergency Kits', resource_type: 'emergency', total_quantity: 200, allocated_quantity: 40, unit: 'kits', low_stock_threshold: 20 }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB');

    // Clear existing seed data
    await SafeZone.deleteMany({});
    await Camp.deleteMany({});
    await Resource.deleteMany({});
    await DiseaseResult.deleteMany({});
    await Notification.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Seed safe zones
    const zones = await SafeZone.insertMany(seedSafeZones);
    console.log(`✅ Created ${zones.length} safe zones`);

    // Seed camps (3 per safe zone)
    const campTemplates = [
      { camp_name: 'Alpha Camp', population: 320, children_count: 80, elderly_count: 45, food_available: 400, water_available: 600, medicine_available: 30, sanitary_available: 200, disease_risk_level: 'Medium', distance_from_distribution_center: 12, camp_capacity: 400 },
      { camp_name: 'Beta Camp', population: 150, children_count: 35, elderly_count: 20, food_available: 200, water_available: 300, medicine_available: 50, sanitary_available: 100, disease_risk_level: 'Low', distance_from_distribution_center: 8, camp_capacity: 200 },
      { camp_name: 'Gamma Camp', population: 500, children_count: 120, elderly_count: 70, food_available: 100, water_available: 200, medicine_available: 10, sanitary_available: 50, disease_risk_level: 'High', distance_from_distribution_center: 25, camp_capacity: 600 },
    ];

    const camps = [];
    for (const zone of zones) {
      for (let i = 0; i < campTemplates.length; i++) {
        const t = campTemplates[i];
        const camp = await Camp.create({
          ...t,
          camp_name: `${zone.name.split(' ')[0]} ${t.camp_name}`,
          safe_zone_id: zone._id,
          latitude: zone.latitude + (i - 1) * 0.005,
          longitude: zone.longitude + (i - 1) * 0.005,
          status: 'Active',
          contact_person: `Coordinator ${i + 1}`,
          contact_phone: `+94 7${Math.floor(Math.random() * 90000000 + 10000000)}`
        });
        camps.push(camp);
      }
      await SafeZone.findByIdAndUpdate(zone._id, {
        current_population: campTemplates.reduce((s, c) => s + c.population, 0)
      });
    }
    console.log(`✅ Created ${camps.length} camps`);

    // Seed resources
    const resources = [];
    for (const r of seedResources) {
      const resource = new Resource(r);
      resource.available_quantity = resource.total_quantity - resource.allocated_quantity;
      await resource.save();
      resources.push(resource);
    }
    console.log(`✅ Created ${resources.length} resources`);

    // Seed disease results for high-risk camps
    const highRiskCamps = camps.filter(c => c.disease_risk_level === 'High');
    for (const camp of highRiskCamps) {
      await DiseaseResult.create({
        camp_id: camp._id,
        disease_type: 'Dengue',
        risk_level: 'High',
        medicine_urgency: 'High',
        sanitary_urgency: 'High',
        affected_count: Math.floor(camp.population * 0.1),
        notes: 'Post-flood dengue outbreak detected',
        status: 'Active'
      });
    }
    console.log(`✅ Created disease results for ${highRiskCamps.length} camps`);

    // Seed notifications
    await Notification.create({
      title: 'System Initialized',
      message: 'Post-Flood Rescue & Ration Distribution System has been initialized with seed data.',
      type: 'system',
      severity: 'info',
      target_role: 'all'
    });
    console.log('✅ Created initial notification');

    console.log('\n🎉 Seed data created successfully!');
    console.log(`   Safe Zones: ${zones.length}`);
    console.log(`   Camps: ${camps.length}`);
    console.log(`   Resources: ${resources.length}`);
    console.log(`   Disease Results: ${highRiskCamps.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
}

seed();
