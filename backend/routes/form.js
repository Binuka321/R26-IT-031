import express from 'express'

const router = express.Router()


// Symptoms that immediately increase screening priority
const emergencySymptoms = new Set([
  'Breathing difficulty',
  'Chest pain',
  'Confusion',
  'Reduced urination',
  'Yellow eyes or skin',
])

// Flood exposures considered important for screening
const significantExposures = new Set([
  'Drank untreated water',
  'Open wound touched flood water',
  'Waded through flood water',
  'Contact with contaminated water',
  'Ate food exposed to flood water',
  'Stayed in crowded shelter',
  'Mosquito bites increased',
])

function calculateRisk({
  selectedSymptoms = [],
  selectedExposures = [],
  selectedRiskFactors = [],
  severity = '',
  duration = '',
}) {
  const symptomCount = selectedSymptoms.length
  const riskFactorCount = selectedRiskFactors.length

  // Check emergency symptoms
  const hasEmergencySymptom = selectedSymptoms.some((symptom) =>
    emergencySymptoms.has(symptom)
  )

  // Count significant flood exposures
  const significantExposureCount = selectedExposures.filter((exposure) =>
    significantExposures.has(exposure)
  ).length

  // Check duration
  const longDuration =
    duration === 'More than 1 week' ||
    duration === '1 week or more'


  if (
    severity === 'Severe' ||
    hasEmergencySymptom ||
    symptomCount >= 6 ||
    (significantExposureCount >= 2 && symptomCount >= 2)
  ) {
    return {
      riskLevel: 'High',
      recommendation:
        'Prompt medical assessment is recommended based on the screening information provided.',
    }
  }

  if (
    severity === 'Moderate' ||
    symptomCount >= 3 ||
    longDuration ||
    significantExposureCount >= 1 ||
    riskFactorCount >= 1
  ) {
    return {
      riskLevel: 'Medium',
      recommendation:
        'Monitor symptoms closely and consider seeking medical advice if symptoms continue or worsen.',
    }
  }

  if (symptomCount > 0) {
    return {
      riskLevel: 'Low',
      recommendation:
        'Continue monitoring symptoms and seek medical attention if symptoms persist or worsen.',
    }
  }

  return {
    riskLevel: 'Not enough data',
    recommendation:
      'Please provide symptom information to complete the screening.',
  }
}


function validateScreening(body) {
  const errors = []

  // Name
  if (!body.name?.trim()) {
    errors.push('Name is required.')
  }

  // Age
  const age = Number(body.age)

  if (
    body.age === undefined ||
    body.age === null ||
    body.age === '' ||
    Number.isNaN(age) ||
    age < 0 ||
    age > 120
  ) {
    errors.push('Age must be between 0 and 120.')
  }

  // Gender
  if (!body.gender) {
    errors.push('Gender is required.')
  }

  // Location
  if (!body.location?.trim()) {
    errors.push('Location is required.')
  }

  // Symptoms
  if (
    !Array.isArray(body.selectedSymptoms) ||
    body.selectedSymptoms.length === 0
  ) {
    errors.push('At least one symptom is required.')
  }

  // Exposures - optional
  if (
    body.selectedExposures !== undefined &&
    !Array.isArray(body.selectedExposures)
  ) {
    errors.push('Flood exposure data must be an array.')
  }

  // Risk factors - optional
  if (
    body.selectedRiskFactors !== undefined &&
    !Array.isArray(body.selectedRiskFactors)
  ) {
    errors.push('Risk factor data must be an array.')
  }

  // Severity
  if (!body.severity) {
    errors.push('Severity is required.')
  }

  // Consent
  if (!body.consent) {
    errors.push('Consent is required.')
  }

  return errors
}

router.post('/screening', (req, res) => {
  try {
    // Validate request
    const errors = validateScreening(req.body)

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' '),
        errors,
      })
    }

    // Calculate risk once
    const riskResult = calculateRisk({
      selectedSymptoms: req.body.selectedSymptoms || [],
      selectedExposures: req.body.selectedExposures || [],
      selectedRiskFactors: req.body.selectedRiskFactors || [],
      severity: req.body.severity || '',
      duration: req.body.duration || '',
    })

    // Build screening record
    const screening = {
      id: Date.now().toString(),

      patient: {
        name: req.body.name.trim(),
        age: Number(req.body.age),
        gender: req.body.gender,
        location: req.body.location.trim(),
      },

      symptoms: req.body.selectedSymptoms || [],

      exposures: req.body.selectedExposures || [],

      riskFactors: req.body.selectedRiskFactors || [],

      duration: req.body.duration || '',

      severity: req.body.severity,

      notes: req.body.notes?.trim() || '',

      consent: Boolean(req.body.consent),

      createdAt: new Date().toISOString(),

      riskLevel: riskResult.riskLevel,

      recommendation: riskResult.recommendation,
    }

    console.log('\n====================================')
    console.log('NEW SCREENING SUBMISSION')
    console.log('====================================')
    console.log('Patient:', screening.patient.name)
    console.log('Age:', screening.patient.age)
    console.log('Symptoms:', screening.symptoms)
    console.log('Exposures:', screening.exposures)
    console.log('Risk Factors:', screening.riskFactors)
    console.log('Severity:', screening.severity)
    console.log('Duration:', screening.duration)
    console.log('Risk Level:', screening.riskLevel)
    console.log('====================================\n')

    return res.status(201).json({
      success: true,
      message: 'Screening submitted successfully.',
      ...screening,
    })
  } catch (error) {
    console.error('Screening submission error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to submit screening right now.',
    })
  }
})


router.get('/screening/test', (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Screening API is working.',
  })
})

export default router