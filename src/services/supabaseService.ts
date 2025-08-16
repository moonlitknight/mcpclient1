/**
 * Module for Supabase authentication and JWT validation.
 * @module supabaseService
 */

import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../config';
import { logger } from '../logger';

/**
 * Validates a Supabase JWT token.
 * @async
 * @function validateSupabaseJWT
 * @param {string|any} jwt - The JWT token to validate
 * @returns {Promise<boolean>} True if the token is valid
 */
export async function validateSupabaseJWT(jwt: string | any): Promise<boolean> {
  try {
    const config = getConfig();
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey
    );
    const { data: { user }, error } = await supabase.auth.getUser(jwt);

    if (error) {
      logger.warn('JWT validation failed', error instanceof Error ? error : new Error(String(error)));
      return false;
    }

    return !!user;
  } catch (error: any) {
    logger.error('Supabase JWT validation error', error);
    return false;
  }
}
