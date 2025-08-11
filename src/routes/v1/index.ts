// Copyright 2025 adeniyibella
// 
// Licensed under the Apache License, Version 2.0 (the "License");

/**
 * Node modules
 */
import { Router } from 'express';
const router = Router();

/**
 * Routes
 */
import userRoutes from '@/routes/v1/user.route';
import documentRoutes from '@/routes/v1/document.route';
import chatbotRoutes from '@/routes/v1/chatbot.route'
import { ApiResponse } from '@/lib/api_response';

/**
 * Root route
 */
router.get('/', (_, res) => {
  ApiResponse.ok(res, 'API is live');
});

router.use('/users', userRoutes);
router.use('/document', documentRoutes);
router.use('/chatbot', chatbotRoutes);

export default router;
