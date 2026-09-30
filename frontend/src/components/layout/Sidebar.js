import React from 'react';

const SidebarItem = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
    }`}
  >
    <span className="text-xl">{icon}</span>
    <span className="font-medium">{label}</span>
  </button>
);

const Sidebar = ({ activeView, setView, user, onLogout }) => {
  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col p-6 fixed left-0 top-0">
      <div className="flex items-center space-x-3 mb-10 px-2">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          H
        </div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">
          Health<span className="text-indigo-600">Predict</span>
        </h1>
      </div>

      <div className="flex-1 space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-4">Main Menu</p>
        <SidebarItem
          icon="📈"
          label="Risk Analysis"
          active={activeView === 'predict'}
          onClick={() => setView('predict')}
        />
        <SidebarItem
          icon="📊"
          label="Health Trends"
          active={activeView === 'trends'}
          onClick={() => setView('trends')}
        />
        <SidebarItem
          icon="👤"
          label="My Profile"
          active={activeView === 'profile'}
          onClick={() => setView('profile')}
        />
      </div>

      <div className="mt-auto pt-6 border-t border-slate-100">
        <div className="flex items-center space-x-3 px-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-slate-800 truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-500 truncate">Patient Account</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
