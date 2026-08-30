import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dns from "node:dns";
import mongoSanitize from "express-mongo-sanitize";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Existing route imports
import { authRouter } from "./routes/authRoutes.js";
import { rainfallRouter } from "./routes/rainfallRoutes.js";
import { predictionRouter } from "./routes/predictionRoutes.js";
import { trainingRouter } from "./routes/trainingRoutes.js";
import { sensorPackageRouter } from "./routes/sensorPackageRoutes.js";
import { sensorReadingRouter } from "./routes/sensorReadingRoutes.js";
import { blockageReadingRouter } from "./routes/blockageReadingRoutes.js";

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
import { allocationOptimizerRouter } from "./routes/allocationOptimizerRoutes.js";
import { reportRouter } from "./routes/reportRoutes.js";
import { notificationRouter } from "./routes/notificationRoutes.js";
import { notificationDeliveryRouter } from "./routes/notificationDeliveryRoutes.js";
import { needReportRouter } from "./routes/needReportRoutes.js";
import { rescueTeamLocationRouter } from "./routes/rescueTeamLocationRoutes.js";
import { rescueCenterRouter } from "./routes/rescueCenterRoutes.js";
import { distributionCenterRouter } from "./routes/distributionCenterRoutes.js";
import { mlRetrainingRouter } from "./routes/mlRetrainingRoutes.js";

import createDefaultAdmin from "./utils/createAdmin.js";

// Rash Detection imports
import upload from "./middleware/upload.js";
import formRoutes from "./routes/form.js";
import predictionRoutesDisease from "./routes/predictionRoutesDisease.js";

// Load .env locally
dotenv.config();

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

/* =========================================
   DATABASE INITIALIZATION
========================================= */

let databaseReady = false;
let databaseError = null;

const initializeServer = async () => {
  try {
    console.log("🔗 Connecting to MongoDB Atlas...");
    console.log(
      "MONGO_URI loaded:",
      process.env.MONGO_URI ? "YES" : "NO"
    );

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is missing");
    }

    await connectDB();

    console.log("✅ MongoDB Connected Successfully");

    await createDefaultAdmin();

    databaseReady = true;

    console.log("📦 Post-Flood Rescue & Ration Distribution System: Active");
    console.log(
      `📍 ML Service URL: ${
        process.env.ML_SERVICE_URL || "http://localhost:5000"
      }`
    );
    console.log(
      `📍 Post-Flood ML Service URL: ${
        process.env.POST_FLOOD_ML_SERVICE_URL || "http://localhost:5050"
      }`
    );
  } catch (error) {
    databaseError = error;

    console.error("❌ Server initialization failed:");
    console.error(error.message);

    // Do NOT use process.exit(1) on Vercel
    // It would kill the Serverless Function
  }
};

// Start database initialization
const initializationPromise = initializeServer();

/* =========================================
   CORS
========================================= */

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://r26-it-031-52ki.vercel.app",
  "https://r26-it-031-ms7j-git-main-binuka321s-projects.vercel.app",
  "https://r26-it-031-ms7j-epv1o220p-binuka321s-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3002",
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  return /https?:\/\/.*\.vercel\.app$/i.test(origin) ||
    /https?:\/\/.*\.vercel\.app\//i.test(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(`CORS policy: Origin "${origin}" is not allowed.`)
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =========================================
   BODY PARSING
========================================= */

app.use(express.json());

/* =========================================
   UPLOADS
========================================= */

// On Vercel, uploaded files use /tmp/uploads
const staticUploadPath =
  process.env.VERCEL === "1"
    ? "/tmp/uploads"
    : path.join(__dirname, UPLOAD_DIR);

app.use("/uploads", express.static(staticUploadPath));

/* =========================================
   SECURITY
========================================= */

// Prevent NoSQL injection
app.use(mongoSanitize());

/* =========================================
   WAIT FOR DATABASE INITIALIZATION
========================================= */

app.use(async (_req, res, next) => {
  try {
    await initializationPromise;

    if (databaseError) {
      return res.status(500).json({
        error: "Server initialization failed",
        message: databaseError.message,
      });
    }

    if (!databaseReady) {
      return res.status(503).json({
        error: "Database is not ready",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});

/* =========================================
   EXISTING ROUTES
========================================= */

app.use("/api/auth", authRouter);
app.use("/api/rainfall", rainfallRouter);
app.use("/api/prediction", predictionRouter);
app.use("/api/training", trainingRouter);
app.use("/api/sensor-packages", sensorPackageRouter);
app.use("/api/sensor-readings", sensorReadingRouter);
app.use("/api/blockage-readings", blockageReadingRouter);

/* =========================================
   POST-FLOOD ROUTES
========================================= */

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
app.use("/api/allocations", allocationOptimizerRouter);
app.use("/api/reports", reportRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/notification-deliveries", notificationDeliveryRouter);
app.use("/api/need-reports", needReportRouter);
app.use("/api/rescue-team-locations", rescueTeamLocationRouter);
app.use("/api/rescue-centers", rescueCenterRouter);
app.use("/api/distribution-centers", distributionCenterRouter);
app.use("/api/ml-retraining", mlRetrainingRouter);

/* =========================================
   DISEASE / RASH DETECTION ROUTES
========================================= */

app.use(
  "/api/disease-predictions",
  predictionRoutesDisease(upload)
);

app.use("/api", formRoutes);

/* =========================================
   HEALTH CHECK
========================================= */

app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "Flood Manager API running",
    services: {
      database: databaseReady ? "connected" : "initializing",
      mlService:
        process.env.ML_SERVICE_URL || "http://localhost:5000",
      postFloodMlService:
        process.env.POST_FLOOD_ML_SERVICE_URL ||
        "http://localhost:5050",
      postFloodSystem: "active",
    },
  });
});

/* =========================================
   ROOT ROUTE
========================================= */

app.get("/", (_req, res) => {
  res.json({
    status: "OK",
    message: "Flood Guard 360 API is running",
  });
});


/* =========================================
   ERROR HANDLER
========================================= */

app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "Image must be 5MB or smaller",
    });
  }

  if (err.message === "Only image files are allowed") {
    return res.status(400).json({
      error: err.message,
    });
  }

  console.error("Server error:", err);

  return res.status(500).json({
    error: "Something went wrong",
    message: err.message,
  });
});

/* =========================================
   VERCEL EXPORT
========================================= */

// THIS IS REQUIRED FOR VERCEL
export default app;

/* =========================================
   LOCAL DEVELOPMENT SERVER
========================================= */

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT || 3002);

  initializationPromise.then(() => {
    if (databaseError) {
      console.error("❌ Cannot start local server");
      return;
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use. Stop the old Node process and try again.`);
        console.error("   Example: taskkill /F /IM node.exe /T");
        process.exit(1);
      }

      throw error;
    });
  });
}