import React, { useState, useRef } from 'react';

interface Props {
  token: string;
}

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function AdminFloodMapCreator({ token }: Props) {

  // =========================
  // STATES
  // =========================
  const [trainStatus, setTrainStatus] = useState('');
  const [predictionResult, setPredictionResult] = useState('');
  const [predictionFile, setPredictionFile] = useState<File | null>(null);

  // IoT input (can be dynamic later)
  const [waterLevel, setWaterLevel] = useState('');
  const [soilMoisture, setSoilMoisture] = useState('');

  const [dataset1, setDataset1] = useState<File | null>(null);
  const [dataset2, setDataset2] = useState<File | null>(null);

  const [district, setDistrict] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [monthValues, setMonthValues] = useState<string[]>(Array(12).fill(''));
  const [status, setStatus] = useState('');
  const [pdfStatus, setPdfStatus] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAIN_API = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';
  const ML_API = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000/api';

  // =========================
  // CSV → JSON
  // =========================
  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim() !== "");
    const headers = lines[0].split(",").map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(",");
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ? values[i].trim() : "";
      });
      return obj;
    });
  };

  // =========================
  // TRAIN (ONLY ONCE)
  // =========================
  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dataset1 || !dataset2) {
      setTrainStatus("❌ Upload both CSVs");
      return;
    }

    try {
      setTrainStatus("⏳ Training...");

      const rainfallData = await parseCSV(dataset1);
      const floodData = await parseCSV(dataset2);

      const res = await fetch(`${ML_API}/training/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rainfall_data: rainfallData,
          flood_impact_data: floodData,
          target_column: "risk_level"
        })
      });

      const text = await res.text();
      console.log("TRAIN RAW:", text);

      const data = JSON.parse(text);

      if (!res.ok) {
        setTrainStatus(`❌ ${data.error || text}`);
        return;
      }

      setTrainStatus("✅ Model trained & saved");
    } catch (err) {
      console.error(err);
      setTrainStatus("❌ Training failed");
    }
  };

  // =========================
  // PREDICT (WEEKLY CSV + IoT)
  // =========================
  const handlePredictFromCSV = async () => {
    if (!predictionFile) {
      setPredictionResult("❌ Upload prediction CSV");
      return;
    }

    try {
      setPredictionResult("⏳ Predicting...");

      const csvData = await parseCSV(predictionFile);

      // Combine IoT data
      const combinedData = csvData.map(row => ({
        ...row,
        water_level: Number(waterLevel) || 0,
        soil_moisture: Number(soilMoisture) || 0
      }));

      const res = await fetch(`${ML_API}/prediction/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          data: combinedData
        })
      });

      const text = await res.text();
      console.log("PREDICT RAW:", text);

      const data = JSON.parse(text);

      if (!res.ok) {
        setPredictionResult(`❌ ${data.error || text}`);
        return;
      }

      setPredictionResult(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(err);
      setPredictionResult("❌ Prediction failed");
    }
  };

  // =========================
  // MANUAL ENTRY
  // =========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const monthlyData = monthValues.map((v, i) => ({
      month: monthNames[i],
      avgRainfall: parseFloat(v) || 0
    }));

    try {
      const res = await fetch(`${MAIN_API}/rainfall/admin/add-district`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          district,
          latitude: Number(latitude),
          longitude: Number(longitude),
          monthlyData
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(`❌ ${data.error}`);
        return;
      }

      setStatus("✅ Saved");
    } catch {
      setStatus("❌ Error");
    }
  };

  // =========================
  // PDF UPLOAD
  // =========================
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileInputRef.current?.files?.[0]) {
      setPdfStatus("Select PDF");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", fileInputRef.current.files[0]);

    const res = await fetch(`${MAIN_API}/rainfall/admin/upload-pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      setPdfStatus(`❌ ${data.error}`);
      return;
    }

    setPdfStatus("✅ PDF processed");
  };

  return (
    <div className="p-6 text-white bg-slate-900 max-w-4xl mx-auto">

      <h2 className="text-2xl mb-4">Flood ML Dashboard</h2>

      {/* TRAIN */}
      <div className="mb-6">
        <h3>Train Model (Run Once)</h3>
        <form onSubmit={handleTrain}>
          <input type="file" onChange={e => setDataset1(e.target.files?.[0] || null)} />
          <input type="file" onChange={e => setDataset2(e.target.files?.[0] || null)} />
          <button>Train</button>
        </form>
        <p>{trainStatus}</p>
      </div>

      {/* PREDICT */}
      <div className="mb-6">
        <h3>Weekly Prediction</h3>

        <input type="file" onChange={e => setPredictionFile(e.target.files?.[0] || null)} />

        <input
          placeholder="Water Level"
          value={waterLevel}
          onChange={e => setWaterLevel(e.target.value)}
        />

        <input
          placeholder="Soil Moisture"
          value={soilMoisture}
          onChange={e => setSoilMoisture(e.target.value)}
        />

        <button onClick={handlePredictFromCSV}>Predict</button>

        <pre>{predictionResult}</pre>
      </div>

      {/* PDF */}
      <div>
        <form onSubmit={handlePdfUpload}>
          <input ref={fileInputRef} type="file" />
          <button>Upload PDF</button>
        </form>
        <p>{pdfStatus}</p>
      </div>

      {/* MANUAL */}
      <form onSubmit={handleSubmit}>
        <input placeholder="District" value={district} onChange={e => setDistrict(e.target.value)} />
        <input placeholder="Lat" value={latitude} onChange={e => setLatitude(e.target.value)} />
        <input placeholder="Lng" value={longitude} onChange={e => setLongitude(e.target.value)} />

        {monthNames.map((m, i) => (
          <input key={i}
            placeholder={m}
            value={monthValues[i]}
            onChange={e => {
              const arr = [...monthValues];
              arr[i] = e.target.value;
              setMonthValues(arr);
            }}
          />
        ))}

        <button>Save</button>
      </form>

      <p>{status}</p>
    </div>
  );
}