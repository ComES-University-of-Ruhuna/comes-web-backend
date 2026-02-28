// ============================================
// ComES Backend - Main Server Entry Point
// ============================================

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before anything else
dotenv.config({ path: path.join(__dirname, '../.env') });

import app from './app';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 5000;

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack || '');
  process.exit(1);
});

// ============================================
// Vercel Serverless Support
// ============================================

import mongoose from 'mongoose';

// MongoDB connection state for serverless
let isConnected = false;

const ensureDbConnection = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await connectDatabase();
    isConnected = true;
    logger.info('Database connected in serverless environment');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Wrap the app to ensure DB connection
const handler = async (req: any, res: any) => {
  try {
    await ensureDbConnection();
    return app(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
};

// Export handler for Vercel serverless functions
export default handler;

// ============================================
// Local Development Server
// ============================================

// Only start the server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const startServer = async (): Promise<void> => {
    try {
      // Connect to MongoDB
      await connectDatabase();

      // Start the server
      const server = app.listen(PORT, () => {
        logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        logger.info(`📡 API available at http://localhost:${PORT}/api/v1`);
        logger.info(`❤️  Health check at http://localhost:${PORT}/api/v1/health`);
      });

      // Handle unhandled promise rejections
      process.on('unhandledRejection', (err: Error) => {
        logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
        logger.error(`${err.name}: ${err.message}`);
        server.close(() => {
          process.exit(1);
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
        server.close(() => {
          logger.info('💤 Process terminated!');
        });
      });

      process.on('SIGINT', () => {
        logger.info('👋 SIGINT RECEIVED. Shutting down gracefully');
        server.close(() => {
          logger.info('💤 Process terminated!');
        });
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}
