import React, { useEffect, useRef, useState } from 'react';
import Login from './pages/Login';
import HealthForm from './components/HealthForm';
import ImageScreening from './components/ImageScreening';
import { healthService } from './services/healthService';

const navItems = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { key: 'history', icon: 'history', label: 'Health History' },
  { key: 'prediction', icon: 'prediction', label: 'AI Prediction' },
  { key: 'image-screening', icon: 'screening', label: 'Image Screening' },
  { key: 'assistant', icon: 'assistant', label: 'Chatbot' },
  { key: 'reports', icon: 'reports', label: 'Reports' },
  { key: 'profile', icon: 'profile', label: 'Profile' },
];

const DockIcon = ({ name }) => {
  const sharedProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const shapes = {
    dashboard: (
      <g {...sharedProps}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </g>
    ),
    history: (
      <g {...sharedProps}>
        <path d="M4 19.5h16M4.5 18V5" />
        <path d="m6.5 15 4-4 3 2 5-6" />
        <path d="M15.5 7H19v3.5" />
      </g>
    ),
    prediction: (
      <g {...sharedProps}>
        <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.8 2.8m6.4 6.4L18 18m0-12-2.8 2.8m-6.4 6.4L6 18" />
        <circle cx="12" cy="12" r="3.5" />
      </g>
    ),
    screening: (
      <g {...sharedProps}>
        <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
        <path d="M12 8v8M8 12h8" />
      </g>
    ),
    assistant: (
      <g {...sharedProps}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
        <path d="M8 8.5h8M8 12h5" />
      </g>
    ),
    reports: (
      <g {...sharedProps}>
        <path d="M7 3.5h7l4.5 4.5v12A1.5 1.5 0 0 1 17 21.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" />
        <path d="M14 3.5V8h4.5M8.5 12h7M8.5 15.5h7M8.5 19h4" />
      </g>
    ),
    profile: (
      <g {...sharedProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </g>
    ),
  };

  return (
    <svg className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
      {shapes[name]}
    </svg>
  );
};

const pageCopy = {
  dashboard: ['', 'Your health overview for today.'],
  history: ['Health History', 'Review your recent health readings.'],
  prediction: ['AI Prediction', 'Enter your health data for a risk assessment.'],
  'image-screening': ['Image Screening', 'Review an image and find safe next steps.'],
  assistant: ['Health Chatbot', 'Ask questions about your health and wellness.'],
  reports: ['Health Reports', 'Your health summaries and assessments.'],
  profile: ['Your Profile', 'Manage your personal health information.'],
};

const profileAvatars = [
  { id: 'avatar_1', emoji: '👩🏻', label: 'Ava', gender: 1 },
  { id: 'avatar_2', emoji: '👨🏽', label: 'Noah', gender: 0 },
  { id: 'avatar_3', emoji: '👩🏽', label: 'Mia', gender: 1 },
  { id: 'avatar_4', emoji: '👨🏻', label: 'Leo', gender: 0 },
  { id: 'avatar_5', emoji: '👩🏿', label: 'Zuri', gender: 1 },
  { id: 'avatar_6', emoji: '👨🏿', label: 'Kai', gender: 0 },
];

const getDefaultProfileAvatar = (gender) => (
  profileAvatars.find((avatar) => avatar.gender === Number(gender)) || profileAvatars[0]
);

const getProfileAvatar = (avatarId, gender) => {
  const avatar = profileAvatars.find((option) => option.id === avatarId);
  if (avatar && (gender === undefined || gender === null || avatar.gender === Number(gender))) {
    return avatar;
  }
  return getDefaultProfileAvatar(gender);
};

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

function App() {
  const hasAccountAction = useRef(
    new URL(window.location.href).searchParams.has('verify_email')
    || new URL(window.location.href).searchParams.has('reset_password')
  );
  const [view, setView] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [reportAnalysis, setReportAnalysis] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    age: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    blood_group: '',
    avatar_id: getDefaultProfileAvatar(user?.gender).id,
  });

  useEffect(() => {
    if (hasAccountAction.current) {
      return;
    }

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

  const handleChatSubmit = async (event) => {
    event.preventDefault();
    const content = chatDraft.trim();
    if (!content || chatLoading) return;

    const nextMessages = [...chatMessages, { role: 'user', content }];
    setChatMessages(nextMessages);
    setChatDraft('');
    setChatError('');
    setChatLoading(true);

    try {
      const response = await healthService.chat(nextMessages.slice(-20));
      setChatMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setChatError(typeof detail === 'string' ? detail : 'Could not send your question. Please try again.');
    } finally {
      setChatLoading(false);
    }
  };

  const handlePredictionComplete = ({ data, prediction, timestamp }) => {
    const record = { data, timestamp };
    setHealthHistory((current) => [...current, record].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    setLatestPrediction({ data, prediction, timestamp });
  };

  const handleReportAnalysisComplete = (analysis) => {
    setReportAnalysis(analysis);
    setView('reports');
  };

  const latestRecord = healthHistory[healthHistory.length - 1];
  const beginProfileEdit = () => {
    setProfileUsername(user?.username || (user?.user_id === 'admin_123' ? 'admin' : user?.user_id === 'user_456' ? 'user' : ''));
    setProfilePassword('');
    setProfileForm({
      name: user?.name || '',
      age: user?.age ?? latestRecord?.data.age ?? '',
      gender: user?.gender ?? '',
      height_cm: user?.height_cm ?? '',
      weight_kg: user?.weight_kg ?? '',
      blood_group: user?.blood_group || '',
      avatar_id: getProfileAvatar(user?.avatar_id, user?.gender).id,
    });
    setProfileError('');
    setProfileNotice('');
    setEditingProfile(true);
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    setProfileSaving(true);
    try {
      const response = await healthService.updateProfile({
        user_id: user.user_id,
        username: profileUsername.trim(),
        password: profilePassword,
        name: profileForm.name.trim(),
        age: Number(profileForm.age),
        gender: Number(profileForm.gender),
        height_cm: profileForm.height_cm === '' ? null : Number(profileForm.height_cm),
        weight_kg: profileForm.weight_kg === '' ? null : Number(profileForm.weight_kg),
        blood_group: profileForm.blood_group || null,
        avatar_id: profileForm.avatar_id,
      });
      const updatedUser = { ...user, username: profileUsername.trim(), ...response.profile };
      setUser(updatedUser);
      localStorage.setItem('health_user', JSON.stringify(updatedUser));
      setProfilePassword('');
      setEditingProfile(false);
      setProfileNotice('Your profile was updated.');
    } catch (error) {
      const detail = error.response?.data?.detail;
      setProfileError(typeof detail === 'string' ? detail : 'Could not update your profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfileFieldChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((current) => {
      if (name !== 'gender') {
        return { ...current, [name]: value };
      }
      return {
        ...current,
        gender: value,
        avatar_id: getDefaultProfileAvatar(value).id,
      };
    });
  };

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
          <img className="brand-mark" src="/smart-health-mark.png" alt="" />
          <div className="brand-text">
            <span className="brand-main">Smart</span>
            <span className="brand-accent">Health</span>
          </div>
        </div>

        <div className="nav-block">
          <p className="nav-title">Main Menu</p>
          <div className="nav-items">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${view === item.key ? 'active' : ''}`}
                aria-label={item.label}
                data-label={item.label}
                onClick={() => setView(item.key)}
              >
                <span><DockIcon name={item.icon} /></span>
              </button>
            ))}
          </div>
        </div>

      </aside>

      <div className={`content-panel ${view === 'prediction' ? 'prediction-layout' : ''}`}>
        <header className="topbar glass-panel">
          <div>
            <h2>
              {view === 'dashboard' ? (
                <>{getTimeGreeting()}, <span>{user?.name || 'John Doe'}</span> 👋</>
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
            <div className="top-avatar" aria-label={`${getProfileAvatar(user?.avatar_id, user?.gender).label} profile picture`}>
              {getProfileAvatar(user?.avatar_id, user?.gender).emoji}
            </div>
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
            {chatMessages.length > 0 && <div className="chat-messages" role="log" aria-live="polite">
              {chatMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                  <strong>{message.role === 'user' ? 'You' : 'Health assistant'}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
              {chatLoading && <p className="chat-status" role="status">The assistant is responding…</p>}
            </div>}
            {chatError && <p className="chat-error" role="alert">{chatError}</p>}
            <form className="chat-input-row" onSubmit={handleChatSubmit}>
              <input
                type="text"
                aria-label="Message the health chatbot"
                placeholder="Ask a question about your health..."
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" aria-label="Send message" disabled={chatLoading || !chatDraft.trim()}>
                {chatLoading ? '…' : '↑'}
              </button>
            </form>
          </section>}

          {view === 'image-screening' && <ImageScreening />}

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

          {view === 'reports' && <section className="glass-panel dashboard-card card-span-2 reports-page-card">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">◫</span>
                <strong>Health Reports</strong>
              </div>
            </div>
            {reportAnalysis ? (
              <article className="report-analysis-result">
                <div className="report-analysis-heading">
                  <div>
                    <strong>{reportAnalysis.file_name}</strong>
                    <small>{reportAnalysis.file_type} · Analyzed {new Date(reportAnalysis.analyzed_at).toLocaleString()}</small>
                  </div>
                  <span className="tag">Confidence: {reportAnalysis.confidence_score}</span>
                </div>
                <p className="report-analysis-summary">{reportAnalysis.summary}</p>
                <p className="report-disclaimer">This AI-generated summary is for informational purposes only and is not a medical diagnosis. Consult a qualified healthcare professional about your results.</p>
                <h3>Detected measurements</h3>
                <div className="report-metrics-grid">
                  {Object.entries(reportAnalysis.detected_metrics).map(([metric, value]) => (
                    <div key={metric} className="report-metric">
                      <span>{metric.replaceAll('_', ' ')}</span>
                      <strong>{value || 'Not found'}</strong>
                    </div>
                  ))}
                </div>
                <h3>Recommended next steps</h3>
                <ul className="report-recommendations">
                  {reportAnalysis.recommendations.map((recommendation, index) => (
                    <li key={`${index}-${recommendation}`}>{recommendation}</li>
                  ))}
                </ul>
                <button className="report-analyze-again" onClick={() => setView('prediction')}>Analyze another report</button>
              </article>
            ) : (
              <EmptyState onAction={() => setView('prediction')} action="Analyze a report">No report results yet. Upload a report to view its analysis here.</EmptyState>
            )}
          </section>}

          {view === 'profile' && <section className="glass-panel dashboard-card card-span-2 profile-panel">
            <div className="panel-row between">
              <div>
                <span className="panel-icon small">☰</span>
                <strong>User Profile</strong>
              </div>
              {!editingProfile && (
                <button type="button" className="profile-edit-trigger" onClick={beginProfileEdit}>
                  Edit profile
                </button>
              )}
            </div>
            {editingProfile ? (
              <form className="profile-edit-form" onSubmit={handleProfileSave}>
                <fieldset className="profile-avatar-fieldset">
                  <legend>Choose a profile picture</legend>
                  <div className="profile-avatar-options">
                    {profileAvatars
                      .filter((avatar) => profileForm.gender === '' || avatar.gender === Number(profileForm.gender))
                      .map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        className={`profile-avatar-option ${profileForm.avatar_id === avatar.id ? 'selected' : ''}`}
                        onClick={() => setProfileForm((current) => ({ ...current, avatar_id: avatar.id }))}
                        aria-label={`Choose ${avatar.label} profile picture`}
                        aria-pressed={profileForm.avatar_id === avatar.id}
                      >
                        <span className="profile-avatar-illustration" aria-hidden="true">{avatar.emoji}</span>
                        <span>{avatar.label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span>Account username (verification only)</span>
                  <input
                    type="text"
                    autoComplete="username"
                    value={profileUsername}
                    onChange={(event) => setProfileUsername(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Confirm your password to save</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={profilePassword}
                    onChange={(event) => setProfilePassword(event.target.value)}
                    required
                  />
                </label>
                <div className="profile-edit-grid">
                  <label>
                    <span>Full name</span>
                    <input name="name" type="text" value={profileForm.name} onChange={handleProfileFieldChange} required maxLength="100" />
                  </label>
                  <label>
                    <span>Age</span>
                    <input name="age" type="number" min="18" max="120" value={profileForm.age} onChange={handleProfileFieldChange} required />
                  </label>
                  <label>
                    <span>Gender</span>
                    <select name="gender" value={profileForm.gender} onChange={handleProfileFieldChange} required>
                      <option value="" disabled>Select</option>
                      <option value="0">Male</option>
                      <option value="1">Female</option>
                    </select>
                  </label>
                  <label>
                    <span>Height (cm)</span>
                    <input name="height_cm" type="number" min="50" max="260" step="0.1" value={profileForm.height_cm} onChange={handleProfileFieldChange} />
                  </label>
                  <label>
                    <span>Weight (kg)</span>
                    <input name="weight_kg" type="number" min="20" max="500" step="0.1" value={profileForm.weight_kg} onChange={handleProfileFieldChange} />
                  </label>
                  <label>
                    <span>Blood group</span>
                    <select name="blood_group" value={profileForm.blood_group} onChange={handleProfileFieldChange}>
                      <option value="">Prefer not to say</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {profileError && <p className="profile-form-message error" role="alert">{profileError}</p>}
                <div className="profile-edit-actions">
                  <button type="button" className="profile-cancel-btn" onClick={() => setEditingProfile(false)} disabled={profileSaving}>Cancel</button>
                  <button type="submit" className="profile-save-btn" disabled={profileSaving}>
                    {profileSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {profileNotice && <p className="profile-form-message success" role="status">{profileNotice}</p>}
                <div className="profile-panel-inner">
                  <div className="profile-profile-avatar" aria-label={`${getProfileAvatar(user?.avatar_id, user?.gender).label} profile picture`}>
                    {getProfileAvatar(user?.avatar_id, user?.gender).emoji}
                  </div>
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
              </>
            )}
            <button className="profile-logout-btn" onClick={handleLogout}>
              <span>⎋</span>
              Logout
            </button>
          </section>}

          {view === 'prediction' && <div className="prediction-page-content"><HealthForm user={user} onPredictionComplete={handlePredictionComplete} onAnalysisComplete={handleReportAnalysisComplete} /></div>}
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
