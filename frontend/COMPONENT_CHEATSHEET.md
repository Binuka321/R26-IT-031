# Component Cheat Sheet

Quick reference for commonly used components and patterns.

## Component Imports

```tsx
// Dashboard Components
import { 
  OperationsCenter, 
  SensorPanel, 
  PredictionPanel, 
  OperationsHeader,
  MetricCard,
  StatusCard,
  StatusBadge,
  AlertFeed,
  ActionTile 
} from '@/components/dashboard';

// Map Components
import { MapContainer } from '@/components/map';

// Custom Hooks
import { useSensorData, usePrediction } from '@/hooks';

// Utilities
import { 
  getWaterLevelStatus,
  getStatusColor,
  calculateSystemStatus,
  calculateAverageWaterLevel,
  getNearBySensors,
  generatePredictionAlert
} from '@/utils/dashboardUtils';

// Constants
import { 
  SYSTEM_STATUS, 
  ALERT_TONES,
  MAP_MODES,
  COLOR_SCHEME 
} from '@/utils/constants';

// Design System
import theme from '@/styles/theme';
```

## Component Snippets

### OperationsCenter (Main Dashboard)
```tsx
<OperationsCenter
  authToken={token}
  isAdmin={true}
  onLogout={() => logout()}
  onNavigate={(page) => navigate(page)}
/>
```

### SensorPanel (IoT Data)
```tsx
<SensorPanel
  authToken={token}
  sensorPackages={sensors}
  loading={false}
  onSensorClick={(sensor) => setSelected(sensor)}
/>
```

### PredictionPanel (ML)
```tsx
<PredictionPanel
  authToken={token}
  onPredictionResult={(result) => {
    console.log('Prediction:', result);
    // result.prediction_label
    // result.confidence
    // result.floodDepth
  }}
  loading={false}
/>
```

### MetricCard (KPI Display)
```tsx
<MetricCard
  label="Active Sensors"
  value={25}
  unit="devices"
  detail="IoT Network Status"
  icon={<Radio />}
  tone="blue"  // blue | emerald | amber | rose | violet
/>
```

### StatusCard (Alert Display)
```tsx
<StatusCard
  title="Water Level Alert"
  status="warning"  // critical | warning | normal | info
  value="2.3m"
  description="Above alert threshold"
  icon={<AlertTriangle />}
  onClick={() => handleClick()}
/>
```

### StatusBadge (Inline Status)
```tsx
<StatusBadge
  label="Minor Flood"
  tone="warning"  // success | warning | danger | info
/>
```

### AlertFeed (Notifications)
```tsx
<AlertFeed items={[
  {
    title: 'Critical Alert',
    detail: 'Water level exceeding threshold',
    time: '14:32',
    tone: 'danger'
  }
]} />
```

### ActionTile (Quick Actions)
```tsx
<ActionTile
  title="Drain Management"
  description="Manage flood level monitors"
  icon={Gauge}
  accent="emerald"  // cyan | emerald | amber | violet
  onClick={() => handleClick()}
/>
```

### MapContainer (Visualization)
```tsx
<MapContainer
  authToken={token}
  isExpanded={false}
/>
```

### OperationsHeader (Top Bar)
```tsx
<OperationsHeader
  title="Emergency Operations Center"
  status="active"  // active | warning | critical
  userRole="Administrator"
  onLogout={() => logout()}
/>
```

## Hook Usage

### useSensorData
```tsx
const { sensors, loading, error, refresh } = useSensorData(
  authToken,
  30000  // refresh interval in ms
);

// Listen for changes
useEffect(() => {
  console.log('Sensors updated:', sensors);
}, [sensors]);

// Manual refresh
<button onClick={refresh}>Refresh Now</button>
```

### usePrediction
```tsx
const { result, loading, error, predict, reset } = usePrediction();

// Make prediction
const handlePredict = async () => {
  const result = await predict({
    rainfall: 30,
    latitude: 6.9271,
    longitude: 79.8612,
    elevation: 0,
    elevation_m: 0,
    water_level: 2.5,
    humidity: 75,
    date: '2026-07-02',
    period: 'Any'
  });
};

// Display result
{result && (
  <div>
    <p>Risk: {result.prediction_label}</p>
    <p>Confidence: {(result.confidence * 100).toFixed(1)}%</p>
  </div>
)}

// Reset state
<button onClick={reset}>Clear Result</button>
```

## Utility Functions

### Status Management
```tsx
// Get sensor status
const status = getWaterLevelStatus(sensor);
// Returns: 'critical' | 'warning' | 'alert' | 'normal'

// Get status color scheme
const { bg, border, text } = getStatusColor(status);
// Returns: { bg: string, border: string, text: string }

// Calculate system-wide status
const systemStatus = calculateSystemStatus(sensors);
// Returns: 'active' | 'warning' | 'critical'
```

### Data Aggregation
```tsx
// Get average water level
const avgWater = calculateAverageWaterLevel(sensors);

// Get average rainfall
const avgRain = calculateAverageRainfall(sensors);

// Find nearby sensors
const nearby = getNearBySensors(sensors, lat, lon, 50);  // 50km radius

// Calculate distance
const distance = calculateDistance(lat1, lon1, lat2, lon2);
```

### Alert Generation
```tsx
// Generate alert from prediction
const alert = generatePredictionAlert(result);
// Returns: { title, detail, tone }

// Sort alerts by priority
const sorted = sortAlertsByPriority(alerts);
```

## Tailwind CSS Classes

### Colors
```tsx
// Primary (Cyan)
className="text-cyan-400 bg-cyan-600 border-cyan-500"

// Critical (Red)
className="text-red-400 bg-red-600 border-red-500"

// Warning (Amber)
className="text-amber-400 bg-amber-600 border-amber-500"

// Success (Green)
className="text-green-400 bg-green-600 border-green-500"

// Neutral (Slate)
className="text-slate-400 bg-slate-700 border-slate-600"
```

### Spacing
```tsx
// Padding
className="p-4 px-6 py-3"

// Margin
className="m-4 mx-6 my-3"

// Gap
className="gap-4 gap-x-6 gap-y-3"
```

### Layout
```tsx
// Grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"

// Flex
className="flex items-center justify-between gap-4"

// Rounded corners
className="rounded-lg rounded-2xl"

// Borders
className="border border-2 border-slate-700"
```

### States
```tsx
// Hover
className="hover:bg-slate-600 hover:text-white transition-colors"

// Focus
className="focus:outline-none focus:ring-2 focus:ring-cyan-500"

// Disabled
className="disabled:opacity-50 disabled:cursor-not-allowed"

// Animations
className="animate-pulse animate-bounce"
```

## Framer Motion Patterns

### Fade In
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

### Slide In
```tsx
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

### Scale on Hover
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click Me
</motion.button>
```

### Staggered Children
```tsx
<motion.div
  variants={{
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.1,
          delayChildren: 0.3,
        },
      },
    },
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
  }}
  initial="hidden"
  animate="visible"
>
  {items.map((item, idx) => (
    <motion.div key={idx} variants={containerVariants.item}>
      {item}
    </motion.div>
  ))}
</motion.div>
```

## API Patterns

### Fetch Sensors
```tsx
const response = await fetch('http://localhost:3001/api/sensor-packages', {
  headers: { Authorization: `Bearer ${authToken}` }
});
const sensors = await response.json();
```

### Make Prediction
```tsx
const response = await fetch('http://localhost:5000/api/ml/prediction/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    features: {
      rainfall: 30,
      latitude: 6.9271,
      longitude: 79.8612,
      elevation: 0,
      elevation_m: 0,
      water_level: 2.5,
      humidity: 75,
      date: '2026-07-02',
      period: 'Any'
    }
  })
});
const prediction = await response.json();
```

## Common Patterns

### Controlled Input
```tsx
const [value, setValue] = useState('');

<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded"
/>
```

### Loading State
```tsx
{loading ? (
  <div>Loading...</div>
) : error ? (
  <div className="text-red-400">{error}</div>
) : (
  <div>{content}</div>
)}
```

### Modal/Overlay
```tsx
{showModal && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 bg-black/50 flex items-center justify-center"
  >
    <motion.div
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      className="bg-slate-800 rounded-lg p-6"
    >
      Content
    </motion.div>
  </motion.div>
)}
```

### List with Update
```tsx
const [items, setItems] = useState([]);

const addItem = (item) => {
  setItems([item, ...items]);
};

const updateItem = (id, updates) => {
  setItems(items.map(item => 
    item.id === id ? { ...item, ...updates } : item
  ));
};

const removeItem = (id) => {
  setItems(items.filter(item => item.id !== id));
};
```

## Performance Tips

### Memoize Component
```tsx
import { memo } from 'react';

export const MyComponent = memo(({ data }) => {
  return <div>{data}</div>;
});
```

### Memoize Function
```tsx
const memoizedFunction = useCallback(() => {
  // Function logic
}, [dependency]);
```

### Lazy Load Component
```tsx
const LazyComponent = lazy(() => import('./Component'));

<Suspense fallback={<div>Loading...</div>}>
  <LazyComponent />
</Suspense>
```

## Responsive Classes

```tsx
// Hidden on mobile, visible on md and up
className="hidden md:block"

// Responsive grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

// Responsive padding
className="p-2 md:p-4 lg:p-6"

// Responsive font
className="text-sm md:text-base lg:text-lg"
```

---

**Quick Reference Version**: 2.0  
**Last Updated**: July 2, 2026  
**Maintained By**: Development Team
