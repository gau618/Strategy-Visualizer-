import React, { useEffect, useState } from 'react';
import {LiveOptionDataProvider} from './contexts/LiveOptionDataContext.jsx'
import StrategyVisualizer from './features/StrategyVisualizer/StrategyVisualizer.jsx'
import Text from './features/text.jsx';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';

function App() {
  

  return (
    <LiveOptionDataProvider>
      <Router>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <h1>TradVed Strategy Visualizer</h1>
          <Routes>
            <Route path="/" element={<StrategyVisualizer />} />
          </Routes>
        </div>
      </Router>
    </LiveOptionDataProvider>
  );
}

export default App;
