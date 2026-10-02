import React, { useEffect, useState } from 'react';
import Login from './pages/Login';
import HealthForm from './components/HealthForm';
import { healthService } from './services/healthService';

const navItems = [
  { key: 'dashboard', icon: '◫', label: 'Dashboard' },
  { key: 'history', icon: '📈', label: 'Health History' },
  { key: 'prediction', icon: '🧠', label: 'AI Prediction' },
  { key: 'assistant', icon: '🤖', label: 'Chatbot' },
  { key: 'alerts', icon: '🔔', label: 'Alerts' },
  { key: 'reports', icon: '🧾', label: 'Reports' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

const pageCopy = {
  dashboard: ['Good morning', 'Your health overview for today.'],
  history: ['Health History', 'Review your recent health readings.'],
  prediction: ['AI Prediction', 'Enter your health data for a risk assessment.'],
  assistant: ['Health Chatbot', 'Ask questions about your health and wellness.'],
  alerts: ['Alerts & Notifications', 'Stay informed about your health.'],
  reports: ['Health Reports', 'Your health summaries and assessments.'],
  profile: ['Your Profile', 'Manage your personal health information.'],
};

function App() {
  const [view, setView] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('health_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('health_user');
        setHistoryError('Saved login information was invalid. Please sign in again.');
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.user_id) return undefined;

    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const records = await healthService.getUserHistory(user.user_id);
        const sortedRecords = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        if (cancelled) return;
        setHealthHistory(sortedRecords);

        const latestRecord = sortedRecords[sortedRecords.length - 1];
        if (latestRecord?.data) {
          const prediction = await healthService.predictRisk(latestRecord.data);
          if (!cancelled) {
            setLatestPrediction({ data: latestRecord.data, prediction, timestamp: latestRecord.timestamp });
          }
        } else if (!cancelled) {
          setLatestPrediction(null);
        }
      } catch (error) {
        if (!cancelled) {
          setHistoryError('Could not load your saved health results. Please check your connection and try again.');
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    loadHistory();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.user_id]);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setHealthHistory([]);
    setLatestPrediction(null);
    setHistoryError('');
    setView('dashboard');
    localStorage.setItem('health_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setHealthHistory([]);
    setLatestPrediction(null);
    setHistoryError('');
    localStorage.removeItem('health_user');
  };

  const handlePredictionComplete = ({ data, prediction, timestamp }) => {
    const record = { data, timestamp };
    setHealthHistory((current) => [...current, record].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    setLatestPrediction({ data, prediction, timestamp });
  };

  const latestRecord = healthHistory[healthHistory.length - 1];
  const filteredHealthHistory = [...healthHistory]
    .reverse()
    .filter((entry) => {
      const searchText = `${new Date(entry.timestamp).toLocaleString()} ${entry.data.systolic_bp}/${entry.data.diastolic_bp} ${entry.data.heart_rate} ${entry.data.blood_sugar} ${entry.data.bmi}`.toLowerCase();
      return searchText.includes(historySearch.trim().toLowerCase());
    });

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const [pageTitle, pageSubtitle] = pageCopy[view];

  return (
    <div className="app-shell">
      <aside className="sidebar glass-panel">
        <div className="brand-row">
          <div className="brand-mark">H</div>
          <div className="brand-text">
            <span className="brand-main">Health</span>
            <span className="brand-accent">Predict</span>
          </div>
        </div>

        <div className="nav-block">
          <p className="nav-title">Main Menu</p>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => setView(item.key)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

      </aside>

      <div className="content-panel">
        <header className="topbar glass-panel">
          <div>
            <h2>
              {view === 'dashboard' ? (
                <>{pageTitle}, <span>{user?.name || 'John Doe'}</span> 👋</>
              ) : (
                <>{pageTitle}</>
              )}
            </h2>
            <p>{pageSubtitle}</p>
          </div>

          <div className="topbar-right">
            {view === 'history' && (
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  aria-label="Search health history"
                  placeholder="Search history..."
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                />
                {historySearch && <button className="clear-search" type="button" onClick={() => setHistorySearch('')} aria-label="Clear history search">×</button>}
              </label>
            )}
            <div className="top-date-box">
              <p>{user?.name || 'John Doe'}</p>
              <small>Premium User</small>
            </div>
            <div className="top-avatar">{(user?.name || 'J').charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <main className={`dashboard-grid page-${view}`}>
          {view === 'dashboard' && (
            <>
          <section className="glass-panel hero-block">
            <div className="panel-row between">
              <div className="section-heading">
                <span className="panel-icon">❤</span>
                <div>
                  <strong>Today’s Vitals</strong>
                  <small>{latestRecord ? `Submitted ${new Date(latestRecord.timestamp).toLocaleString()}` : 'No readings submitted'}</small>
                </div>
              </div>
              <span className={`live-tag ${latestRecord ? '' : 'waiting'}`}><i /> {latestRecord ? 'Saved entry' : 'Awaiting entry'}</span>
            </div>

            {historyLoading ? <EmptyState>Loading your saved readings…</EmptyState> : !latestRecord ? (
              <EmptyState onAction={() => setView('prediction')} action="Enter health details">
                Your readings will appear here after your first health analysis.
              </EmptyState>
            ) : (
              <div className="metric-row">
                <MetricTiny label="Heart Rate" value={latestRecord.data.heart_rate} unit="bpm" color="cyan" />
                <MetricTiny label="Blood Pressure" value={`${latestRecord.data.systolic_bp}/${latestRecord.data.diastolic_bp}`} unit="mmHg" color="mint" />
                <MetricTiny label="Blood Sugar" value={latestRecord.data.blood_sugar} unit="mg/dL" color="purple" />
                <MetricTiny label="BMI" value={latestRecord.data.bmi} unit="" color="blue" />
              </div>
            )}
            {historyError && <p className="inline-error">{historyError}</p>}
          </section>

          <section className="glass-panel mini-summary card-span-2">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">◉</span>
                <strong>Latest Risk Result</strong>
              </div>
              {latestPrediction && <span className="pill">{latestPrediction.prediction.risk_level}</span>}
            </div>
            {latestPrediction ? (
              <div className="latest-risk-result">
                <strong>{latestPrediction.prediction.risk_level}</strong>
                <p>{latestPrediction.prediction.explanation}</p>
              </div>
            ) : (
              <EmptyState onAction={() => setView('prediction')} action="Analyze your health">
                No risk result yet.
              </EmptyState>
            )}
          </section>

          <section className="glass-panel dashboard-card trend-card">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">▣</span>
                <strong>Health Trends</strong>
              </div>
              {healthHistory.length > 0 && <span className="tag">Recent entries</span>}
            </div>
            {healthHistory.length > 0 ? <HealthTrendChart history={healthHistory} /> : (
              <EmptyState onAction={() => setView('prediction')} action="Add your first reading">
                A trend chart will appear after you submit health details.
              </EmptyState>
            )}
          </section>

          <section className="glass-panel dashboard-card prediction-card">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">✦</span>
                <strong>AI Risk Prediction</strong>
              </div>
              {latestPrediction && <span className="tag">{latestPrediction.prediction.risk_level}</span>}
            </div>

            {latestPrediction ? <div className="risk-box">
              <div className="risk-left">
                <h4>Cardiovascular Risk</h4>
                <strong>{latestPrediction.prediction.risk_level}</strong>
              </div>
              <div className="risk-icon">⚕</div>
            </div> : <EmptyState onAction={() => setView('prediction')} action="Enter health details">No prediction yet.</EmptyState>}

            {latestPrediction && <div className="risk-metrics">
              {[
                ['Age', latestPrediction.data.age],
                ['Blood Pressure', `${latestPrediction.data.systolic_bp}/${latestPrediction.data.diastolic_bp}`],
                ['Blood Sugar', latestPrediction.data.blood_sugar],
                ['BMI', latestPrediction.data.bmi],
                ['Exercise', latestPrediction.data.exercise ? 'Yes' : 'No'],
                ['Smoking', latestPrediction.data.smoking ? 'Yes' : 'No'],
              ].map(([label, value]) => (
                <div key={label} className="risk-metric-item">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>}
          </section>
            </>
          )}

          {view === 'assistant' && <section className="glass-panel dashboard-card assistant-card">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">✦</span>
                <strong>Health Chatbot</strong>
              </div>
              {latestPrediction && <span className="tag">Personalized</span>}
            </div>
            {latestPrediction ? (
              <div className="assistant-box">
                <p>{latestPrediction.prediction.explanation}</p>
                <ul>{latestPrediction.prediction.recommendations.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ul>
              </div>
            ) : <EmptyState onAction={() => setView('prediction')} action="Enter health details">Personalized guidance will appear after your first analysis.</EmptyState>}
            <div className="chat-input-row">
              <input
                type="text"
                aria-label="Message the health chatbot"
                placeholder="Ask a question about your health..."
              />
            </div>
          </section>}

          {view === 'history' && <section className="glass-panel dashboard-card history-card">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">▣</span>
                <strong>Health History</strong>
              </div>
              {healthHistory.length > 0 && <span className="tag">{healthHistory.length} entries</span>}
            </div>

            {healthHistory.length > 0 ? <div className="history-grid">
              {filteredHealthHistory.map((entry, idx) => (
                <div key={`${entry.timestamp}-${idx}`} className="history-item">
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  <strong>{entry.data.systolic_bp}/{entry.data.diastolic_bp} mmHg</strong>
                  <small>Heart rate {entry.data.heart_rate} bpm · Sugar {entry.data.blood_sugar} mg/dL · BMI {entry.data.bmi}</small>
                </div>
              ))}
            </div> : <EmptyState loading={historyLoading} onAction={() => setView('prediction')} action="Add health details">{historyError || 'Your submitted health readings will appear here.'}</EmptyState>}
            {healthHistory.length > 0 && filteredHealthHistory.length === 0 && <EmptyState>No health history matches “{historySearch}”.</EmptyState>}
          </section>}

          {view === 'alerts' && <section className="glass-panel dashboard-card card-span-2 alerts-page-card">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">⚑</span>
                <strong>Alerts & Notifications</strong>
              </div>
            </div>
            {latestPrediction ? <div className="alert-list">
              <div className={`alert-item ${latestPrediction.prediction.risk_score === 2 ? 'danger' : 'normal'}`}><span>•</span> Latest assessment: {latestPrediction.prediction.risk_level}</div>
              {latestPrediction.prediction.recommendations.map((recommendation) => <div className="alert-item normal" key={recommendation}><span>•</span> {recommendation}</div>)}
            </div> : <EmptyState onAction={() => setView('prediction')} action="Analyze health">No health alerts or recommendations yet.</EmptyState>}
          </section>}

          {view === 'reports' && <section className="glass-panel dashboard-card card-span-2 reports-page-card">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">◫</span>
                <strong>Health Reports</strong>
              </div>
            </div>
            <EmptyState onAction={() => setView('prediction')} action="Analyze a report">No report results yet. Upload a report to view its analysis here.</EmptyState>
          </section>}

          {view === 'profile' && <section className="glass-panel dashboard-card card-span-2 profile-panel">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">☰</span>
                <strong>User Profile</strong>
              </div>
            </div>
            <div className="profile-panel-inner">
              <div className="profile-profile-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
              <div className="profile-info">
                <h4>{user?.name || 'John Doe'}</h4>
              <p>
                {user?.age ? `Age ${user.age}` : latestRecord ? `Age ${latestRecord.data.age}` : 'Age not provided'}
                {user?.gender !== undefined && user.gender !== null ? ` · ${user.gender === 0 ? 'Male' : 'Female'}` : ''}
              </p>
              <small>Account profile</small>
              </div>
            </div>
            <div className="profile-meta">
              {user?.height_cm && <span>Height: {user.height_cm} cm</span>}
              {user?.weight_kg && <span>Weight: {user.weight_kg} kg</span>}
              {user?.blood_group && <span>Blood group: {user.blood_group}</span>}
              {latestRecord && <>
              <span>BMI: {latestRecord.data.bmi}</span>
              <span>Heart rate: {latestRecord.data.heart_rate} bpm</span>
              <span>Blood pressure: {latestRecord.data.systolic_bp}/{latestRecord.data.diastolic_bp}</span>
              </>}
              {!user?.height_cm && !user?.weight_kg && !user?.blood_group && !latestRecord && <span>No optional health details added yet.</span>}
            </div>
            <button className="profile-logout-btn" onClick={handleLogout}>
              <span>⎋</span>
              Logout
            </button>
          </section>}

          {view === 'prediction' && <div className="prediction-page-content"><HealthForm user={user} onPredictionComplete={handlePredictionComplete} onAnalysisComplete={() => {}} /></div>}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ children, action, onAction, loading = false }) {
  return (
    <div className="empty-state">
      <p>{children}</p>
      {onAction && <button type="button" onClick={onAction}>{action}</button>}
      {loading && <span className="sr-only">Loading</span>}
    </div>
  );
}

function HealthTrendChart({ history }) {
  const visibleRecords = history.slice(-7);
  const makePath = (key) => {
    const values = visibleRecords.map((record) => record.data[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;
    return values.map((value, index) => {
      const x = values.length === 1 ? 310 : (index / (values.length - 1)) * 620;
      const y = 150 - ((value - min) / spread) * 120;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  };

  return (
    <>
      <div className="trend-legend">
        <span><i className="legend-heart" /> Heart Rate</span>
        <span><i className="legend-pressure" /> Systolic BP</span>
        <span><i className="legend-sugar" /> Blood Sugar</span>
      </div>
      <div className="line-chart">
        <div className="chart-y-labels"><span>Higher</span><span /></div>
        <svg viewBox="0 0 620 180" role="img" aria-label="Submitted health readings trend" preserveAspectRatio="none">
          {[25, 65, 105, 145].map((y) => <line key={y} x1="0" x2="620" y1={y} y2={y} className="grid-line" />)}
          <path d={makePath('heart_rate')} className="chart-line heart-line" />
          <path d={makePath('systolic_bp')} className="chart-line pressure-line" />
          <path d={makePath('blood_sugar')} className="chart-line oxygen-line" />
        </svg>
      </div>
      <div className="chart-labels">
        {visibleRecords.map((record, index) => <span key={`${record.timestamp}-${index}`}>{new Date(record.timestamp).toLocaleDateString()}</span>)}
      </div>
    </>
  );
}

function MetricTiny({ label, value, unit, color }) {
  return (
    <div className={`metric-tile ${color}`}>
      <div className="metric-heading"><span className="metric-icon">{label === 'Heart Rate' ? '♥' : label === 'Blood Pressure' ? '✚' : label === 'SpO₂' ? '◉' : '♨'}</span><small>{label}</small></div>
      <strong>{value}<small className="metric-unit">{unit}</small></strong>
      <svg viewBox="0 0 180 30" className="tiny-wave" aria-hidden="true">
        <path d="M0 22 C18 19 19 10 34 15 S51 24 68 17 S86 8 101 13 S126 25 143 15 S163 9 180 4" />
      </svg>
    </div>
  );
}

export default App;
