import React from 'react';

const TopBar = ({ user }) => {
  return (
    <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          Welcome back, <span className="text-indigo-600">{user?.name || 'User'}</span>! 👋
        </h2>
        <p className="text-slate-500 text-sm">Here's your latest health snapshot.</p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-800">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p className="text-xs text-slate-400">Health Monitoring System</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
