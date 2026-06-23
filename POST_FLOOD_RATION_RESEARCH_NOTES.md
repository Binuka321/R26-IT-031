# Post-Flood Ration and Relief Distribution Management System

## Current Implementation Snapshot

The current component manages post-flood relief camps, safe zones, resource inventory, route planning, item priorities, distribution plans, delivery status, reports, notifications, and user need reports. The ML service is dedicated to camp-level rescue and ration prioritization and runs separately from the Node backend.

- Frontend module: `frontend/src/PostFloodRationDistribution`
- Backend routes: camps, resources, predictions, item priority, route planning, distributions, reports, notifications, need reports
- ML service: `ml-service/app.py`
- ML endpoint: `http://localhost:5050/api/ml`
- Model: multi-output Random Forest classifier
- Prediction targets: camp priority, food priority, water priority, medicine priority, sanitary priority
- Training data after cleaning and augmentation: 4,260 rows
- Current model version: `post_flood_camp_relief_rf_v2_standards`

## Existing Strengths

- Camp prioritization uses more than population count; it also considers vulnerable groups, resource availability, road access, distance, camp capacity, occupancy ratio, vehicle capacity, and time since last distribution.
- The ML service provides both single-camp and batch prediction endpoints.
- The system stores prediction confidence, model version, and item-level priority outputs.
- Distribution stock allocation uses MongoDB transactions, reducing the risk of inconsistent resource updates.
- Item-level delivery confirmation supports partial delivery instead of treating delivery as all-or-nothing.
- Inventory has batch, expiry date, supplier, and storage location fields, which supports better humanitarian stock management.
- Route planning considers flood zones and blocked roads, and uses safer route logic instead of only shortest distance.
- Role-based access exists for admins, disaster officers, camp coordinators, rescue teams, and users.

## Weaknesses and Limitations

1. Synthetic or limited training data

The model report shows 4,260 rows after cleaning and augmentation, but the dataset appears project-generated rather than collected from real disaster operations. This limits how well the trained model can generalize to real post-flood conditions.

2. Static prioritization categories

The model outputs Low, Medium, and High classes. This is easy to understand, but it may be too coarse when many camps are High priority at the same time. Relief teams need a more precise ordered ranking when resources are scarce.

3. Limited real-time field feedback

Need reports and distribution status exist, but the ML model does not appear to continuously learn from field outcomes such as failed deliveries, partial deliveries, new road blockages, changing camp population, or community-submitted urgent needs.

4. Weak explainability for ML decisions

Predictions include confidence score and priority outputs, but they do not clearly explain which factors caused the decision. Disaster officers may need transparent reasoning before trusting an automated recommendation.

5. Dependency on manual data accuracy

Camp population, vulnerable counts, available stock, road status, and last distribution time must be accurate. If camp coordinators enter outdated or incomplete data, the model can produce misleading priorities.

6. Route planning is approximate

The current route engine uses a generated grid and penalties for flood zones and blocked roads. It is useful for a prototype, but it is not equivalent to routing on real road-network data with live traffic, bridge status, road width, and vehicle constraints.

7. No multi-camp resource optimization

The system predicts camp needs and manages distributions, but it does not fully optimize allocation across all camps under constraints such as limited trucks, limited water, fuel, route risk, delivery deadlines, and vehicle capacities.

8. Limited fairness and vulnerability auditing

The model includes vulnerable groups, but the system does not yet provide fairness checks to ensure children, elderly people, infants, pregnant women, disabled people, and chronic patients are not under-served across repeated distribution cycles.

9. No offline-first field operation mode

Post-flood areas may have unstable internet access. The current frontend depends on live API calls and does not appear to support offline camp updates, queued delivery confirmations, or conflict resolution after reconnection.

10. Production readiness gaps in the ML service

The ML service currently runs with Flask's development server. For deployment, it needs a production WSGI server, health monitoring, structured logs, automatic restart, environment-based configuration, and model artifact version control.

## Proposed Improved System

The improved system should be a decision-support platform for fair, explainable, and optimized relief distribution after floods. It should combine ML-based camp prioritization, rule-based humanitarian standards, real-time field updates, route-aware logistics, and transparent dashboards.

### Main Improvements

1. Explainable camp priority engine

Add factor-level explanations for every ML prediction, such as:

- Critical water shortage
- High vulnerable population ratio
- Road access limited
- Last distribution was more than 36 hours ago
- Camp occupancy is near capacity

This makes the system easier for disaster officers to trust and justify.

2. Continuous priority score instead of only Low/Medium/High

Keep Low/Medium/High labels for readability, but also calculate a 0-100 urgency score and rank all active camps. This helps when multiple camps fall into the same category.

3. Real-time field feedback loop

Use delivery outcomes, need reports, failed route reports, updated camp populations, and newly blocked roads as feedback signals. These should automatically trigger recalculation of camp priority and resource needs.

4. Humanitarian standards-based resource planning

Use standards already present in the ML report, such as:

- Food packs per person per day
- Water litres per person per day
- Medicine kit coverage
- Sanitary kit coverage

The system should calculate exact shortfall quantities, not only priority labels.

5. Multi-camp allocation optimization

Add an optimization layer that recommends how to distribute limited resources across camps. The optimization should consider:

- Camp urgency score
- Stock availability
- Vehicle capacity
- Route safety
- Distance and travel time
- Perishable stock expiry
- Vulnerable population needs

6. Route-aware delivery scheduling

Distribution planning should combine camp priority with safest route availability. A high-priority camp with blocked road access may need boat, helicopter, or alternative hand-delivery planning.

7. Offline field support

Add offline-capable forms for camp coordinators and rescue teams. Updates should sync when internet returns, with conflict warnings for duplicated or outdated records.

8. Fairness and audit dashboard

Add metrics showing whether vulnerable groups and remote camps are receiving fair service over time. This can support research evaluation and ethical disaster response.

9. Production-grade ML service

Deploy the ML service with a production server such as Gunicorn or Waitress, service monitoring, structured logs, model version tracking, and a fallback rule-based priority engine if the ML service is unavailable.

## Suggested Research Problem Statement

Existing post-flood ration and relief distribution systems often rely on manual assessment, static priority rules, and fragmented communication between camps, inventory teams, and delivery teams. These approaches can delay aid delivery, overlook vulnerable populations, and cause inefficient use of limited resources. This research proposes an intelligent post-flood ration and relief distribution management system that uses machine learning, humanitarian standards, real-time field reporting, and route-aware logistics to prioritize camps, calculate item-level shortages, optimize resource allocation, and improve transparency in relief delivery.

## Suggested Research Objectives

- Identify the limitations of existing manual and rule-based post-flood relief distribution processes.
- Develop an ML-assisted camp prioritization model using camp population, vulnerable groups, stock levels, road access, distance, occupancy, and distribution history.
- Generate item-level food, water, medicine, and sanitary priorities based on humanitarian relief standards.
- Improve distribution planning using route safety, vehicle capacity, inventory availability, and delivery status feedback.
- Provide explainable priority recommendations for disaster officers and camp coordinators.
- Evaluate the system using prediction accuracy, prioritization quality, response time, stock utilization, and delivery completion rate.

## Proposed Evaluation Metrics

- Camp priority prediction accuracy and F1-score
- Item priority prediction accuracy and F1-score
- Average time to generate a distribution plan
- Percentage reduction in stock allocation conflicts
- Delivery completion and partial-delivery rates
- Average time between need report submission and response
- Fairness of distribution across vulnerable population groups
- ML service availability and prediction response time

## Immediate Next Steps

- Keep the ML service running and verify `/api/ml/health` before testing the frontend.
- Test batch camp priority recalculation from the dashboard.
- Add factor-level explanations to the ML prediction response.
- Add a shortfall quantity calculator for food, water, medicine, and sanitary items.
- Create a fallback path in the backend so priority calculation can continue if the ML service is down.
- Prepare a research chapter section using the weakness and proposal points above.
