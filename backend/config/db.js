import mongoose from "mongoose";

const connectDB = async (retryCount = 0, maxRetries = 3) => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ MONGO_URI not set in environment variables");
    process.exit(1);
  }

  try {
    console.log("🔗 Connecting to MongoDB Atlas...");

    if (!uri) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    console.log("MONGO_URI loaded:", uri ? "YES" : "NO");

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB REAL ERROR:");
    console.error(error.message);
    throw error;
  }
};

export default connectDB;