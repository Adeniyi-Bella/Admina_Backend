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
import userRoutes from '@/routes/v1/user';

/**
 * Root route
 */
router.get('/', (_, res) => {
  res.status(200).json({
    message: 'API is live',
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.use('/users', userRoutes);

export default router;
