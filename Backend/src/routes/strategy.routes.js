// backend/src/routes/strategy.routes.js
import { Router } from 'express';
import { 
    createStrategy, 
    getStrategies,
    // updateStrategy, // If you implement update
    // deleteStrategy  // If you implement delete
} from '../controllers/strategy.controller.js';

// import { verifyJWT } from '../middlewares/auth.middleware.js'; // If you had auth ready

const router = Router();

// If you had authentication, you'd apply it here:
// router.use(verifyJWT); 

router.route('/')
    .post(createStrategy)  // For "Trade All" and "Add to Draft"
    .get(getStrategies);   // For fetching Positions, My Strategies, Drafts (filtered by status)

// Example for specific ID operations (if needed for update/delete later)
// router.route('/:strategyId')
//     .get(getStrategyById) // You'd need a getStrategyById controller
//     .put(updateStrategy)
//     .delete(deleteStrategy);

export default router;
