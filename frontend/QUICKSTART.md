# Emergency Operations Center Dashboard - Quick Start Guide

## Installation & Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

This installs all required packages including the newly added:
- `framer-motion@^11.0.0` - For animations
- All existing dependencies remain intact

### 2. Start Development Server
```bash
npm run dev
```

Server runs at: `http://localhost:5173`

### 3. Build for Production
```bash
npm run build
npm run preview
```

## Verify Backend Services

Ensure these services are running:

```bash
# API Server (Port 3001)
# Terminal 1
cd backend
npm start

# ML Service (Port 5000)
# Terminal 2
cd flood-map-model
python start_ml_service.py
# or Windows:
start_ml_service.bat
```

## Project Structure at a Glance

```
frontend/
├── src/
│   ├── components/
│   │   ├── dashboard/          # ← Dashboard UI components
│   │   │   ├── OperationsHeader.tsx
│   │   │   ├── SensorPanel.tsx
│   │   │   ├── PredictionPanel.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   ├── StatusCard.tsx
│   │   │   └── index.ts         # Component exports
│   │   │
│   │   └── map/                 # ← Map components
│   │       ├── MapContainer.tsx
│   │       └── index.ts
│   │
│   ├── pages/                   # ← Page components
│   │   └── OperationsCenter.tsx # ← MAIN DASHBOARD
│   │
│   ├── hooks/                   # ← Custom React hooks
│   │   ├── useSensorData.ts
│   │   ├── usePrediction.ts
│   │   └── index.ts
│   │
│   ├── utils/                   # ← Utilities
│   │   ├── constants.ts         # Configuration
│   │   ├── dashboardUtils.ts    # Helper functions
│   │   └── theme.ts             # Design system
│   │
│   ├── styles/                  # ← Global styles
│   │   └── theme.css
│   │
│   ├── App.tsx                  # ← Main router
│   ├── FloodAlertDashboard.tsx  # ← Dashboard wrapper
│   └── main.tsx                 # ← Entry point
│
├── IMPLEMENTATION_GUIDE.md      # ← Full documentation
├── DASHBOARD_README.md          # ← Component docs
└── package.json                 # ← Dependencies
```

## Key Entry Points

### 1. Main Application Router
**File**: `src/App.tsx`

Routes to different views based on user role and navigation:
- Operations Center (default)
- Full-screen Flood Map
- Post-flood Rescue & Ration Distribution
- Drain Management (admin only)

### 2. Emergency Operations Center
**File**: `src/pages/OperationsCenter.tsx`

The heart of the new dashboard:
- Real-time metrics
- Sensor monitoring
- ML predictions
- Map visualization
- Alert system

### 3. Dashboard Wrapper (Legacy Compatible)
**File**: `src/FloodAlertDashboard.tsx`

Bridges old and new interfaces:
- Maintains backward compatibility
- Routes to OperationsCenter by default
- Supports legacy views (map, ration, drain management)

## Common Tasks

### Add a New Metric to Dashboard

1. Open `pages/OperationsCenter.tsx`
2. Find the metrics grid (line ~130)
3. Add new MetricCard:

```tsx
<motion.div variants={itemVariants}>
  <MetricCard
    label="New Metric"
    value={calculateNewMetric(sensorPackages)}
    icon={<NewIcon size={20} />}
    tone="blue"
    detail="Description"
  />
</motion.div>
```

### Add a New Alert Type

1. Open `utils/dashboardUtils.ts`
2. Create new alert generator:

```tsx
export const generateNewAlert = (data) => ({
  title: 'Alert Title',
  detail: 'Alert detail',
  tone: 'warning' // success | warning | danger | info
});
```

3. Call in OperationsCenter where alerts are generated

### Customize Styling

1. Edit `styles/theme.ts` for design tokens
2. Use in components:

```tsx
import theme from '@/styles/theme';

<div className={theme.components.card.base}>
  {/* Content */}
</div>
```

### Add New Map Visualization Mode

1. Open `components/map/MapContainer.tsx`
2. Add mode to state:

```tsx
const [mapMode, setMapMode] = useState<'heatmap' | 'sensors' | 'predictions' | 'custom'>('heatmap');
```

3. Add button and rendering logic

## Component Usage Examples

### Using SensorPanel
```tsx
import { SensorPanel } from '@/components/dashboard';

<SensorPanel
  authToken={token}
  sensorPackages={sensors}
  loading={false}
  onSensorClick={(sensor) => console.log(sensor)}
/>
```

### Using PredictionPanel
```tsx
import { PredictionPanel } from '@/components/dashboard';

<PredictionPanel
  authToken={token}
  onPredictionResult={(result) => console.log(result)}
/>
```

### Using Hooks
```tsx
import { useSensorData, usePrediction } from '@/hooks';

// Sensor data
const { sensors, loading, error, refresh } = useSensorData(authToken);

// Predictions
const { result, predict } = usePrediction();
const result = await predict({
  rainfall: 30,
  latitude: 6.9271,
  // ... other features
});
```

## API Integration Testing

### Test Sensor Packages
```bash
curl -X GET http://localhost:3001/api/sensor-packages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test ML Prediction
```bash
curl -X POST http://localhost:5000/api/ml/prediction/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "rainfall": 30,
      "latitude": 6.9271,
      "longitude": 79.8612,
      "elevation": 0,
      "water_level": 2.5,
      "humidity": 75,
      "date": "2026-07-02",
      "period": "Any"
    }
  }'
```

## Performance Tips

1. **Use React DevTools**: Identify unnecessary re-renders
2. **Check Network Tab**: Verify API calls and response times
3. **Profile with Lighthouse**: Check Core Web Vitals
4. **Test on Mobile**: Ensure responsive design
5. **Monitor Bundle Size**: `npm run build` and check dist folder

## Debugging

### Enable Console Logging
```tsx
// In OperationsCenter.tsx or any component
console.log('Sensor data:', sensorPackages);
console.log('System status:', systemStatus);
```

### Check API Connectivity
```tsx
const testAPI = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/sensor-packages', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('API Response:', await res.json());
  } catch (err) {
    console.error('API Error:', err);
  }
};
```

### Monitor State Changes
```tsx
useEffect(() => {
  console.log('Sensors updated:', sensorPackages);
}, [sensorPackages]);
```

## Browser DevTools Tips

1. **Inspect Elements**: Right-click → Inspect
2. **React DevTools**: See component tree and props
3. **Network Tab**: Monitor API calls
4. **Performance Tab**: Record and analyze animations
5. **Console**: Check for errors and warnings

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Map not showing | Ensure Leaflet CSS imported, check container height |
| Sensors not updating | Verify API token, check API server running |
| Animations laggy | Reduce animation complexity, check GPU acceleration |
| Layout broken on mobile | Check responsive classes, test with device simulator |
| API 401 errors | Verify token validity, check login |

## Next Steps

1. **Review Documentation**
   - `DASHBOARD_README.md` - Component documentation
   - `IMPLEMENTATION_GUIDE.md` - Full architecture guide

2. **Explore Components**
   - Open `src/components/dashboard/OperationsHeader.tsx`
   - Read through `src/pages/OperationsCenter.tsx`
   - Study `src/utils/dashboardUtils.ts`

3. **Test Features**
   - Login and view dashboard
   - Click on sensors to see details
   - Run ML predictions
   - Check map visualizations
   - Navigate between sections

4. **Customize**
   - Add your own metrics
   - Create custom alerts
   - Modify styling
   - Extend components

5. **Deploy**
   - Run `npm run build`
   - Deploy dist folder to server
   - Update API endpoints if needed
   - Test in production environment

## Support & Resources

- **React Docs**: https://react.dev
- **TypeScript**: https://www.typescriptlang.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Framer Motion**: https://www.framer.com/motion
- **Leaflet**: https://leafletjs.com
- **Lucide Icons**: https://lucide.dev

---

**Last Updated**: July 2, 2026  
**Version**: 2.0.0  
**Status**: ✅ Ready for Development
