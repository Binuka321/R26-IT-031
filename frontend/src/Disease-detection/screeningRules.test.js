import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateScreening, warningSigns } from './screeningRules.js'
const yes = (...keys) => Object.fromEntries(keys.map(key => [key, 'yes']))
const cases = [
 ['dengue', [], 'low'],
 ['dengue', ['severeHeadache'], 'low'],
 ['dengue', ['suddenHighFever'], 'fever-only'],
 ['dengue', ['suddenHighFever', 'severeHeadache'], 'insufficient'],
 ['dengue', ['suddenHighFever', 'severeHeadache', 'muscleBoneJointPain'], 'compatible'],
 ['dengue', ['severeHeadache', 'muscleBoneJointPain', 'nauseaVomiting'], 'low'],
 ['leptospirosis', [], 'none'],
 ['leptospirosis', ['relevantExposure'], 'none'],
 ['leptospirosis', ['severeHeadache'], 'one'],
 ['leptospirosis', ['severeHeadache', 'extremeTiredness'], 'two'],
 ['leptospirosis', ['severeHeadache', 'extremeTiredness', 'nauseaVomiting'], 'generic'],
 ['leptospirosis', ['suddenFever', 'severeHeadache', 'calfLowerBackPain'], 'characteristic'],
 ['leptospirosis', ['suddenFever', 'severeHeadache', 'musclePain', 'chills'], 'higher'],
 ['leptospirosis', ['suddenFever', 'severeHeadache', 'musclePain', 'relevantExposure'], 'exposure'],
 ['leptospirosis', ['suddenFever', 'severeHeadache', 'calfLowerBackPain', 'chills', 'relevantExposure'], 'exposure'],
 ['leptospirosis', ['calfLowerBackPain', 'musclePain'], 'one'],
 ['leptospirosis', ['suddenFever', 'musclePain', 'relevantExposure'], 'two'],
]
for (const [disease, symptoms, category] of cases) {
 test(`${disease}: ${symptoms.join(', ') || 'none'} => ${category}`, () => {
   const result = evaluateScreening(disease, yes(...symptoms))
   assert.equal(result.category, category)
   assert.equal(result.urgent, false)
   assert.ok(result.recommendation.length > 50)
 })
}
for (const [disease, signs] of Object.entries(warningSigns)) {
 for (const sign of signs) {
   test(`${disease}: ${sign} overrides every symptom combination`, () => {
     const keys = disease === 'dengue' ? ['suddenHighFever', 'severeHeadache', 'muscleBoneJointPain'] : ['suddenFever', 'severeHeadache', 'calfLowerBackPain', 'chills', 'relevantExposure']
     for (let mask = 0; mask < 2 ** keys.length; mask++) {
       const result = evaluateScreening(disease, yes(sign, ...keys.filter((_, i) => mask & (1 << i))))
       assert.equal(result.category, 'urgent')
       assert.equal(result.urgent, true)
     }
   })
 }
}
test('only explicit yes answers count', () => {
 assert.equal(evaluateScreening('dengue', { suddenHighFever: 'no', severeHeadache: true }).category, 'low')
})
test('warning alone does not label dengue', () => {
 assert.equal(evaluateScreening('dengue', yes('difficultyBreathing')).interpretation, 'Urgent assessment required')
})
