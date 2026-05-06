#!/usr/bin/env node
import fetch from 'node-fetch';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

console.log('🔍 MongoDB Atlas Connection Diagnostic Tool\n');

// Step 1: Get public IP
console.log('1️⃣  Detecting your public IP address...');
try {
  const response = await fetch('https://api.ipify.org?format=json');
  const data = await response.json();
  const publicIP = data.ip;
  console.log(`   ✅ Your Public IP: ${publicIP}\n`);
  console.log(`   📋 Add this IP to MongoDB Atlas Network Access:`);
  console.log(`      https://cloud.mongodb.com/ → Network Access → Add IP Address\n`);
} catch (error) {
  console.log('   ⚠️  Could not fetch public IP. Check manually at: https://whatismyipaddress.com/\n');
}

// Step 2: Check MongoDB URI format
console.log('2️⃣  Checking MongoDB URI format...');
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.log('   ❌ MONGO_URI not set in .env file\n');
  process.exit(1);
}

if (mongoUri.includes('mongodb://')) {
  console.log('   ✅ Valid MongoDB URI format detected\n');
} else {
  console.log('   ❌ Invalid MongoDB URI format\n');
  process.exit(1);
}

// Step 3: Extract and test cluster hosts
console.log('3️⃣  Testing MongoDB cluster connectivity...');
const hostMatch = mongoUri.match(/mongodb:\/\/[^@]*@([^/?]+)/);
if (hostMatch) {
  const hosts = hostMatch[1].split(',');
  console.log(`   Found ${hosts.length} cluster hosts:`);
  
  for (const host of hosts) {
    try {
      const [hostname] = host.split(':');
      console.log(`   🔗 Testing ${hostname}...`);
      await dnsLookup(hostname);
      console.log(`      ✅ Hostname resolves\n`);
    } catch (err) {
      console.log(`      ❌ Cannot resolve hostname: ${err.message}\n`);
    }
  }
}

// Step 4: Final checklist
console.log('4️⃣  Connection Checklist:');
console.log(`   ☐ Add your public IP to MongoDB Atlas Network Access`);
console.log(`   ☐ Wait 1-2 minutes for whitelist to update`);
console.log(`   ☐ Ensure MONGO_URI is correctly set in backend/.env`);
console.log(`   ☐ Verify cluster is active: https://cloud.mongodb.com/\n`);

console.log('5️⃣  After whitelisting your IP, restart the server:');
console.log(`   npm run dev\n`);

console.log('Need help? Contact MongoDB Support or visit:');
console.log('https://www.mongodb.com/docs/atlas/security-whitelist/\n');
