import React from 'react';

export const DesktopSidebar = ({ news, setActivePage, setActiveCategory }) => {
  const categories = [...new Set(news.map((item) => item.category))].slice(0, 8);
  const trending = [...news].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  return (
    <aside className="desktop-sidebar">
      <h3>🔗 क्विक नेविगेशन</h3>
      {['होम', 'ट्रेंडिंग', 'फ़ीचर्ड', 'वीडियो', 'टाइमलाइन'].map((item) => (
        <div
          key={item}
          className="sidebar-item"
          onClick={() => setActivePage(item)}
        >
          {item}
        </div>
      ))}

      <h3 style={{ marginTop: '24px' }}>📊 टॉप कैटेगरीज़</h3>
      {categories.map((cat) => (
        <div
          key={cat}
          className="sidebar-item"
          onClick={() => {
            setActiveCategory(cat);
            setActivePage('फ़ीचर्ड');
          }}
        >
          {cat}
        </div>
      ))}

      <h3 style={{ marginTop: '24px' }}>⭐ ट्रेंडिंग न्यूज़</h3>
      {trending.map((item) => (
        <div
          key={item.id}
          className="sidebar-item"
          style={{ fontSize: '12px', lineHeight: '1.3' }}
        >
          {item.title.substring(0, 30)}...
        </div>
      ))}
    </aside>
  );
};
