import mongoose from "mongoose";

const connectDB = async (retryCount = 0, maxRetries = 3) => {
  const rawUri = process.env.MONGO_URI;
  const uri = rawUri?.trim();

  if (!uri) {
    console.error("❌ MONGO_URI not set in environment variables or contains only whitespace");
    process.exit(1);
  }

  try {
    console.log("🔗 Connecting to MongoDB Atlas...");
    console.log("MONGO_URI loaded:", uri ? "YES" : "NO");
    const host = uri.replace(/^mongodb(?:\+srv)?:\/\//, "").split("@").pop().split("/")[0];
    console.log("MongoDB URI host preview:", host);

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