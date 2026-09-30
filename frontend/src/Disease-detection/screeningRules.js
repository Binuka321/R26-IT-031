
export const warningSigns = {
  dengue: ['severeAbdominalPain', 'persistentVomiting', 'noseGumBloodVomiting', 'bloodInStool', 'weakRestlessSleepy', 'difficultyBreathing'],
  leptospirosis: ['unusualBleeding', 'littleNoUrine', 'difficultyBreathing', 'confusionDrowsinessBehavior'],
}

export function evaluateScreening(disease, answers = {}) {
  if (!warningSigns[disease]) throw new Error('Unsupported screening disease')
  const yes = (id) => answers[id] === 'yes'
  const urgent = warningSigns[disease].some(yes)
  const result = (category, interpretation, recommendation) => ({ category, interpretation, recommendation, urgent })
  if (disease === 'dengue') {
    const fever = yes('suddenHighFever')
    const typicalCount = ['severeHeadache', 'painBehindEyes', 'muscleBoneJointPain', 'nauseaVomiting', 'extremeTiredness'].filter(yes).length
    if (urgent) return result('urgent', fever && typicalCount >= 2 ? 'Possible dengue with warning sign' : 'Urgent assessment required', 'Seek urgent medical care immediately. Do not wait for additional symptoms. Warning signs can require hospital-based assessment and do not by themselves identify dengue.')
    if (fever && typicalCount >= 2) return result('compatible', 'Possible dengue symptom pattern', 'Dengue should be considered and medical evaluation is recommended. Rest and maintain adequate hydration. Paracetamol/acetaminophen may be used according to appropriate label or clinician dosing; avoid aspirin and ibuprofen because they can increase bleeding risk.')
    if (fever && typicalCount === 1) return result('insufficient', 'Possible, but insufficient for dengue pattern', 'Dengue cannot be determined from these symptoms alone. Rest and maintain adequate fluid intake. Consider contacting a healthcare professional, especially if symptoms continue or worsen.')
    if (fever) return result('fever-only', 'Low indication', 'Fever alone is not enough to indicate dengue. Rest, drink adequate fluids, and monitor your temperature and other symptoms. If fever persists or additional symptoms develop, consult a healthcare professional.')
    return result('low', 'Low indication', 'Dengue is not strongly indicated by this reported symptom pattern, but cannot be ruled out. Maintain normal hydration and monitor for new symptoms. If fever develops, symptoms persist, or symptoms worsen, seek medical advice.')
  }
  const fever = yes('suddenFever')
  const headache = yes('severeHeadache')
  const musclePain = yes('musclePain') || yes('calfLowerBackPain')

  const count = ['suddenFever', 'severeHeadache', 'nauseaVomiting', 'chills', 'extremeTiredness', 'abdominalPain'].filter(yes).length + Number(musclePain)
  if (urgent) return result('urgent', 'Urgent medical assessment', 'Seek urgent medical care immediately. Very little or no urine, difficulty breathing, unusual bleeding, or confusion/severe drowsiness can indicate serious complications requiring urgent assessment and potentially hospital-based treatment. These signs need assessment even without a leptospirosis-compatible pattern.')
  if (fever && headache && musclePain && yes('relevantExposure')) return result('exposure', 'Higher clinical suspicion — medical assessment recommended', 'Seek medical care promptly and mention the exposure history. Fever, muscle pain, headache, and relevant environmental exposure increase clinical suspicion. Early treatment can reduce disease severity when leptospirosis is suspected; a healthcare professional should decide on testing and treatment.')
  if (fever && headache && musclePain && yes('chills')) return result('higher', 'Higher compatibility', 'Arrange medical assessment as soon as possible. This is a stronger leptospirosis-compatible symptom pattern. Tell the healthcare professional when symptoms started and whether you had recent floodwater, soil, or animal exposure.')
  if (fever && headache && yes('calfLowerBackPain')) return result('characteristic', 'Leptospirosis-compatible symptom pattern', 'Seek medical assessment promptly. This combination is compatible with the typical early presentation of leptospirosis, particularly after possible exposure to contaminated water or soil. A healthcare professional can decide whether testing and treatment are appropriate.')
  if (count >= 3) return result('generic', 'Low–moderate compatibility', 'Consider a medical evaluation if symptoms persist. These symptoms can occur with many infections; leptospirosis cannot be determined from symptoms alone. Mention any recent floodwater, wet-soil, or animal exposure to the healthcare professional.')
  if (count === 2) return result('two', 'Low compatibility', 'Continue monitoring and consider medical advice. Two symptoms alone do not strongly indicate leptospirosis or rule it out. If fever, muscle pain, chills, or other compatible symptoms appear—especially after floodwater or contaminated-water exposure—contact a healthcare professional.')
  if (count === 1) return result('one', 'Low compatibility', 'Monitor your symptoms. A single symptom such as headache or tiredness is not specific to leptospirosis. Stay hydrated and monitor for additional symptoms. If symptoms worsen or new symptoms develop, seek medical advice.')
  return result('none', 'Low compatibility', 'No symptoms were reported. Monitor for new symptoms, particularly after contact with floodwater, contaminated water, wet soil, or animals. Seek medical advice if symptoms develop. This screening cannot rule out infection.')
}
