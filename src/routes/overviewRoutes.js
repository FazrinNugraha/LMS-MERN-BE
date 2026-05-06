import express from 'express';
import { verifyToken } from '../middlewares/verifyToken.js';
import { getOverview } from '../controllers/overviewController.js';

const overviewRoutes = express.Router();

overviewRoutes.get('/overviews', verifyToken, getOverview)

export default overviewRoutes;