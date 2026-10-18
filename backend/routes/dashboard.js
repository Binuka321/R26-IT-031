
import express from 'express';
import fs from 'node:fs';
import axios from 'axios';
import FormData from 'form-data';

import Prediction from '../models/Prediction.js';
import alerts from '../services/alerts.js';

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || 'http://localhost:5000';

function predictionRoutes(upload) {
  const router = express.Router();

  // IMAGE UPLOAD AND PREDICTION
  router.post(
    '/upload',
    upload.single('rashImage'),
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'Please upload a rash image'
          });
        }

        // Prepare image for Flask ML service
        const form = new FormData();

        form.append(
          'file',
          fs.createReadStream(req.file.path),
          {
            filename: req.file.originalname,
            contentType: req.file.mimetype
          }
        );

        // Send image to ML model
        const mlResponse = await axios.post(
          `${ML_SERVICE_URL}/predict`,
          form,
          {
            headers: form.getHeaders(),
            timeout: 30000
          }
        );

        const modelResult = mlResponse.data;

        // Extract predicted disease class
        const predictedClass =
          modelResult.predicted_class ||
          modelResult.prediction ||
          modelResult.class ||
          modelResult.disease;

        // Extract confidence for database storage
        const confidence = Number(
          modelResult.confidence || 0
        );

        // Extract class probabilities
        const rawProbabilities =
          modelResult.probabilities || [];

        const probabilities = Array.isArray(
          rawProbabilities
        )
          ? rawProbabilities
          : Object.entries(
              rawProbabilities
            ).map(
              ([class_name, confidence]) => ({
                class_name,
                confidence: Number(confidence)
              })
            );

        // Validate ML prediction
        if (!predictedClass) {
          return res.status(502).json({
            error:
              'ML service did not return a prediction class',
            mlResponse: modelResult
          });
        }

        // Generate uploaded image URL
        const imageUrl =
          `${req.protocol}://${req.get('host')}` +
          `/uploads/${req.file.filename}`;

        // SAVE PREDICTION TO MONGODB
        const savedPrediction =
          await Prediction.create({
            originalFilename:
              req.file.originalname,

            storedFilename:
              req.file.filename,

            imageUrl,

            predictedClass,

            confidence,

            probabilities
          });

        console.log(
          'Image prediction saved:',
          savedPrediction._id
        );

        // AUTOMATIC EMAIL / SMS NOTIFICATIONS
        let notifications = [];

        try {
          notifications = await alerts.automatic({
            type: 'image',
            disease: predictedClass,
            recordId: String(
              savedPrediction._id
            )
          });
        } catch (alertError) {
          console.error(
            'Automatic image alert failed:',
            alertError
          );

          notifications = [];
        }

        // RETURN PREDICTION
        return res.status(201).json({
          ...savedPrediction.toObject(),
          notifications
        });

      } catch (err) {
        console.error(
          'IMAGE PREDICTION ERROR:',
          err
        );

        next(err);
      }
    }
  );

  // GET ALL SAVED IMAGE PREDICTIONS
  router.get(
    '/',
    async (_req, res, next) => {
      try {
        const predictions =
          await Prediction.find().sort({
            createdAt: -1
          });

        return res.json(predictions);

      } catch (err) {
        console.error(
          'FETCH PREDICTIONS ERROR:',
          err
        );

        next(err);
      }
    }
  );

  return router;
}

// ES MODULE EXPORT
export default predictionRoutes;
