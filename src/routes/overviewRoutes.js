import express from 'express';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';
import { getOverview } from '../controllers/overviewController.js';

const overviewRoutes = express.Router();

overviewRoutes.get('/overviews', verifyToken, verifyRole('manager'), getOverview)

export default overviewRoutes;