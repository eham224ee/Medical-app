import 'dotenv/config';
import { db, hospitals } from './index';

async function testConnection() {
  try {
    console.log('Testing Supabase connection via Drizzle...');

    // Attempt a lightweight query to the hospitals table
    const result = await db.select().from(hospitals).limit(1);

    console.log('Connection successful! Query returned:', result);
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

testConnection();