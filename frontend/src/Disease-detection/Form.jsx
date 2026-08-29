import React, { useMemo, useState } from 'react'

const SYMPTOMS = [
  'Fever',
  'Headache',
  'Vomiting',
  'Diarrhea',
  'Skin rash',
  'Cough',
  'Breathing difficulty',
  'Fatigue',
  'Muscle pain',
  'Eye redness',
  'Abdominal pain',
  'Yellow eyes or skin',
  'Dark urine',
  'Reduced urination',
  'Wound redness or swelling',
  'Dizziness',
  'Confusion',
  'Chest pain',
]

const FLOOD_EXPOSURES = [
  'No direct flood exposure',
  'Contact with flood water',
  'Drank untreated water',
  'Ate food exposed to flood water',
  'Open wound touched flood water',
  'Stayed in crowded shelter',
  'Mosquito bites increased',
  'Contact with sewage or dirty water',
]

const RISK_FACTORS = [
  'Pregnant',
  'Age under 5',
  'Age over 65',
  'Diabetes',
  'Kidney disease',
  'Heart or lung disease',
  'Weakened immunity',
  'Unvaccinated or unknown tetanus status',
]

const URGENT_SYMPTOMS = [
  'Breathing difficulty',
  'Confusion',
  'Chest pain',
  'Reduced urination',
  'Yellow eyes or skin',
]

const DURATIONS = ['1-2 days', '3-5 days', '1 week', 'More than 1 week']
const SEVERITIES = ['Mild', 'Moderate', 'Severe']
const GENDERS = ['male', 'female', 'other']

const initialForm = {
  name: '',
  age: '',
  gender: '',
  location: '',
  selectedSymptoms: [],
  selectedExposures: [],
  riskFactors: [],
  duration: '1-2 days',
  severity: '',
  notes: '',
  consent: false,
}

function getRiskLevel({
  selectedSymptoms,
  selectedExposures,
  riskFactors,
  severity,
  duration,
}) {
  const symptomCount = selectedSymptoms.length
  const directExposures = selectedExposures.filter(
    (item) => item !== 'No direct flood exposure',
  )
  const exposureCount = directExposures.length

  const hasUrgentSymptom = selectedSymptoms.some((symptom) =>
    URGENT_SYMPTOMS.includes(symptom),
  )

  const hasHighRiskExposure =
    directExposures.includes('Open wound touched flood water') ||
    directExposures.includes('Contact with sewage or dirty water') ||
    directExposures.includes('Drank untreated water')

  const hasVulnerableRiskFactor = riskFactors.length > 0

  if (
    severity === 'Severe' ||
    hasUrgentSymptom ||
    (hasHighRiskExposure && symptomCount >= 2) ||
    (hasVulnerableRiskFactor && severity === 'Moderate') ||
    symptomCount >= 6 ||
    exposureCount >= 4
  ) {
    return 'High'
  }

  if (
    severity === 'Moderate' ||
    symptomCount >= 3 ||
    exposureCount >= 2 ||
    hasHighRiskExposure ||
    hasVulnerableRiskFactor ||
    duration === 'More than 1 week'
  ) {
    return 'Medium'
  }

  return symptomCount > 0 || exposureCount > 0 ? 'Low' : 'Not enough data'
}

function DiseaseDetectionForm() {
  const [formData, setFormData] = useState(initialForm)

  const [submitState, setSubmitState] = useState({
    loading: false,
    submitted: false,
    data: null,
    error: '',
  })

  const trimmedName = formData.name.trim()
  const trimmedLocation = formData.location.trim()
  const numericAge = Number(formData.age)

  const errors = useMemo(() => {
    const nextErrors = {}

    if (
      formData.age &&
      (!Number.isInteger(numericAge) || numericAge < 0 || numericAge > 120)
    ) {
      nextErrors.age = 'Enter a valid age between 0 and 120.'
    }

    if (formData.notes.length > 500) {
      nextErrors.notes = 'Keep notes under 500 characters.'
    }

    return nextErrors
  }, [formData.age, formData.notes.length, numericAge])

  const completion = useMemo(() => {
    const fields = [
      trimmedName,
      formData.age && !errors.age,
      formData.gender,
      trimmedLocation,
      formData.selectedSymptoms.length > 0,
      formData.selectedExposures.length > 0,
      formData.duration,
      formData.severity,
      formData.consent,
    ]

    return Math.round((fields.filter(Boolean).length / fields.length) * 100)
  }, [errors.age, formData, trimmedLocation, trimmedName])

  const riskLevel = useMemo(() => getRiskLevel(formData), [formData])

  const isReady =
    trimmedName &&
    formData.age &&
    !errors.age &&
    formData.gender &&
    trimmedLocation &&
    formData.selectedSymptoms.length > 0 &&
    formData.selectedExposures.length > 0 &&
    formData.severity &&
    formData.consent

  const setField = (name, value) => {
    setSubmitState((current) => ({
      ...current,
      error: '',
      submitted: false,
    }))

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleChange = ({ target }) => {
    const { name, value, type, checked } = target
    setField(name, type === 'checkbox' ? checked : value)
  }

  const toggleListItem = (fieldName, value) => {
    setSubmitState((current) => ({
      ...current,
      error: '',
      submitted: false,
    }))

    setFormData((current) => {
      const selected = current[fieldName].includes(value)
      const currentItems = current[fieldName]
      const isExposureField = fieldName === 'selectedExposures'

      if (isExposureField && value === 'No direct flood exposure') {
        return {
          ...current,
          selectedExposures: selected ? [] : [value],
        }
      }

      const filteredItems = isExposureField
        ? currentItems.filter((item) => item !== 'No direct flood exposure')
        : currentItems

      return {
        ...current,
        [fieldName]: selected
          ? filteredItems.filter((item) => item !== value)
          : [...filteredItems, value],
      }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isReady) {
      setSubmitState((current) => ({
        ...current,
        error: 'Complete the required fields before submitting.',
      }))
      return
    }

    setSubmitState({
      loading: true,
      submitted: false,
      data: null,
      error: '',
    })

    try {
      const payload = {
        ...formData,
        name: trimmedName,
        age: numericAge,
        location: trimmedLocation,
        riskLevel,
      }

      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

      const response = await fetch(`${API_BASE}/screening`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to submit screening right now.')
      }

      setSubmitState({
        loading: false,
        submitted: true,
        data: data || {
          riskLevel,
          recommendation:
            'Submission received. Follow local clinical guidance for next steps.',
        },
        error: '',
      })
    } catch (error) {
      setSubmitState({
        loading: false,
        submitted: false,
        data: null,
        error: error.message || 'Server error. Please try again.',
      })
    }
  }

  const resetForm = () => {
    setFormData(initialForm)
    setSubmitState({
      loading: false,
      submitted: false,
      data: null,
      error: '',
    })
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Health Screening
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                Flood Health Screening Form
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Record symptoms, flood exposure, and patient risk factors for
                preliminary post-flood health screening. This does not replace
                medical diagnosis.
              </p>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{completion}%</p>
              <p className="text-xs font-medium text-blue-700">Completed</p>
            </div>
          </header>

          <div
            className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Form completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>

          {submitState.error && (
            <Alert tone="error" title="Submission issue">
              {submitState.error}
            </Alert>
          )}

          {submitState.submitted && submitState.data && (
            <Alert tone="success" title="Screening submitted successfully">
              <span className="block">
                Risk Level: <strong>{submitState.data.riskLevel}</strong>
              </span>
              <span className="mt-1 block">
                {submitState.data.recommendation}
              </span>
            </Alert>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter name"
                required
              />

              <TextField
                label="Age"
                name="age"
                type="number"
                value={formData.age}
                onChange={handleChange}
                min="0"
                max="120"
                placeholder="Enter age"
                error={errors.age}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <fieldset>
                <legend className="mb-2 block font-medium">Gender</legend>

                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((gender) => (
                    <ChoicePill
                      key={gender}
                      label={gender}
                      selected={formData.gender === gender}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={gender}
                        checked={formData.gender === gender}
                        onChange={handleChange}
                        className="sr-only"
                      />
                    </ChoicePill>
                  ))}
                </div>
              </fieldset>

              <TextField
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter city"
                required
              />
            </div>

            <fieldset>
              <legend className="mb-3 flex w-full items-center justify-between gap-3">
                <span className="font-medium">Select Symptoms</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {formData.selectedSymptoms.length} selected
                </span>
              </legend>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SYMPTOMS.map((symptom) => {
                  const selected = formData.selectedSymptoms.includes(symptom)

                  return (
                    <button
                      key={symptom}
                      type="button"
                      onClick={() =>
                        toggleListItem('selectedSymptoms', symptom)
                      }
                      aria-pressed={selected}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                        selected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {symptom}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 flex w-full items-center justify-between gap-3">
                <span className="font-medium">Flood Exposure History</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {formData.selectedExposures.length} selected
                </span>
              </legend>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FLOOD_EXPOSURES.map((exposure) => {
                  const selected = formData.selectedExposures.includes(exposure)

                  return (
                    <button
                      key={exposure}
                      type="button"
                      onClick={() =>
                        toggleListItem('selectedExposures', exposure)
                      }
                      aria-pressed={selected}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                        selected
                          ? 'border-cyan-700 bg-cyan-700 text-white shadow-sm'
                          : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50'
                      }`}
                    >
                      {exposure}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 flex w-full items-center justify-between gap-3">
                <span className="font-medium">Risk Factors</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {formData.riskFactors.length} selected
                </span>
              </legend>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {RISK_FACTORS.map((factor) => {
                  const selected = formData.riskFactors.includes(factor)

                  return (
                    <button
                      key={factor}
                      type="button"
                      onClick={() => toggleListItem('riskFactors', factor)}
                      aria-pressed={selected}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                        selected
                          ? 'border-violet-700 bg-violet-700 text-white shadow-sm'
                          : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50'
                      }`}
                    >
                      {factor}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Symptom Duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                options={DURATIONS}
              />

              <SelectField
                label="Severity"
                name="severity"
                value={formData.severity}
                onChange={handleChange}
                options={SEVERITIES}
                placeholder="Select severity"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium" htmlFor="notes">
                Additional Notes
              </label>

              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                maxLength={500}
                placeholder="Write here..."
                className="h-28 w-full resize-none rounded-lg border border-slate-200 p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {errors.notes || 'Optional context for the screening team.'}
                </span>
                <span>{formData.notes.length}/500</span>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                name="consent"
                checked={formData.consent}
                onChange={handleChange}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-blue-600"
                required
              />

              <span className="text-sm font-medium">
                I agree to data usage for screening purposes.
              </span>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={!isReady || submitState.loading}
                className="min-h-12 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitState.loading ? 'Submitting...' : 'Submit Screening'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="min-h-12 w-full rounded-lg border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        <aside className="rounded-lg bg-slate-950 p-5 text-white sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
            Live Summary
          </p>

          <h2 className="mt-2 text-2xl font-bold">Patient Snapshot</h2>

          <div className="mt-6 space-y-3">
            <SummaryItem label="Name" value={formData.name || 'Not entered'} />
            <SummaryItem label="Age" value={formData.age || 'Not entered'} />
            <SummaryItem
              label="Gender"
              value={formData.gender || 'Not selected'}
            />
            <SummaryItem
              label="Location"
              value={formData.location || 'Not entered'}
            />
            <SummaryItem label="Duration" value={formData.duration} />

            <SummaryItem
              label="Symptoms"
              value={
                formData.selectedSymptoms.length
                  ? formData.selectedSymptoms.join(', ')
                  : 'None selected'
              }
            />

            <SummaryItem
              label="Flood exposure"
              value={
                formData.selectedExposures.length
                  ? formData.selectedExposures.join(', ')
                  : 'None selected'
              }
            />

            <SummaryItem
              label="Risk factors"
              value={
                formData.riskFactors.length
                  ? formData.riskFactors.join(', ')
                  : 'None selected'
              }
            />
          </div>

          <div className={`mt-6 rounded-lg p-4 ${riskClasses[riskLevel]}`}>
            <p className="text-sm opacity-80">Estimated Risk Level</p>
            <p className="mt-1 text-3xl font-bold">{riskLevel}</p>
          </div>
        </aside>
      </div>
    </main>
  )
}

const riskClasses = {
  High: 'bg-red-500/20 text-red-100',
  Medium: 'bg-amber-500/20 text-amber-100',
  Low: 'bg-emerald-500/20 text-emerald-100',
  'Not enough data': 'bg-white/10 text-slate-200',
}

function TextField({ label, error, required, ...inputProps }) {
  const id = inputProps.name

  return (
    <div>
      <label className="mb-1 block font-medium" htmlFor={id}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>

      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full rounded-lg border border-slate-200 p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        {...inputProps}
      />

      {error && (
        <p className="mt-1 text-sm text-red-600" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function SelectField({ label, options, placeholder, required, ...selectProps }) {
  return (
    <div>
      <label className="mb-1 block font-medium" htmlFor={selectProps.name}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>

      <select
        id={selectProps.name}
        required={required}
        className="w-full rounded-lg border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function ChoicePill({ children, label, selected }) {
  return (
    <label
      className={`min-h-11 cursor-pointer rounded-lg border p-3 text-center text-sm font-semibold capitalize transition ${
        selected
          ? 'border-blue-600 bg-blue-50 text-blue-700'
          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      {children}
      {label}
    </label>
  )
}

function Alert({ tone, title, children }) {
  const classes =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-red-200 bg-red-50 text-red-800'

  return (
    <div
      className={`mb-6 rounded-lg border p-4 text-sm ${classes}`}
      role="status"
    >
      <p className="font-bold">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-lg bg-white/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  )
}

export default DiseaseDetectionForm