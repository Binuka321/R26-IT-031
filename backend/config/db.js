import mongoose from 'mongoose';

const connectDB = async (retryCount = 0, maxRetries = 3) => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ MONGO_URI not set in environment variables");
    process.exit(1);
  }

  try {
    console.log(`🔗 Connecting to MongoDB Atlas (Attempt ${retryCount + 1}/${maxRetries + 1})...`);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      maxPoolSize: 10,
      minPoolSize: 5
    });

    console.log("✅ MongoDB Connected Successfully (Atlas)");
  } catch (error) {
    console.error(`❌ MongoDB Connection Error (Attempt ${retryCount + 1}/${maxRetries + 1}):`);
    console.error(error.message);
    
    if (retryCount < maxRetries) {
      const delay = (retryCount + 1) * 2000;
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      setTimeout(() => connectDB(retryCount + 1, maxRetries), delay);
    } else {
      console.error("❌ MongoDB connection failed after all retries");
      console.error("📋 Common fixes:");
      console.error("   1. Ensure your IP is whitelisted in MongoDB Atlas (Network Access)");
      console.error("   2. Check MONGO_URI environment variable is correctly set");
      console.error("   3. Verify cluster status at: https://cloud.mongodb.com/");
      process.exit(1);
    }
  }
};

export default connectDB;