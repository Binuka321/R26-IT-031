# Emergency Operations Center Dashboard

A modern, professional Emergency Operations Center dashboard for flood intelligence, inspired by Microsoft Azure Maps, ArcGIS Dashboard, and IBM Environmental Intelligence.

## Overview

This redesigned dashboard transforms the Flood Intelligence system into a sophisticated operations center with:

- **Real-time IoT Sensor Monitoring** - Live water level, rainfall, and flow rate tracking
- **ML-Powered Flood Predictions** - Advanced machine learning predictions with confidence scores
- **Interactive Flood Risk Visualization** - Dynamic heatmaps and risk assessment mapping
- **Comprehensive Alert System** - Priority-based alert management and notifications
- **Multi-Component Architecture** - Reusable, composable React components with TypeScript
- **Professional Styling** - Tailwind CSS with dark theme and smooth animations
- **Framer Motion Animations** - Polished, responsive animations for enhanced UX

## Project Structure

```
src/
├── components/
│   ├── dashboard/
│   │   ├── OperationsHeader.tsx      # Header with system status
│   │   ├── SensorPanel.tsx           # IoT sensor data display
│   │   ├── PredictionPanel.tsx       # ML prediction interface
│   │   ├── MetricCard.tsx            # Metric card component
│   │   ├── StatusCard.tsx            # Status indicator cards
│   │   ├── ActionTile.tsx            # Quick action buttons
│   │   ├── AlertFeed.tsx             # Alert notification feed
│   │   └── StatusBadge.tsx           # Status badges
│   └── map/
│       └── MapContainer.tsx          # Leaflet map wrapper
├── pages/
│   └── OperationsCenter.tsx          # Main dashboard page
├── utils/
│   ├── constants.ts                  # Configuration and constants
│   ├── dashboardUtils.ts             # Utility functions
│   └── theme.ts                      # Design system
├── styles/
│   └── theme.css                     # Global styles
├── App.tsx                           # Main application entry
├── FloodAlertDashboard.tsx          # Legacy dashboard wrapper
└── main.tsx                          # React DOM entry point
```

## Key Components

### OperationsCenter (`pages/OperationsCenter.tsx`)

The main dashboard page that orchestrates all components:

```tsx
<OperationsCenter
  authToken={authToken}
  isAdmin={isAdmin}
  onLogout={handleLogout}
  onNavigate={handleNavigation}
/>
```

**Features:**
- Real-time system status monitoring
- Dynamic metrics display (active sensors, alerts, water levels)
- Integrated map container
- Sensor panel with live updates
- ML prediction panel
- Alert feed with priority sorting
- Quick action tiles for secondary features

### SensorPanel (`components/dashboard/SensorPanel.tsx`)

Displays all connected IoT sensors with real-time data:

```tsx
<SensorPanel
  authToken={authToken}
  sensorPackages={sensors}
  loading={isLoading}
  onSensorClick={handleSensorSelect}
/>
```

**Features:**
- Live water level display
- Rainfall and flow rate monitoring
- Status color coding
- Automatic refresh at 30-second intervals
- Click-to-select sensor details

### PredictionPanel (`components/dashboard/PredictionPanel.tsx`)

ML flood prediction interface with manual and automated predictions:

```tsx
<PredictionPanel
  authToken={authToken}
  onPredictionResult={handleResult}
  loading={isLoading}
/>
```

**Features:**
- District selection dropdown (all 25 Sri Lankan districts)
- Rainfall, water level, and humidity inputs
- Time period selection
- Date picker for future predictions
- Result display with confidence scores
- Error handling and status messages

### MapContainer (`components/map/MapContainer.tsx`)

Professional map interface with Leaflet integration:

```tsx
<MapContainer authToken={authToken} isExpanded={false} />
```

**Features:**
- Heatmap, sensor, and prediction visualization modes
- Layer toggle controls
- Fullscreen capability
- Real-time data updates
- Integration with all existing flood map functionality

### MetricCard (`components/dashboard/MetricCard.tsx`)

Animated metric display component:

```tsx
<MetricCard
  label="Active Sensors"
  value={25}
  unit="devices"
  icon={<Radio />}
  tone="blue"
  detail="IoT Network Status"
/>
```

### StatusCard & StatusBadge

Status indicators with color-coded severity levels:

```tsx
<StatusCard
  title="Water Level Alert"
  status="warning"
  value="2.3m"
  description="Above alert threshold"
/>

<StatusBadge label="Minor Flood" tone="warning" />
```

### AlertFeed (`components/dashboard/AlertFeed.tsx`)

Mission update feed with tone-based styling:

```tsx
<AlertFeed items={[
  {
    title: 'Critical Alert',
    detail: 'Water level exceeding major flood level',
    time: '14:32',
    tone: 'danger'
  }
]} />
```

### ActionTile (`components/dashboard/ActionTile.tsx`)

Quick navigation tiles for secondary features:

```tsx
<ActionTile
  title="Drain Management"
  description="Manage flood level monitors"
  icon={Gauge}
  accent="emerald"
  onClick={handleClick}
/>
```

## Features & Functionality

### 1. Real-time Monitoring
- Automatic sensor data refresh (30-second intervals)
- Live water level status with color-coded alerts
- Rainfall and flow rate tracking
- System status dashboard with critical alert detection

### 2. ML Predictions
- Submit custom predictions for any district
- Configurable parameters (rainfall, water level, humidity)
- Date and time period selection
- Confidence score display
- Historical prediction tracking

### 3. Flood Risk Visualization
- Dynamic heatmap generation from sensor data
- District-level risk assessment
- Sensor marker placement with detailed popups
- Multiple visualization modes (heatmap, sensors, predictions)
- Full-screen map capability

### 4. Alert Management
- Priority-based alert sorting
- Tone-coded severity indicators (danger, warning, info, success)
- Real-time alert generation from sensor data
- Alert feed with timestamps and details
- Dismissible alerts

### 5. Authentication & Authorization
- Role-based access control (admin vs operator)
- JWT token management
- Secure API communication
- Admin-only features (drain management, advanced controls)

### 6. Navigation & Routing
- Seamless navigation between dashboard sections
- Integrated post-flood rescue and ration distribution system
- Admin flood map creator access
- Drain management and flood level monitoring (admin only)
- Disease detection integration

## API Integration

### Sensor Packages
```
GET /api/sensor-packages
Authorization: Bearer {token}
```

### Sensor Predictions
```
GET /api/prediction/sensor-predictions?date={date}&period={period}
Authorization: Bearer {token}
```

### ML Prediction
```
POST /api/ml/prediction/predict
Content-Type: application/json

{
  "features": {
    "rainfall": 30,
    "latitude": 6.9271,
    "longitude": 79.8612,
    "elevation": 0,
    "elevation_m": 0,
    "water_level": 2.5,
    "humidity": 75,
    "date": "2026-07-02",
    "period": "Any"
  }
}
```

## Styling System

### Color Scheme
- **Primary (Cyan)**: Actions, highlights, primary UI elements
- **Secondary (Purple)**: Highlights, secondary actions
- **Critical (Red)**: Severe alerts, critical status
- **Warning (Amber)**: Medium priority alerts
- **Success (Green)**: Normal status, positive feedback
- **Neutral (Slate)**: Backgrounds, text, borders

### Design Tokens
- Modular spacing scale (xs → 3xl)
- Consistent border radius (sm → 2xl)
- Shadow system for depth (sm → 2xl)
- Smooth transitions and animations
- Responsive breakpoints (xs → 2xl)

### Component Variants
- **Cards**: Base, hover, interactive states
- **Buttons**: Primary, secondary, danger, ghost
- **Badges**: Success, warning, danger, info
- **Panels**: Primary, elevated, overlay styles

## Animations & Transitions

### Framer Motion
- Staggered container animations
- Individual component entrance animations
- Hover and tap interactions
- Smooth state transitions
- Page transition effects

### CSS Animations
- Pulse effects for live indicators
- Fade in/out transitions
- Slide animations
- Smooth color transitions

## Performance Optimizations

1. **Sensor Data Caching**: 30-second refresh interval
2. **Component Memoization**: Prevent unnecessary re-renders
3. **Lazy Loading**: Map and complex components load on demand
4. **Virtual Scrolling**: For large alert lists
5. **Debounced Updates**: API calls throttled and debounced

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

### Core
- `react@^18.2.0` - UI library
- `react-dom@^18.2.0` - React DOM renderer
- `typescript@^5.0.0` - Type safety

### UI & Styling
- `tailwindcss@^4.1.18` - Utility CSS framework
- `framer-motion@^11.0.0` - Animation library
- `lucide-react@^1.7.0` - Icon library
- `recharts@^3.8.1` - Chart components

### Mapping
- `leaflet@^1.9.4` - Map library
- `react-leaflet@^4.2.1` - React Leaflet integration
- `leaflet.heat` - Heatmap plugin
- `@turf/turf@^7.3.5` - Geospatial analysis

## Setup & Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Build for production**
   ```bash
   npm run build
   ```

## Environment Configuration

Required backend services:
- Node.js/Express API on `http://localhost:3001`
- Python ML service on `http://localhost:5000`
- MongoDB database (for persistence)

## Future Enhancements

- [ ] Real-time WebSocket updates for sensor data
- [ ] User preferences and customization
- [ ] Advanced analytics and reporting
- [ ] Export functionality (PDF, CSV)
- [ ] Multi-language support
- [ ] Mobile-optimized responsive design
- [ ] Dark/light theme toggle
- [ ] Custom alert rules and conditions
- [ ] Historical data visualization
- [ ] Integration with external weather services

## Contributing

To contribute to the dashboard:

1. Follow the established component structure
2. Use TypeScript for type safety
3. Apply consistent styling using design tokens
4. Add animations using Framer Motion
5. Test on multiple browsers and devices
6. Document component props and usage

## License

© 2026 SMART FLOOD MANAGEMENT - All Rights Reserved
