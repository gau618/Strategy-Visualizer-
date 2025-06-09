const API_BASE_URL = 'http://localhost:5000/api/v1';

export const saveStrategy = async (strategyData) => {
  const response = await fetch(`${API_BASE_URL}/strategies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(strategyData),
  });
  console.log(strategyData)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to save strategy');
  }
  return response.json();
};

export const fetchStrategies = async ({ userId, status }) => { // userId and status are passed in
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId); // Use the passed userId
  if (status) params.append('status', status);
  
  // console.log(`strategyService: Fetching strategies with params: ${params.toString()}, status: ${status}`);

  try {
    const response = await fetch(`${API_BASE_URL}/strategies?${params.toString()}`); // Use params.toString()
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status} ${response.statusText}` }));
      console.error("fetchStrategies API Error:", errorData);
      throw new Error(errorData.message || 'Failed to fetch strategies');
    }
    const data = await response.json(); // This is the object e.g., { success: true, strategies: [...] }

    // VVVV EXTRACT AND RETURN THE ARRAY VVVV
    if (data && Array.isArray(data.strategies)) {
      // console.log("strategyService: Successfully fetched strategies array:", data.strategies);
      return data.strategies; // Return only the array of strategies
    } else {
      console.warn("strategyService: Fetched data did not contain a 'strategies' array or was not in expected format.", data);
      return []; // Return empty array if format is unexpected
    }
  } catch (error) {
    console.error("strategyService: Exception during fetchStrategies:", error);
    throw error; // Re-throw so the calling component can catch it
  }
};

