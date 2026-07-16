import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8000,
  env: process.env.ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./test.db',
  redisUrl: process.env.REDIS_URL || '',
  scraperApiKey: process.env.SCRAPER_API_KEY || '',
};
