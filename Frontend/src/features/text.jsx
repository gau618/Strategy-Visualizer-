import React from 'react'
import { useState } from 'react'
export default function Text() {
  const [symboltoken, setSymboltoken] = useState('');
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState(null);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    if (!symboltoken.trim()) {
      setError('Please enter a symboltoken.');
      setHistoricalData(null);
      return;
    }

    setLoading(true);
    setError(null);
    setHistoricalData(null);
    console.log("Fetching historical data for symboltoken:", symboltoken.trim());
    try {
      const response = await fetch('https://strategy-visualizer.onrender.com/api/v1/strategies/historical-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symboltoken: symboltoken.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch data');
      }

      const data = await response.json();
      setHistoricalData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Angel One Historical Data Fetcher</h1>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="symboltoken" style={{ marginRight: '1rem' }}>
          Symbol Token:
        </label>
        <input
          id="symboltoken"
          type="text"
          value={symboltoken}
          onChange={(e) => setSymboltoken(e.target.value)}
          placeholder="Enter symboltoken"
          style={{ padding: '0.5rem', fontSize: '1rem', width: '200px' }}
        />
        <button
          onClick={handleFetch}
          style={{ marginLeft: '1rem', padding: '0.5rem 1rem', fontSize: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Fetching...' : 'Fetch Data'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {historicalData && (
        <div>
          <h2>Historical Data Result</h2>
          <pre style={{ background: '#f0f0f0', padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
            {JSON.stringify(historicalData, null, 2)}
          </pre>
        </div>
      )}
    </div>)
}
