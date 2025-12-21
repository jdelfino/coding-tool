'use client';

import React from 'react';

interface InstructorNavProps {
  currentView: 'classes' | 'sections' | 'problems' | 'sessions' | 'session';
  onNavigate: (view: 'classes' | 'problems' | 'sessions') => void;
  disabled?: boolean;
}

const InstructorNav: React.FC<InstructorNavProps> = ({ currentView, onNavigate, disabled = false }) => {
  const navItems = [
    { id: 'classes' as const, label: 'Classes', icon: '📚' },
    { id: 'sessions' as const, label: 'Sessions', icon: '🎯' },
    { id: 'problems' as const, label: 'Problems', icon: '💡' },
  ];

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-1 mb-6">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        const isDisabled = disabled;
        
        return (
          <button
            key={item.id}
            onClick={() => !isDisabled && onNavigate(item.id)}
            disabled={isDisabled}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all
              ${isActive 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-100'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
            {isActive && (
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            )}
          </button>
        );
      })}
      {currentView === 'session' && (
        <div className="ml-auto flex items-center gap-2 px-4 py-2 text-green-600 font-medium text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Active Session</span>
        </div>
      )}
    </div>
  );
};

export default InstructorNav;
