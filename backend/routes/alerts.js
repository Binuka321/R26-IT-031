import express from "express";
import alerts from "../services/alerts.js";

const router = express.Router();

router.use((req, res, next) => {
  const local = [
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ].includes(req.socket.remoteAddress);

  const origin = req.get("origin");

  if (
    !local ||
    (
      origin &&
      origin !== (
        process.env.CLIENT_ORIGIN ||
        "http://localhost:5173"
      )
    )
  ) {
    return res.status(403).json({
      message:
        "Alert controls are restricted to the local application.",
    });
  }

  next();
});

router.get("/", (_req, res) => {
  res.json(alerts.status());
});

router.post("/send", async (req, res, next) => {
  if (
    !req.is("application/json") ||
    !["email", "sms"].includes(req.body?.channel)
  ) {
    return res.status(400).json({
      message: "Choose email or SMS.",
    });
  }

  try {
    res.json(
      await alerts.deliver(
        req.body.channel,
        "manual"
      )
    );
  } catch (error) {
    next(error);
  }
});

export default router;