import React, { useState } from 'react';
import { healthService } from '../services/healthService';
import RiskCard from './RiskCard';

const HealthForm = ({ user, onAnalysisComplete, onPredictionComplete }) => {
  const [formData, setFormData] = useState({
    age: '', gender: '', systolic_bp: '', diastolic_bp: '',
    blood_sugar: '', bmi: '', heart_rate: '', smoking: '', exercise: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Report Upload State
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const numericData = Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [key, key === 'bmi' ? parseFloat(value) : parseInt(value, 10)])
      );
      const prediction = await healthService.predictRisk(numericData);
      setResult(prediction);
      const timestamp = prediction.timestamp || new Date().toISOString();
      onPredictionComplete({ data: numericData, prediction, timestamp });
      try {
        await healthService.saveHealthLog(user.user_id, numericData);
      } catch (saveError) {
        setError('Your prediction is ready, but the reading could not be saved. Please check your connection and try again.');
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Could not analyze your health details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Choose a report file before starting the analysis.');
      return;
    }

    setUploadError('');
    setUploading(true);
    try {
      const userId = user?.user_id || 'test_user_123';
      const results = await healthService.analyzeReport(userId, file);
      onAnalysisComplete(results);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setUploadError(typeof detail === 'string' ? detail : 'The report could not be analyzed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-white drop-shadow-lg uppercase tracking-widest font-serif">
        Smart Health Predictor
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Manual Prediction Form */}
          <div className="bg-white/30 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-2xl space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4">Manual Input</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Age</label>
                  <input type="number" name="age" min="18" max="120" required value={formData.age} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Gender (0:M, 1:F)</label>
                  <input type="number" name="gender" min="0" max="1" required value={formData.gender} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Systolic BP</label>
                  <input type="number" name="systolic_bp" min="70" max="250" required value={formData.systolic_bp} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Diastolic BP</label>
                  <input type="number" name="diastolic_bp" min="40" max="150" required value={formData.diastolic_bp} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Blood Sugar</label>
                  <input type="number" name="blood_sugar" min="40" max="500" required value={formData.blood_sugar} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">BMI</label>
                  <input type="number" step="0.1" name="bmi" min="10" max="60" required value={formData.bmi} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Heart Rate</label>
                  <input type="number" name="heart_rate" min="30" max="220" required value={formData.heart_rate} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Smoking (0:N, 1:Y)</label>
                  <input type="number" name="smoking" min="0" max="1" required value={formData.smoking} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-white mb-1 ml-1">Exercise (0:N, 1:Y)</label>
                  <input type="number" name="exercise" min="0" max="1" required value={formData.exercise} onChange={handleChange} className="w-full p-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold shadow-lg hover:bg-white/90 active:scale-95 transition-all duration-200">
                {loading ? 'Analyzing...' : 'Analyze Health Risk'}
              </button>
              {error && <p className="form-error" role="alert">{error}</p>}
            </form>

          </div>
        </div>

        <div className="flex flex-col justify-center space-y-6">
          {result && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RiskCard
                riskLevel={result.risk_level}
                recommendations={result.recommendations}
                explanation={result.explanation}
              />
            </div>
          )}

          {!result && (
            <div className="text-center p-10 border-2 border-dashed border-white/30 rounded-3xl text-white/60 backdrop-blur-sm">
              Enter your health parameters or upload a report to see your risk prediction.
            </div>
          )}

          <section className="prediction-report-panel">
            <h2 className="text-xl font-semibold text-white">AI Report Analysis</h2>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                setUploadError('');
              }}
              aria-label="Choose a health report"
              className="block w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white file:text-indigo-600 hover:file:bg-white/90 transition-all cursor-pointer"
            />
            <button
              type="button"
              onClick={handleFileUpload}
              disabled={uploading || !file}
              className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-600 active:scale-95 transition-all duration-200 disabled:opacity-70"
            >
              {uploading ? 'Analyzing Report...' : 'Upload & Analyze Report'}
            </button>
            {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
          </section>

          <div className="p-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white text-xs leading-relaxed">
            <strong className="font-bold">Disclaimer:</strong> This tool provides AI-assisted risk prediction based on the data provided.
            It is NOT a medical diagnosis. Please consult a qualified healthcare professional for any medical decisions.
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthForm;
