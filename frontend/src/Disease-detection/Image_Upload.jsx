import React, { useEffect, useState } from 'react'
import DengueLeptoScreening from './DengueLeptoScreening'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function Image_Upload() {
  const [rashImage, setRashImage] = useState(null)
  const [rashPreview, setRashPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [screeningDisease, setScreeningDisease] = useState('')

  const [prediction, setPrediction] = useState({
    disease: '',
    confidence: '',
    status: 'No Prediction',
  })

  useEffect(() => {
    if (!rashImage) {
      setRashPreview('')
      return
    }

    const previewUrl = URL.createObjectURL(rashImage)
    setRashPreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [rashImage])

  const formatConfidence = (confidence) => {
    if (confidence === undefined || confidence === null) return ''
    return confidence <= 1 ? `${Math.round(confidence * 100)}%` : `${Math.round(confidence)}%`
  }

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setRashImage(file)
    setLoading(true)
    setError('')
    setScreeningDisease('')
    setPrediction({
      disease: '',
      confidence: '',
      status: 'Analyzing',
    })

    try {
      const formData = new FormData()
      formData.append('rashImage', file)

      const response = await fetch(`${API_URL}/api/predictions/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Prediction failed')
      }

      setPrediction({
        disease: data.predictedClass,
        confidence: formatConfidence(data.confidence),
        status: 'Prediction Complete',
      })
      const normalizedClass = String(data.predictedClass || '').toLowerCase()
      if (normalizedClass.includes('dengue')) {
        setScreeningDisease('dengue')
      } else if (normalizedClass.includes('leptospirosis')) {
        setScreeningDisease('leptospirosis')
      } else {
        setScreeningDisease('')
      }
    } catch (err) {
      setError(err.message)
      setPrediction({
        disease: '',
        confidence: '',
        status: 'Prediction Failed',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <DengueLeptoScreening
        disease={screeningDisease}
        open={Boolean(screeningDisease)}
        onClose={() => setScreeningDisease('')}
      />
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl bg-white p-6 shadow-xl">
          <h1 className="text-3xl font-bold text-slate-900">Rash Detection</h1>

          <p className="mt-2 text-sm text-slate-600">
            Upload a rash image to analyze a visible skin condition. Dengue and
            leptospirosis require symptom, exposure, and clinical assessment.
          </p>

          <div className="mt-8">
            <label className="mb-3 block text-sm font-semibold text-slate-700">
              Upload Rash Image
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm
              file:mr-4 file:rounded-xl file:border-0
              file:bg-blue-100 file:px-4 file:py-2
              file:font-semibold file:text-blue-700"
            />
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">
              <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
              <h2 className="mt-4 text-xl font-bold text-blue-900">
                Analyzing Rash Image...
              </h2>
              <p className="mt-2 text-sm text-blue-700">
                AI model is processing the uploaded image.
              </p>
            </div>
          )}
        </section>

        <aside className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-300">
            Live Detection Screen
          </p>

          <h2 className="mt-2 text-3xl font-bold">Prediction</h2>

          <div className="mt-6 rounded-2xl bg-white/10 p-4">
            {rashPreview ? (
              <img
                src={rashPreview}
                alt="Rash Preview"
                className="h-72 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/20 text-slate-400">
                No image uploaded
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-white/10 p-5">
            <p className="text-sm text-slate-300">Prediction Status</p>

            <p className="mt-2 text-xl font-bold text-emerald-400">
              {prediction.status}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Predicted Disease
                </p>
                <p className="mt-2 text-2xl font-bold">{prediction.disease}</p>
              </div>

              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Confidence
                </p>
                <p className="mt-2 text-2xl font-bold">{prediction.confidence}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Image_Upload
