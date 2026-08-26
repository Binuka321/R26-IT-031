import mongoose from 'mongoose'

const predictionSchema = new mongoose.Schema(
  {
    originalFilename: {
      type: String,
      required: true,
    },

    storedFilename: {
      type: String,
      required: true,
    },

    imageUrl: {
      type: String,
      required: true,
    },

    predictedClass: {
      type: String,
      required: true,
    },

    confidence: {
      type: Number,
      required: true,
    },

    probabilities: [
      {
        class_name: String,
        confidence: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
)

export default mongoose.model('PredictionDisease', predictionSchema)