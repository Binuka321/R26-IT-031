import React from 'react';
import ReactDOM from 'react-dom/client';
import FloodMapApp from './FloodMap/FloodMapApp.jsx';
import 'leaflet/dist/leaflet.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FloodMapApp />
  </React.StrictMode>
);