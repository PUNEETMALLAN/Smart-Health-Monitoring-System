import React from 'react';

const RiskCard = ({ riskLevel, recommendations, explanation }) => {
  const colors = {
    'Low Risk': {
      container: 'bg-green-500/30 text-green-100 border-green-500/50',
      accent: 'bg-green-400',
      text: 'text-green-100'
    },
    'Moderate Risk': {
      container: 'bg-yellow-500/30 text-yellow-100 border-yellow-500/50',
      accent: 'bg-yellow-400',
      text: 'text-yellow-100'
    },
    'High Risk': {
      container: 'bg-red-500/30 text-red-100 border-red-500/50',
      accent: 'bg-red-400',
      text: 'text-red-100'
    },
  };

  const theme = colors[riskLevel] || {
    container: 'bg-gray-500/30 text-gray-100 border-gray-500/50',
    accent: 'bg-gray-400',
    text: 'text-gray-100'
  };

  return (
    <div className={`p-8 rounded-3xl border-l-8 backdrop-blur-lg shadow-2xl transition-all duration-500 animate-in zoom-in-95 ${theme.container}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-3xl font-extrabold text-white drop-shadow-md">
          Health Risk: <span className={theme.text}>{riskLevel}</span>
        </h3>
        <div className={`h-12 w-12 rounded-full ${theme.accent} animate-pulse shadow-lg`} />
      </div>

      {explanation && (
        <div className="mb-6 p-4 bg-white/10 rounded-2xl border border-white/10 text-white text-sm italic leading-relaxed opacity-90">
          <span className="font-bold not-italic mr-2">Why?</span> {explanation}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-lg">💡</span>
          <h4 className="text-xl font-semibold text-white">Personalized Suggestions</h4>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="flex items-start p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/10 text-white text-sm leading-relaxed hover:bg-white/30 transition-all duration-200 group"
            >
              <span className={`shrink-0 w-6 h-6 rounded-full ${theme.accent} text-white text-xs font-bold flex items-center justify-center mr-3 shadow-md group-hover:scale-110 transition-transform`}>
                {idx + 1}
              </span>
              <span className="opacity-90">{rec}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-white/20 text-center">
        <p className="text-white/60 text-xs italic">
          These suggestions are based on your current vitals. Please verify with a doctor.
        </p>
      </div>
    </div>
  );
};

export default RiskCard;
