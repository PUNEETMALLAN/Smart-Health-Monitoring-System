import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { healthService } from '../services/healthService';

const HealthTrends = ({ user }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use the authenticated user's ID, fallback to demo
  const userId = user?.user_id || 'demo_user_123';

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await healthService.getUserHistory(userId);
        // Sort history by timestamp
        const sortedData = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setHistory(sortedData);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [userId]);

  if (loading) return <div className="text-center p-10 text-white">Loading health trends...</div>;
  if (history.length === 0) return <div className="text-center p-10 text-white">No health history available yet. Start by adding data!</div>;

  // Transform data for the chart
  const chartData = history.map(entry => ({
    date: new Date(entry.timestamp).toLocaleDateString(),
    bp: entry.data.systolic_bp,
    sugar: entry.data.blood_sugar,
    bmi: entry.data.bmi
  }));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h2 className="text-3xl font-bold text-center text-white drop-shadow-md mb-8">Health Trends Over Time</h2>

      <div className="bg-white/30 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white/20 h-[500px]">
        <h3 className="text-xl font-semibold mb-4 text-white">Vital Signs Trend</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.8)"
              tick={{fill: 'rgba(255,255,255,0.8)', fontSize: 12}}
            />
            <YAxis
              stroke="rgba(255,255,255,0.8)"
              tick={{fill: 'rgba(255,255,255,0.8)', fontSize: 12}}
            />
            <Tooltip
              contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none'}}
              itemStyle={{color: '#4f46e5'}}
            />
            <Legend />
            <Line type="monotone" dataKey="bp" stroke="#ef4444" name="Systolic BP" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="sugar" stroke="#3b82f6" name="Blood Sugar" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="bmi" stroke="#10b981" name="BMI" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {history.slice(-3).reverse().map((log, idx) => (
          <div key={idx} className="p-4 bg-white/30 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 text-white">
            <p className="text-xs text-white/60 mb-2">{new Date(log.timestamp).toLocaleString()}</p>
            <div className="flex justify-between text-sm font-medium">
              <span className="flex flex-col">
                <span className="text-white/60 text-[10px] uppercase">BP</span>
                <strong>{log.data.systolic_bp}/{log.data.diastolic_bp}</strong>
              </span>
              <span className="flex flex-col">
                <span className="text-white/60 text-[10px] uppercase">Sugar</span>
                <strong>{log.data.blood_sugar}</strong>
              </span>
              <span className="flex flex-col">
                <span className="text-white/60 text-[10px] uppercase">BMI</span>
                <strong>{log.data.bmi}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HealthTrends;
