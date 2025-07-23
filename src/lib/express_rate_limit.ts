// Copyright 2025 adeniyibella
// 
// Licensed under the Apache License, Version 2.0 (the "License");

/**
 * Node modules
 */
import config from '@/config';
import { rateLimit } from 'express-rate-limit';

// Configure rate limiting middleware to prevent abuse
const limiter = rateLimit({
  windowMs: 60000, // 1-minute time window for request limiting
  limit: 60, // Allow a maximum of 60 requests per window per IP
  standardHeaders: 'draft-8', // Use the latest standard rate-limit headers
  legacyHeaders: false, // Disable deprecated X-RateLimit headers
  message: {
    error:
      'You have sent too many requests in a given amount of time. Please try again later.',
  },
  skip: (req, res) => {
    const environment = config.NODE_ENV;
    return environment === "development"
  },
});

export default limiter;