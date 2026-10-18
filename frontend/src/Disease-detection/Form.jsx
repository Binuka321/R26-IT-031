
import { useMemo } from 'react';
import { useState } from 'react';
import { useRef } from 'react';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3002'
).replace(/\/+$/, '');

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
];

const FLOOD_EXPOSURES = [
  'No direct flood exposure',
  'Contact with flood water',
  'Drank untreated water',
  'Ate food exposed to flood water',
  'Open wound touched flood water',
  'Stayed in crowded shelter',
  'Mosquito bites increased',
  'Contact with sewage or dirty water',
];

const RISK_FACTORS = [
  'Pregnant',
  'Age under 5',
  'Age over 65',
  'Diabetes',
  'Kidney disease',
  'Heart or lung disease',
  'Weakened immunity',
  'Unvaccinated or unknown tetanus status',
];

const DURATIONS = [
  '1-2 days',
  '3-5 days',
  '1 week',
  'More than 1 week',
];

const GENDERS = ['male', 'female', 'other'];

const createInitialForm = () => ({
  name: '',
  age: '',
  gender: '',
  location: '',
  selectedSymptoms: [],
  selectedExposures: [],
  riskFactors: [],
  duration: '1-2 days',
  notes: '',
  consent: false,
});

const riskClasses = {
  High: 'bg-red-500/20 text-red-100',
  Medium: 'bg-amber-500/20 text-amber-100',
  Low: 'bg-emerald-500/20 text-emerald-100',
  'Not enough data': 'bg-white/10 text-slate-200',
};

function DiseaseDetectionForm() {
  const requestVersion = useRef(0);

  const [formData, setFormData] = useState(
    createInitialForm
  );

  const [submitState, setSubmitState] = useState({
    loading: false,
    submitted: false,
    data: null,
    error: '',
  });

  const trimmedName = formData.name.trim();
  const trimmedLocation = formData.location.trim();
  const numericAge = Number(formData.age);

  // Validate form inputs
  const errors = useMemo(() => {
    const nextErrors = {};

    if (
      formData.age &&
      (
        !Number.isInteger(numericAge) ||
        numericAge < 0 ||
        numericAge > 120
      )
    ) {
      nextErrors.age =
        'Enter a valid age between 0 and 120.';
    }

    if (formData.notes.length > 500) {
      nextErrors.notes =
        'Keep notes under 500 characters.';
    }

    return nextErrors;
  }, [
    formData.age,
    formData.notes,
    numericAge,
  ]);

  // Calculate completion percentage
  const completion = useMemo(() => {
    const fields = [
      trimmedName,
      formData.age && !errors.age,
      formData.gender,
      trimmedLocation,
      formData.selectedSymptoms.length > 0,
      formData.selectedExposures.length > 0,
      formData.duration,
      formData.consent,
    ];

    return Math.round(
      (fields.filter(Boolean).length / fields.length) *
        100
    );
  }, [
    errors.age,
    formData,
    trimmedLocation,
    trimmedName,
  ]);

  const riskLevel =
    submitState.data?.riskLevel ||
    'Not enough data';

  const isReady = Boolean(
    trimmedName &&
    formData.age &&
    !errors.age &&
    formData.gender &&
    trimmedLocation &&
    formData.selectedSymptoms.length > 0 &&
    formData.selectedExposures.length > 0 &&
    formData.consent
  );

  // Clear old prediction when any field changes
  const invalidatePrediction = () => {
    requestVersion.current += 1;

    setSubmitState({
      loading: false,
      submitted: false,
      data: null,
      error: '',
    });
  };

  const setField = (name, value) => {
    invalidatePrediction();

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleChange = ({ target }) => {
    const {
      name,
      value,
      type,
      checked,
    } = target;

    setField(
      name,
      type === 'checkbox' ? checked : value
    );
  };

  // Select or deselect symptoms, exposures, and risks
  const toggleListItem = (fieldName, value) => {
    invalidatePrediction();

    setFormData((current) => {
      const selected =
        current[fieldName].includes(value);

      const currentItems = current[fieldName];

      const isExposureField =
        fieldName === 'selectedExposures';

      if (
        isExposureField &&
        value === 'No direct flood exposure'
      ) {
        return {
          ...current,
          selectedExposures: selected
            ? []
            : [value],
        };
      }

      const filteredItems = isExposureField
        ? currentItems.filter(
            (item) =>
              item !== 'No direct flood exposure'
          )
        : currentItems;

      return {
        ...current,
        [fieldName]: selected
          ? filteredItems.filter(
              (item) => item !== value
            )
          : [...filteredItems, value],
      };
    });
  };

  // Submit symptom screening
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isReady) {
      setSubmitState((current) => ({
        ...current,
        error:
          'Complete the required fields before submitting.',
      }));

      return;
    }

    setSubmitState({
      loading: true,
      submitted: false,
      data: null,
      error: '',
    });

    const version = ++requestVersion.current;

    try {
      const payload = {
        age: numericAge,
        gender: formData.gender,
        duration: formData.duration,
        selectedSymptoms:
          formData.selectedSymptoms,
        selectedExposures:
          formData.selectedExposures,
        riskFactors: formData.riskFactors,
        consent: formData.consent,
      };

      const response = await fetch(
        `${API_URL}/api/screening`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(65000),
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (version !== requestVersion.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          'Unable to submit screening right now.'
        );
      }

      // Validate prediction returned by backend
      if (
        data?.success !== true ||
        !['Low', 'Medium', 'High'].includes(
          data?.riskLevel
        ) ||
        typeof data?.recommendation !== 'string'
      ) {
        throw new Error(
          'Server returned an invalid prediction.'
        );
      }

      // Show recommendation popup
      setSubmitState({
        loading: false,
        submitted: true,
        data,
        error: '',
      });

      // Automatically clear form after submission
      setFormData(createInitialForm());

    } catch (error) {
      if (version !== requestVersion.current) {
        return;
      }

      setSubmitState({
        loading: false,
        submitted: false,
        data: null,
        error:
          error.message ||
          'Server error. Please try again.',
      });
    }
  };

  // Reset entire form
  const resetForm = () => {
    requestVersion.current += 1;

    setFormData(createInitialForm());

    setSubmitState({
      loading: false,
      submitted: false,
      data: null,
      error: '',
    });
  };

  // Close recommendation popup
  const closeRecommendation = () => {
    setSubmitState((current) => ({
      ...current,
      submitted: false,
      data: null,
    }));
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">

      {/* RECOMMENDATION POPUP */}
      {submitState.submitted &&
        submitState.data && (
          <RecommendationModal
            data={submitState.data}
            onClose={closeRecommendation}
          />
        )}

      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.35fr_0.85fr]">

        {/* LEFT SIDE - FORM */}
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
                Record symptoms, flood exposure,
                and patient risk factors for an
                educational flood-risk model demo.
                This model uses synthetic training
                data and is not validated for
                patient decisions.
              </p>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-center">

              <p className="text-2xl font-bold text-blue-700">
                {completion}%
              </p>

              <p className="text-xs font-medium text-blue-700">
                Completed
              </p>

            </div>
          </header>

          {/* PROGRESS BAR */}
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
              style={{
                width: `${completion}%`,
              }}
            />
          </div>

          {/* ERROR MESSAGE */}
          {submitState.error && (
            <Alert
              tone="error"
              title="Submission issue"
            >
              {submitState.error}
            </Alert>
          )}

          <form
            className="space-y-6"
            onSubmit={handleSubmit}
            noValidate
          >

            {/* NAME AND AGE */}
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

            {/* GENDER AND LOCATION */}
            <div className="grid gap-4 md:grid-cols-2">

              <fieldset>
                <legend className="mb-2 block font-medium">
                  Gender
                </legend>

                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((gender) => (
                    <ChoicePill
                      key={gender}
                      label={gender}
                      selected={
                        formData.gender === gender
                      }
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={gender}
                        checked={
                          formData.gender === gender
                        }
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

            {/* SYMPTOMS */}
            <fieldset>

              <legend className="mb-3 flex w-full items-center justify-between gap-3">

                <span className="font-medium">
                  Select Symptoms
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {formData.selectedSymptoms.length}{' '}
                  selected
                </span>

              </legend>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

                {SYMPTOMS.map((symptom) => {
                  const selected =
                    formData.selectedSymptoms.includes(
                      symptom
                    );

                  return (
                    <button
                      key={symptom}
                      type="button"
                      onClick={() =>
                        toggleListItem(
                          'selectedSymptoms',
                          symptom
                        )
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
                  );
                })}

              </div>
            </fieldset>

            {/* FLOOD EXPOSURE HISTORY */}
            <fieldset>

              <legend className="mb-3 flex w-full items-center justify-between gap-3">

                <span className="font-medium">
                  Flood Exposure History
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {formData.selectedExposures.length}{' '}
                  selected
                </span>

              </legend>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                {FLOOD_EXPOSURES.map((exposure) => {
                  const selected =
                    formData.selectedExposures.includes(
                      exposure
                    );

                  return (
                    <button
                      key={exposure}
                      type="button"
                      onClick={() =>
                        toggleListItem(
                          'selectedExposures',
                          exposure
                        )
                      }
                      aria-pressed={selected}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                        selected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {exposure}
                    </button>
                  );
                })}

              </div>
            </fieldset>

            {/* RISK FACTORS */}
            <fieldset>

              <legend className="mb-3 flex w-full items-center justify-between gap-3">

                <span className="font-medium">
                  Risk Factors
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {formData.riskFactors.length}{' '}
                  selected
                </span>

              </legend>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                {RISK_FACTORS.map((factor) => {
                  const selected =
                    formData.riskFactors.includes(
                      factor
                    );

                  return (
                    <button
                      key={factor}
                      type="button"
                      onClick={() =>
                        toggleListItem(
                          'riskFactors',
                          factor
                        )
                      }
                      aria-pressed={selected}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                        selected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {factor}
                    </button>
                  );
                })}

              </div>
            </fieldset>

            {/* SYMPTOM DURATION */}
            <SelectField
              label="Symptom Duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              options={DURATIONS}
            />

            {/* ADDITIONAL NOTES */}
            <div>

              <label
                className="mb-1 block font-medium"
                htmlFor="notes"
              >
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
                  {errors.notes ||
                    'Optional context for the screening team.'}
                </span>

                <span>
                  {formData.notes.length}/500
                </span>

              </div>
            </div>

            {/* CONSENT */}
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
                I agree to data usage for
                screening purposes.
              </span>

            </label>

            {/* SUBMIT AND RESET BUTTONS */}
            <div className="flex flex-col gap-3 sm:flex-row">

              <button
                type="submit"
                disabled={
                  !isReady ||
                  submitState.loading
                }
                className="min-h-12 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitState.loading
                  ? 'Submitting...'
                  : 'Submit Screening'}
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

        {/* RIGHT SIDE - LIVE SUMMARY */}
        <aside className="rounded-lg bg-slate-950 p-5 text-white sm:p-6">

          <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
            Live Summary
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Patient Snapshot
          </h2>

          <div className="mt-6 space-y-3">

            <SummaryItem
              label="Name"
              value={
                formData.name || 'Not entered'
              }
            />

            <SummaryItem
              label="Age"
              value={
                formData.age || 'Not entered'
              }
            />

            <SummaryItem
              label="Gender"
              value={
                formData.gender || 'Not selected'
              }
            />

            <SummaryItem
              label="Location"
              value={
                formData.location || 'Not entered'
              }
            />

            <SummaryItem
              label="Symptom Duration"
              value={
                formData.duration || 'Not selected'
              }
            />

            <SummaryItem
              label="Symptoms"
              value={
                formData.selectedSymptoms.length
                  ? formData.selectedSymptoms.join(', ')
                  : 'None selected'
              }
            />

            <SummaryItem
              label="Flood Exposure"
              value={
                formData.selectedExposures.length
                  ? formData.selectedExposures.join(', ')
                  : 'None selected'
              }
            />

            <SummaryItem
              label="Risk Factors"
              value={
                formData.riskFactors.length
                  ? formData.riskFactors.join(', ')
                  : 'None selected'
              }
            />

          </div>

          {/* RISK LEVEL */}
          <div
            className={`mt-6 rounded-lg p-4 ${
              riskClasses[riskLevel]
            }`}
          >

            <p className="text-sm opacity-80">
              Model Risk Label
            </p>

            <p className="mt-1 text-3xl font-bold">
              {submitState.data
                ? riskLevel
                : 'Submit to predict'}
            </p>

          </div>

        </aside>

      </div>
    </main>
  );
}

// TEXT INPUT COMPONENT
function TextField({
  label,
  error,
  required,
  ...inputProps
}) {
  const id = inputProps.name;

  return (
    <div>
      <label
        className="mb-1 block font-medium"
        htmlFor={id}
      >
        {label}

        {required && (
          <span className="text-red-600">
            {' '}*
          </span>
        )}
      </label>

      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : undefined
        }
        className="w-full rounded-lg border border-slate-200 p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        {...inputProps}
      />

      {error && (
        <p
          className="mt-1 text-sm text-red-600"
          id={`${id}-error`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// DROPDOWN COMPONENT
function SelectField({
  label,
  options,
  placeholder,
  required,
  ...selectProps
}) {
  return (
    <div>
      <label
        className="mb-1 block font-medium"
        htmlFor={selectProps.name}
      >
        {label}

        {required && (
          <span className="text-red-600">
            {' '}*
          </span>
        )}
      </label>

      <select
        id={selectProps.name}
        required={required}
        className="w-full rounded-lg border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        {...selectProps}
      >
        {placeholder && (
          <option value="">
            {placeholder}
          </option>
        )}

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

// GENDER SELECTION COMPONENT
function ChoicePill({
  children,
  label,
  selected,
}) {
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
  );
}

// ERROR ALERT COMPONENT
function Alert({
  tone,
  title,
  children,
}) {
  const classes =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-red-200 bg-red-50 text-red-800';

  return (
    <div
      className={`mb-6 rounded-lg border p-4 text-sm ${classes}`}
      role="status"
    >
      <p className="font-bold">
        {title}
      </p>

      <div className="mt-2">
        {children}
      </div>
    </div>
  );
}

// RECOMMENDATION POPUP COMPONENT
function RecommendationModal({
  data,
  onClose,
}) {
  const riskTone = {
    High:
      'border-red-300 bg-red-50 text-red-900',

    Medium:
      'border-amber-300 bg-amber-50 text-amber-900',

    Low:
      'border-emerald-300 bg-emerald-50 text-emerald-900',

    'Not enough data':
      'border-slate-300 bg-slate-50 text-slate-900',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4">

      <div
        className="mx-auto mt-[10vh] w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-title"
      >

        <div className="flex items-start justify-between gap-4">

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Model prediction received
            </p>

            <h2
              id="recommendation-title"
              className="mt-2 text-2xl font-bold text-slate-950"
            >
              Educational Model Result
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xl font-bold text-slate-600 hover:bg-slate-50"
            aria-label="Close recommendation"
          >
            ×
          </button>

        </div>

        {/* PREDICTED RISK LEVEL */}
        <div
          className={`mt-5 rounded-xl border p-4 ${
            riskTone[data.riskLevel] ||
            riskTone['Not enough data']
          }`}
        >

          <p className="text-sm font-semibold">
            Model Risk Label
          </p>

          <p className="mt-1 text-3xl font-bold">
            {data.riskLevel}
          </p>

        </div>

        {/* MEDICAL RECOMMENDATION */}
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">

          <p className="text-sm font-bold">
            Recommendation
          </p>

          <p className="mt-2 text-sm leading-6">
            {data.recommendation}
          </p>

        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          This screening does not replace an
          examination or diagnosis by a qualified
          medical professional.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700"
        >
          Close
        </button>

      </div>
    </div>
  );
}

// LIVE SUMMARY COMPONENT
function SummaryItem({
  label,
  value,
}) {
  return (
    <div className="rounded-lg bg-white/10 p-4">

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-white">
        {value}
      </p>

    </div>
  );
}

// NAMED EXPORT
export { DiseaseDetectionForm };
