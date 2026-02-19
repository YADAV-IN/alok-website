import { useState } from 'react';

export const MobileBottomNav = ({ activePage, setActivePage, showAdmin, setShowAdmin, adminToken }) => {
  return (
    <nav className="mobile-nav">
      <button
        className={`mobile-nav-item ${activePage === 'होम' ? 'active' : ''}`}
        onClick={() => setActivePage('होम')}
      >
        <span className="mobile-nav-icon">🏠</span>
        <span>होम</span>
      </button>
      <button
        className={`mobile-nav-item ${activePage === 'ट्रेंडिंग' ? 'active' : ''}`}
        onClick={() => setActivePage('ट्रेंडिंग')}
      >
        <span className="mobile-nav-icon">🔥</span>
        <span>ट्रेंडिंग</span>
      </button>
      <button
        className={`mobile-nav-item ${activePage === 'वीडियो' ? 'active' : ''}`}
        onClick={() => setActivePage('वीडियो')}
      >
        <span className="mobile-nav-icon">▶️</span>
        <span>वीडियो</span>
      </button>
      <button
        className={`mobile-nav-item ${activePage === 'कैटेगरीज' ? 'active' : ''}`}
        onClick={() => setActivePage('कैटेगरीज')}
      >
        <span className="mobile-nav-icon">📂</span>
        <span>कैटेगरीज</span>
      </button>
      <button
        className={`mobile-nav-item ${showAdmin ? 'active' : ''}`}
        onClick={() => setShowAdmin((prev) => !prev)}
      >
        <span className="mobile-nav-icon">{adminToken ? '⚙️' : '🔐'}</span>
        <span>{adminToken ? 'पैनल' : 'लॉगिन'}</span>
      </button>
    </nav>
  );
};
