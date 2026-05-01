import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

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