// controllers/historicalDataController.js
import axios from 'axios';
import { format, subDays } from 'date-fns';

const ANGEL_HISTORICAL_API_URL = 'https://apiconnect.angelbroking.com/rest/secure/angelbroking/historical/v1/getCandleData';


function getFormattedDateTime(date) {
    return format(date, 'yyyy-MM-dd HH:mm');
}

const fetchHistoricalData = async (req, res) => {
    const { symboltoken } = req.body;
    if (!symboltoken) {
        return res.status(400).json({ error: 'symboltoken is required in the request body' });
    }
  
    const apiKey = process.env.API_KEY;
    const jwtToken = process.env.JWT_TOKEN; // Ensure this token is fresh
    const clientLocalIP = process.env.ANGEL_CLIENT_LOCAL_IP;
    const clientPublicIP = process.env.ANGEL_CLIENT_PUBLIC_IP;
    const macAddress = process.env.ANGEL_MAC_ADDRESS;
    const exchange = process.env.ANGEL_EXCHANGE ||"NSE"; // Default to NSE if not set
    console.log(apiKey, jwtToken, clientLocalIP, clientPublicIP, macAddress, exchange);
    if (!apiKey || !jwtToken || !clientLocalIP || !clientPublicIP || !macAddress) {
        console.error("Missing one or more Angel One API credentials in .env file.");
        return res.status(500).json({ error: 'Server configuration error: Missing API credentials.' });
    }

    const toDate = new Date(); // Current date and time
    const fromDate = subDays(toDate, 30); // Get date 30 days ago

    // Angel One API expects specific time for market hours if you want to be precise.
    // For simplicity, we are using the full day here.
    // Example for specific market hours:
    // const fromDateMarketOpen = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 9, 15, 0);
    // const toDateMarketClose = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 15, 30, 0);

    const requestPayload = {
        exchange: exchange,
        symboltoken: String(symboltoken), // Ensure symboltoken is a string
        interval: "ONE_MINUTE",
        fromdate: "2025-05-15 09:15", // e.g., "2025-05-01 09:15"
        todate: "2025-05-30 15:30"      // e.g., "2025-05-31 12:13"
    };

    const headers = {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB', // Or your app's source ID
        'X-ClientLocalIP': clientLocalIP,
        'X-ClientPublicIP': clientPublicIP,
        'X-MACAddress': macAddress,
        'X-PrivateKey': apiKey
    };

    console.log("Controller: Requesting Angel One API with payload:", JSON.stringify(requestPayload, null, 2));
    console.log("Controller: Requesting Angel One API with headers (excluding sensitive):", {
        'Content-Type': headers['Content-Type'],
        'Accept': headers['Accept'],
        'X-UserType': headers['X-UserType'],
        'X-SourceID': headers['X-SourceID'],
    });

    try {
        const response = await axios.post(ANGEL_HISTORICAL_API_URL, requestPayload, { headers });

        if (response.data && response.data.status === true) {
            console.log("Controller: Successfully fetched data from Angel One.");
            // The actual candle data is usually in response.data.data
            res.json(response.data);
        } else {
            console.error("Controller: Angel One API Error:", response.data);
            res.status(response.data.errorCode || 500).json({
                message: response.data.message || "Failed to fetch data from Angel One",
                details: response.data
            });
        }
    } catch (error) {
        console.error('Controller: Error calling Angel One API:', error.response ? error.response.data : error.message);
        if (error.response) {
            res.status(error.response.status || 500).json({
                message: 'Failed to fetch historical data due to an API error.',
                error: error.response.data
            });
        } else {
            res.status(500).json({
                message: 'Failed to fetch historical data due to a network or server error.',
                error: error.message
            });
        }
    }
};

export default fetchHistoricalData