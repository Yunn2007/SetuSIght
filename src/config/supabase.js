/**
 * SetuSight — Supabase Database Client Configuration
 * Single Source of Truth: Supabase PostgreSQL
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabaseInstance = null;

function isConfigured() {
  return Boolean(
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseKey.includes('your-supabase')
  );
}

if (isConfigured()) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
    supabaseInstance = null;
  }
}

/**
 * Returns the active Supabase client instance.
 * Throws a clean 503 error if Supabase is not configured or unavailable.
 */
function getSupabase() {
  if (!supabaseInstance || !isConfigured()) {
    const error = new Error('Database service unavailable. Please ensure valid SUPABASE_URL and SUPABASE_KEY are configured in .env.');
    error.statusCode = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    throw error;
  }
  return supabaseInstance;
}

/**
 * Health check helper to test database connectivity
 */
async function checkSupabaseHealth() {
  if (!isConfigured() || !supabaseInstance) {
    return { ok: false, message: 'Supabase credentials not configured' };
  }
  try {
    const { data, error } = await supabaseInstance.from('bridges').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return { ok: true, message: 'Supabase connected successfully' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = {
  getSupabase,
  checkSupabaseHealth,
  isConfigured
};
