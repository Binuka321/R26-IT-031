import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

test('post-flood predictions preserve ML classes and fail without a fallback', async () => {
  let responseBody;
  let status = 200;
  const server = createServer((req, res) => {
    req.resume();
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseBody));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.POST_FLOOD_ML_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  const { PostFloodMLService } = await import('../utils/postFloodMLService.js');
  const prediction = {
    camp_priority: 'High', food_priority: 'Low', water_priority: 'Medium',
    medicine_priority: 'High', sanitary_priority: 'Low', priority_score: 12,
    confidence_score: 0.9, model_version: 'test-model',
  };
  const camp = { _id: 'camp-1', population: 100, road_access_status: 'Blocked' };
  const payload = PostFloodMLService.buildCampPayload({ ...camp, infants_count: 0, last_distribution_hours: 0 });
  assert.equal(payload.infants_count, 0);
  assert.equal(payload.last_distribution_hours, 0);
  try {
    responseBody = { status: 'success', prediction };
    assert.deepEqual(await PostFloodMLService.predictCampNeeds(camp), {
      ...prediction, prediction_source: 'ml_model',
    });
    responseBody = { status: 'success', predictions: [{ camp_id: camp._id, prediction }], errors: [] };
    const batch = await PostFloodMLService.predictBatchCampNeeds([camp]);
    assert.deepEqual(batch.predictions[0].prediction, { ...prediction, prediction_source: 'ml_model' });

    responseBody = { status: 'success', predictions: [], errors: [{ camp_id: camp._id, message: 'Invalid input' }] };
    const failedBatch = await PostFloodMLService.predictBatchCampNeeds([camp]);
    assert.equal(failedBatch.predictions.length, 0);
    assert.equal(failedBatch.errors.length, 1);

    responseBody = { status: 'success', prediction: { ...prediction, food_priority: undefined } };
    await assert.rejects(PostFloodMLService.predictCampNeeds(camp), { statusCode: 503 });
    status = 503;
    responseBody = { status: 'error', message: 'Model unavailable' };
    await assert.rejects(PostFloodMLService.predictCampNeeds(camp), { statusCode: 503 });
    await assert.rejects(PostFloodMLService.predictBatchCampNeeds([camp]), { statusCode: 503 });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  await assert.rejects(PostFloodMLService.predictCampNeeds(camp), { statusCode: 503 });
});

test('item urgency uses the model camp class rather than averaging item labels', async () => {
  const { buildMlItemPriorityData } = await import('../utils/mlItemPriorityData.js');
  const result = buildMlItemPriorityData({ _id: 'camp-1', population: 100 }, {
    camp_priority: 'High', food_priority: 'Low', water_priority: 'Low',
    medicine_priority: 'Low', sanitary_priority: 'Low',
  });
  assert.equal(result.overall_urgency, 'High');
  assert.equal(result.food_priority, 'Low');
});

test('urgent citizen reports never boost ML camp or item priorities', async () => {
  const { default: NeedReport } = await import('../models/NeedReport.js');
  const { applyNeedReportImpactToPrediction } = await import('../utils/needReportImpact.js');
  const originalFind = NeedReport.find;
  NeedReport.find = () => ({ lean: async () => Array.from({ length: 3 }, () => ({
    severity: 'Emergency', need_type: 'Water', people_count: 100,
  })) });
  const prediction = { camp_priority: 'Low', priority_score: 7, water_priority: 'Low' };
  try {
    const result = await applyNeedReportImpactToPrediction('camp-1', prediction);
    assert.equal(result.need_report_impact.active_reports, 3);
    assert.equal(result.need_report_impact.applied_boost, 0);
    const { need_report_impact, ...unchanged } = result;
    assert.deepEqual(unchanged, prediction);
  } finally {
    NeedReport.find = originalFind;
  }
});
