import express from 'express'
import fs from 'node:fs'
import axios from 'axios'
import FormData from 'form-data'
import Prediction from '../models/PredictionDisease.js'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000'

export default function predictionRoutes(upload) {
  const router = express.Router()

  router.post('/upload', upload.single('rashImage'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a rash image' })
      }

      const form = new FormData()
      form.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      })

      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, form, {
  headers: form.getHeaders(),
  timeout: 30000,
})


      const modelResult = mlResponse.data

      const predictedClass =
        modelResult.predicted_class ||
        modelResult.prediction ||
        modelResult.class ||
        modelResult.disease

      const confidence = Number(modelResult.confidence || 0)

     const rawProbabilities = modelResult.probabilities || []

const probabilities = Array.isArray(rawProbabilities)
  ? rawProbabilities
  : Object.entries(rawProbabilities).map(([class_name, confidence]) => ({
      class_name,
      confidence: Number(confidence),
    }))

    if (!predictedClass) {
  return res.status(502).json({
    error: 'ML service did not return a prediction class',
    mlResponse: modelResult,
  })
}


      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`

      const savedPrediction = await Prediction.create({
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        imageUrl,
        predictedClass,
        confidence,
        probabilities,
      })

      return res.status(201).json(savedPrediction.toObject())
    } catch (err) {
      next(err)
    }
  })

  router.get('/', async (_req, res, next) => {
    try {
      const predictions = await Prediction.find().sort({ createdAt: -1 })
      return res.json(predictions)
    } catch (err) {
      next(err)
    }
  })
  return router
}
