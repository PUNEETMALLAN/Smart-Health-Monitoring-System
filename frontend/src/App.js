import React, { useState, useEffect } from 'react';
import HealthForm from './components/HealthForm';
import HealthTrends from './pages/HealthTrends';
import Login from './pages/Login';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';

function App() {
  const [view, setView] = useState('predict');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('health_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('health_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('health_user');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        activeView={view}
        setView={setView}
        user={user}
        onLogout={handleLogout}
      />

      <div className="flex-1 ml-64">
        <TopBar user={user} />

        <main className="p-8">
          {analysisResult ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => setAnalysisResult(null)}
                className="mb-6 flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-all group"
              >
                <span className="mr-2 transform group-hover:-translate-x-1 transition-transform">←</span>
                Back to Dashboard
              </button>
              <AnalysisPage result={analysisResult} />
            </div>
          ) : (
            view === 'predict' ? (
              <HealthForm user={user} onAnalysisComplete={setAnalysisResult} />
            ) : view === 'trends' ? (
              <HealthTrends user={user} />
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-400 italic">
                Profile page coming soon...
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}

const AnalysisPage = ({ result }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 duration-700">
      <div className="bg-slate-50 p-8 border-b border-slate-200 text-center">
        <h1 className="text-3xl font-bold text-slate-800">AI Analysis Report</h1>
        <p className="text-slate-500 mt-1">Comprehensive health review for {result.file_name}</p>
      </div>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <span className="mr-2">📊</span> Vital Metrics
            </h3>
            <div className="space-y-3">
              {Object.entries(result.detected_metrics).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-500 text-sm capitalize">{key.replace('_', ' ')}</span>
                  <span className="font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-center text-white">
            <p className="text-indigo-100 text-sm mb-1">AI Confidence</p>
            <p className="text-3xl font-bold">{result.confidence_score}</p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <span className="mr-2">📝</span> Executive Summary
            </h3>
            <p className="text-slate-700 leading-relaxed text-lg italic">
              "{result.summary}"
            </p>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <span className="mr-2">💡</span> Personalized Recommendations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start p-4 bg-white rounded-xl border border-slate-100 text-slate-700 text-sm leading-relaxed hover:shadow-md transition-all">
                  <span className="bg-indigo-100 text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 shrink-0 font-bold text-xs">
                    {idx + 1}
                  </span>
                  {rec}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
