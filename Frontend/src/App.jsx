import React, { useEffect, useState } from 'react';
import {LiveOptionDataProvider} from './contexts/LiveOptionDataContext.jsx'
import StrategyVisualizer from './features/StrategyVisualizer/StrategyVisualizer.jsx'


function App() {
  

  return (
    <LiveOptionDataProvider>
    <div className="App">
      <StrategyVisualizer/>
    </div> 
    </LiveOptionDataProvider>
  );
}

export default App;
