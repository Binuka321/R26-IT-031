import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dns from "node:dns";
import connectDB from "./config/db.js";

// Existing route imports
import { authRouter } from "./routes/authRoutes.js";
import { rainfallRouter } from "./routes/rainfallRoutes.js";
import { predictionRouter } from "./routes/predictionRoutes.js";
import { trainingRouter } from "./routes/trainingRoutes.js";
import { sensorPackageRouter } from "./routes/sensorPackageRoutes.js";
import { sensorReadingRouter } from "./routes/sensorReadingRoutes.js";

// Post-Flood Rescue & Ration Distribution route imports
import { userRouter } from "./routes/userRoutes.js";
import { safeZoneRouter } from "./routes/safeZoneRoutes.js";
import { campRouter } from "./routes/campRoutes.js";
import { diseaseRouter } from "./routes/diseaseRoutes.js";
import { mapDataRouter } from "./routes/mapDataRoutes.js";
import { resourceRouter } from "./routes/resourceRoutes.js";
import { campPriorityRouter } from "./routes/campPriorityRoutes.js";
import { itemPriorityRouter } from "./routes/itemPriorityRoutes.js";
import { routePlanningRouter } from "./routes/routePlanningRoutes.js";
import { distributionRouter } from "./routes/distributionRoutes.js";
import { reportRouter } from "./routes/reportRoutes.js";
import { notificationRouter } from "./routes/notificationRoutes.js";
import { needReportRouter } from "./routes/needReportRoutes.js";

import createDefaultAdmin from "./utils/createAdmin.js";

dotenv.config();
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const app = express();

app.use(cors());
app.use(express.json());

// Existing Routes
app.use("/api/auth", authRouter);
app.use("/api/rainfall", rainfallRouter);
app.use("/api/prediction", predictionRouter);
app.use("/api/training", trainingRouter);
app.use("/api/sensor-packages", sensorPackageRouter);
app.use("/api/sensor-readings", sensorReadingRouter);

// Post-Flood Rescue & Ration Distribution Routes
app.use("/api/users", userRouter);
app.use("/api/safe-zones", safeZoneRouter);
app.use("/api/camps", campRouter);
app.use("/api/disease-results", diseaseRouter);
app.use("/api/map-data", mapDataRouter);
app.use("/api/resources", resourceRouter);
app.use("/api/predictions", campPriorityRouter);
app.use("/api/item-priority", itemPriorityRouter);
app.use("/api/routes", routePlanningRouter);
app.use("/api/distributions", distributionRouter);
app.use("/api/reports", reportRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/need-reports", needReportRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Flood Manager API running",
    services: {
      database: "connected",
      mlService: process.env.ML_SERVICE_URL || "http://localhost:5000",
      postFloodMlService:
        process.env.POST_FLOOD_ML_SERVICE_URL || "http://localhost:5050",
      postFloodSystem: "active",
    },
  });
});

// Start server only after MongoDB connects
const startServer = async () => {
  try {
    const PORT = process.env.PORT || 3001;

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    await connectDB();

    await createDefaultAdmin();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(
        `📍 ML Service URL: ${
          process.env.ML_SERVICE_URL || "http://localhost:5000"
        }`
      );
      console.log(
        `Post-Flood ML Service URL: ${
          process.env.POST_FLOOD_ML_SERVICE_URL || "http://localhost:5050"
        }`
      );
      console.log("📦 Post-Flood Rescue & Ration Distribution System: Active");
    });
  } catch (error) {
    console.error("❌ Server failed to start :");
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
