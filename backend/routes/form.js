import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import options from '../symptom-model/options.json' with { type: 'json' };


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const localPython = path.join(
  __dirname,
  '../symptom-model/.venv',
  process.platform === 'win32'
    ? 'Scripts/python.exe'
    : 'bin/python'
);

const python =
  process.env.SYMPTOM_PYTHON_PATH ||
  (fs.existsSync(localPython) ? localPython : 'python');

const recommendations = {
  High:
    'Urgent medical assessment is recommended. Please seek medical care as soon as possible, especially if you have difficulty breathing, chest pain, confusion, severe weakness, reduced urination, persistent vomiting, or worsening symptoms. If symptoms are severe or rapidly worsening, seek emergency medical care.',

  Medium:
    'Medical advice is recommended, particularly if symptoms persist, worsen, or are associated with flood-water or contaminated-water exposure. Monitor your symptoms closely, stay hydrated if you can safely drink fluids, and seek prompt medical attention if new or severe symptoms develop.',

  Low:
    'Your screening indicates a lower level of immediate risk based on the information provided. Continue monitoring your symptoms, maintain adequate hydration if appropriate, and seek medical advice if symptoms persist, worsen, or new concerning symptoms develop.'
};

let active = 0;

function infer(payload) {
  return new Promise((resolve, reject) => {

    const child = spawn(
      python,
      [
        path.join(
          __dirname,
          '../symptom-model/predict.py'
        )
      ],
      {
        shell: false,
        windowsHide: true,
        timeout: 12000
      }
    );

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();

      if (output.length > 16384) {
        child.kill();
      }
    });

    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on('error', (error) => {
      console.error(
        'Unable to start symptom ML model:',
        error
      );

      reject(error);
    });

    child.stdin.on('error', (error) => {
      console.error(
        'Python stdin error:',
        error
      );

      reject(error);
    });

    child.on('close', (code) => {

      if (code !== 0) {
        console.error(
          'Symptom ML model failed.'
        );

        console.error(
          'Exit code:',
          code
        );

        console.error(
          'Python error:',
          errorOutput
        );

        return reject(
          new Error(
            errorOutput ||
            'Python prediction failed. Check Python dependencies and model.'
          )
        );
      }

      try {
        resolve(JSON.parse(output));
      } catch (error) {
        console.error(
          'Invalid output from symptom ML model:',
          output
        );

        reject(error);
      }
    });

    child.stdin.end(
      JSON.stringify(payload)
    );
  });
}

function validate(b) {

  if (
    !b ||
    typeof b !== 'object' ||
    Array.isArray(b)
  ) {
    return 'Expected a JSON object.';
  }

  if (
    !Number.isInteger(b.age) ||
    b.age < 0 ||
    b.age > 120
  ) {
    return 'Age must be an integer between 0 and 120.';
  }

  if (!options.GENDERS.includes(b.gender)) {
    return 'Select a valid gender.';
  }

  if (!options.DURATIONS.includes(b.duration)) {
    return 'Select a valid duration.';
  }

  if (b.consent !== true) {
    return 'Consent is required.';
  }

  const fields = [
    [
      'selectedSymptoms',
      options.SYMPTOMS,
      true
    ],
    [
      'selectedExposures',
      options.FLOOD_EXPOSURES,
      true
    ],
    [
      'riskFactors',
      options.RISK_FACTORS,
      false
    ]
  ];

  for (
    const [field, allowed, required]
    of fields
  ) {

    const values = b[field];

    if (
      !Array.isArray(values) ||
      (required && !values.length) ||
      values.length > allowed.length ||
      values.some(
        (value) => !allowed.includes(value)
      ) ||
      new Set(values).size !== values.length
    ) {
      return `Invalid ${field} selections.`;
    }
  }

  if (
    b.selectedExposures.includes(
      'No direct flood exposure'
    ) &&
    b.selectedExposures.length !== 1
  ) {
    return 'No direct flood exposure cannot be combined with other exposures.';
  }

  return null;
}


const router = express.Router();


router.get(
  '/screening/test',
  (_req, res) => {

    res.json({
      success: true,
      message:
        'Symptom risk assessment API is available. Submit the form to run the risk-level model.'
    });

  }
);


router.get(
  '/screening',
  (_req, res) => {

    res
      .status(405)
      .set('Allow', 'POST')
      .json({
        message:
          'Use POST /api/screening from the symptom form.'
      });

  }
);


router.post(
  '/screening',
  async (req, res) => {

    const validationError =
      validate(req.body);

    if (validationError) {

      return res.status(422).json({
        success: false,
        message: validationError
      });

    }



    if (active >= 2) {

      return res.status(503).json({
        success: false,
        message:
          'Risk assessment model is busy. Please retry shortly.'
      });

    }


    active++;


    try {

      const {
        age,
        gender,
        duration,
        selectedSymptoms,
        selectedExposures,
        riskFactors
      } = req.body;


      /* Send user inputs to Python ML model */

      const result = await infer({
        age,
        gender,
        duration,
        selectedSymptoms,
        selectedExposures,
        riskFactors
      });



      if (
        !['Low', 'Medium', 'High']
          .includes(result.riskLevel)
      ) {

        throw new Error(
          'Unexpected risk-level model output.'
        );

      }


      const recommendation =
        recommendations[
          result.riskLevel
        ];


      return res.json({
        success: true,
        riskLevel: result.riskLevel,
        recommendation
      });

    } catch (error) {

      console.error(
        'SCREENING MODEL ERROR:',
        error
      );

      return res.status(503).json({
        success: false,
        message:
          'Risk assessment unavailable. Check the symptom Python environment and model file.'
      });

    } finally {

      active--;

    }

  }
);


export default router;