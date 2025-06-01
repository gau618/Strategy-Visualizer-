// backend/src/routes/strategy.routes.js
import { Router } from 'express';
import { 
    createStrategy, 
    getStrategies,
    // updateStrategy, // If you implement update
    // deleteStrategy  // If you implement delete
} from '../controllers/strategy.controller.js';
import fetchHistoricalData from '../controllers/historicalDataController.js'; // Import the historical data controller

// import { verifyJWT } from '../middlewares/auth.middleware.js'; // If you had auth ready

const router = Router();

// If you had authentication, you'd apply it here:
// router.use(verifyJWT); 

router.route('/').post(createStrategy).get(getStrategies);  
router.route('/historical-data').post(fetchHistoricalData);

export default router;
