import React, { useState } from 'react'

const SCREENINGS = {
  dengue: {
    title: 'Dengue follow-up questions',
    questions: [
      ['suddenHighFever', 'Do you have a sudden high fever?'],
      ['severeHeadache', 'Do you have a severe headache?'],
      ['painBehindEyes', 'Do you have pain behind the eyes?'],
      ['muscleBoneJointPain', 'Do you have muscle, bone, or joint pain (sometimes called “breakbone fever”)?'],
      ['nauseaVomiting', 'Do you have nausea or vomiting?'],
      ['extremeTiredness', 'Do you have extreme tiredness or weakness?'],
      ['severeAbdominalPain', 'Do you have severe or persistent abdominal pain?', true],
      ['persistentVomiting', 'Do you have repeated or persistent vomiting?', true],
      ['noseGumBloodVomiting', 'Do you have bleeding from the nose or gums, or are you vomiting blood?', true],
      ['bloodInStool', 'Do you have blood in the stool or black/tarry stool?', true],
      ['weakRestlessSleepy', 'Do you have extreme weakness, restlessness, or unusual sleepiness?', true],
      ['difficultyBreathing', 'Do you have difficulty breathing?', true],
    ],
    advice: [
      'Arrange an in-person medical assessment today; laboratory testing is required to confirm dengue.',
      'Rest and drink oral fluids if you can do so safely; monitor urine output.',
      'Avoid aspirin, ibuprofen, and other NSAIDs because they can increase bleeding risk.',
      'Use mosquito protection while febrile.',
    ],
  },
  leptospirosis: {
    title: 'Leptospirosis follow-up questions',
    questions: [
      ['suddenFever', 'Do you have a sudden fever?'],
      ['severeHeadache', 'Do you have a severe headache?'],
      ['calfLowerBackPain', 'Do you have strong muscle aches, especially in the calves or lower back?'],
      ['nauseaVomiting', 'Do you have nausea or vomiting?'],
      ['chills', 'Do you have chills?'],
      ['extremeTiredness', 'Do you have extreme tiredness?'],
      ['abdominalPain', 'Do you have abdominal pain?'],
      ['unusualBleeding', 'Do you have unusual bleeding?', true],
      ['littleNoUrine', 'Are you passing very little or no urine?', true],
      ['difficultyBreathing', 'Do you have difficulty breathing?', true],
      ['confusionDrowsinessBehavior', 'Do you have confusion, severe drowsiness, or unusual behavior?', true],
    ],
    advice: [
      'Arrange an urgent in-person medical assessment today, blood or urine testing may be needed.',
      'Do not start antibiotics on your own, treatment must be directed by a clinician.',
      'Drink oral fluids if you can do so safely and monitor urine output.',
      'Avoid further contact with floodwater, contaminated soil, and possible animal urine.',
    ],
  },
}

function DengueLeptoScreening({ disease, open, onClose }) {
  const screening = SCREENINGS[disease]
  const [answers, setAnswers] = useState({})
  const [showResult, setShowResult] = useState(false)

  if (!open || !screening) return null

  const unanswered = screening.questions.filter(([id]) => !answers[id]).length
  const yesCount = screening.questions.filter(([id]) => answers[id] === 'yes').length
  const urgent = screening.questions.some(
    ([id, , isUrgent]) => isUrgent && answers[id] === 'yes',
  )

  const close = () => {
    setAnswers({})
    setShowResult(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4">
      <div className="mx-auto my-4 w-full max-w-3xl rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="follow-up-title">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b bg-white p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Prediction follow-up</p>
            <h2 id="follow-up-title" className="mt-1 text-2xl font-bold text-slate-950">{screening.title}</h2>
            <p className="mt-2 text-sm text-slate-600">Answer every question. This screening does not confirm a diagnosis.</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg border px-3 py-2 font-bold text-slate-600" aria-label="Close screening">×</button>
        </header>

        <div className="p-5">
          {!showResult ? (
            <>
              <div className="space-y-3">
                {screening.questions.map(([id, label], index) => (
                  <fieldset key={id} className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-800">{index + 1}. {label}</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {['yes', 'no'].map((value) => (
                        <label key={value} className={`cursor-pointer rounded-lg border p-2 text-center text-sm font-bold capitalize ${answers[id] === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>
                          <input type="radio" name={id} value={value} checked={answers[id] === value} onChange={() => setAnswers((current) => ({ ...current, [id]: value }))} className="sr-only" />
                          {value}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <button type="button" disabled={unanswered > 0} onClick={() => setShowResult(true)} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {unanswered ? `Answer ${unanswered} remaining question${unanswered === 1 ? '' : 's'}` : 'View recommendation'}
              </button>
            </>
          ) : (
            <div>
              <div className={`rounded-xl border p-5 ${urgent ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`} role="alert">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Follow-up result — not a diagnosis</p>
                <h3 className={`mt-2 text-2xl font-bold ${urgent ? 'text-red-800' : 'text-amber-900'}`}>
                  {urgent ? 'Emergency warning sign reported' : `${yesCount} related symptom${yesCount === 1 ? '' : 's'} reported`}
                </h3>
                {urgent && <p className="mt-3 font-semibold text-red-800">Go to the nearest emergency department now or call your local emergency service.</p>}
              </div>
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
                <h4 className="font-bold">Medical recommendation</h4>
                <ul className="mt-2 list-disc space-y-2 pl-5">{screening.advice.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">The image prediction and questionnaire are screening aids only. A clinician and laboratory tests must confirm the disease.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setShowResult(false)} className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700">Review answers</button>
                <button type="button" onClick={close} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DengueLeptoScreening
