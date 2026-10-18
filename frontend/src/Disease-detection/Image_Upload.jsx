
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';

import { DengueLeptoScreening } from './DengueLeptoScreening';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3002'
).replace(/\/+$/, '');

function Image_Upload() {
  const [rashImage, setRashImage] = useState(null);
  const [rashPreview, setRashPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [screeningDisease, setScreeningDisease] = useState('');

  const requestRef = useRef(null);

  const [prediction, setPrediction] = useState({
    disease: '',
    status: 'No Prediction',
  });

  // Generate an image preview and release the old URL
  useEffect(() => {
    if (!rashImage) {
      setRashPreview('');
      return;
    }

    const previewUrl = URL.createObjectURL(rashImage);

    setRashPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [rashImage]);

  // Cancel an outstanding request when component unmounts
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  // Format disease prediction for display
  const formatDisplayResult = (predictedClass) => {
    const normalizedClass = String(
      predictedClass || ''
    ).trim().toLowerCase();

    if (normalizedClass === 'dengue') {
      return 'Could be Dengue';
    }

    if (normalizedClass === 'leptospirosis') {
      return 'Could be Leptospirosis';
    }

    return predictedClass || '';
  };

  // Handle image selection and ML prediction
  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Cancel previous image request
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setRashImage(file);
    setLoading(true);
    setError('');
    setScreeningDisease('');

    setPrediction({
      disease: '',
      status: 'Analyzing',
    });

    try {
      const formData = new FormData();

      formData.append('rashImage', file);

      const response = await fetch(
        `${API_URL}/api/predictions/upload`,
        {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          'Prediction failed'
        );
      }

      if (controller.signal.aborted) {
        return;
      }

      const predictedClass = String(
        data.predictedClass || ''
      ).trim();

      if (!predictedClass) {
        throw new Error(
          'The server did not return a prediction.'
        );
      }

      const normalizedClass =
        predictedClass.toLowerCase();

      // Display prediction without confidence percentage
      setPrediction({
        disease: formatDisplayResult(predictedClass),
        status: 'Analysis Complete',
      });

      // Open dengue follow-up questionnaire
      if (normalizedClass === 'dengue') {
        setScreeningDisease('dengue');
      }

      // Open leptospirosis follow-up questionnaire
      else if (normalizedClass === 'leptospirosis') {
        setScreeningDisease('leptospirosis');
      }

      // Other skin conditions do not open these questionnaires
      else {
        setScreeningDisease('');
      }

      // Notify dashboard and analytics to refresh
      window.dispatchEvent(
        new Event('screening-updated')
      );

    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        err.message || 'Image analysis failed.'
      );

      setPrediction({
        disease: '',
        status: 'Analysis Failed',
      });

    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }

      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  };

  // Close questionnaire
  const closeScreening = () => {
    setScreeningDisease('');
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">

      {/* DENGUE OR LEPTOSPIROSIS QUESTIONNAIRE */}
      <DengueLeptoScreening
        key={screeningDisease}
        disease={screeningDisease}
        open={Boolean(screeningDisease)}
        onClose={closeScreening}
      />

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1fr]">

        {/* LEFT SECTION - IMAGE UPLOAD */}
        <section className="rounded-3xl bg-white p-6 shadow-xl">

          <h1 className="text-3xl font-bold text-slate-900">
            Rash &amp; Disease Detection
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Upload a rash image to analyze a visible
            skin condition. Dengue and leptospirosis
            require symptom, exposure, and clinical
            assessment.
          </p>

          {/* IMAGE UPLOAD INPUT */}
          <div className="mt-8">

            <label
              htmlFor="rashImage"
              className="mb-3 block text-sm font-semibold text-slate-700"
            >
              Upload Rash Image
            </label>

            <input
              id="rashImage"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={loading}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:font-semibold file:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            />

          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {/* LOADING INDICATOR */}
          {loading && (
            <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">

              <div
                className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
                role="status"
                aria-label="Analyzing image"
              />

              <h2 className="mt-4 text-xl font-bold text-blue-900">
                Analyzing Rash Image...
              </h2>

              <p className="mt-2 text-sm text-blue-700">
                AI model is processing the uploaded image.
              </p>

            </div>
          )}

          {/* INFORMATION MESSAGE */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">

            <h3 className="text-sm font-bold text-slate-800">
              Important Information
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Image analysis is a preliminary screening
              tool and cannot provide a confirmed
              medical diagnosis. Please consult a
              qualified healthcare professional for
              appropriate assessment and treatment.
            </p>

          </div>

        </section>

        {/* RIGHT SECTION - PREDICTION */}
        <aside className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">

          <p className="text-sm font-semibold uppercase tracking-widest text-sky-300">
            Live Detection Screen
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Prediction
          </h2>

          {/* IMAGE PREVIEW */}
          <div className="mt-6 rounded-2xl bg-white/10 p-4">

            {rashPreview ? (
              <img
                src={rashPreview}
                alt="Uploaded rash preview"
                className="h-72 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/20 text-slate-400">
                No image uploaded
              </div>
            )}

          </div>

          {/* PREDICTION DETAILS */}
          <div className="mt-6 rounded-2xl bg-white/10 p-5">

            <p className="text-sm text-slate-300">
              Prediction Status
            </p>

            <p
              className={`mt-2 text-xl font-bold ${
                prediction.status === 'Analysis Failed'
                  ? 'text-red-400'
                  : prediction.status === 'Analysis Complete'
                  ? 'text-emerald-400'
                  : 'text-sky-300'
              }`}
            >
              {prediction.status}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <div className="rounded-xl bg-white/5 p-4">

                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Screening Result
                </p>

                <p className="mt-2 break-words text-2xl font-bold">
                  {prediction.disease ||
                    'No result available'}
                </p>

              </div>

            </div>

          </div>

          {/* SCREENING DISCLAIMER */}
          <p className="mt-5 text-xs leading-5 text-slate-400">
            This model provides preliminary image
            screening indicators only. Dengue and
            leptospirosis cannot be confirmed or
            ruled out using a rash image.
          </p>

        </aside>

      </div>
    </div>
  );
}

// NAMED EXPORT
export { Image_Upload };
