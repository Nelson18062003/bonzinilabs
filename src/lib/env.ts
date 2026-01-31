/**
 * Environment variable validation
 *
 * This ensures that all required environment variables are present
 * and fails fast with helpful error messages if they're missing.
 */

interface EnvVariables {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
  VITE_SUPABASE_PROJECT_ID: string;
}

function validateEnv(): EnvVariables {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_PROJECT_ID',
  ] as const;

  const missing: string[] = [];
  const invalid: string[] = [];

  for (const varName of requiredVars) {
    const value = import.meta.env[varName];

    if (!value) {
      missing.push(varName);
    } else if (typeof value !== 'string' || value.trim() === '') {
      invalid.push(varName);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const errorMessages: string[] = [
      '❌ Environment Configuration Error',
      '',
      'Required environment variables are missing or invalid.',
      '',
    ];

    if (missing.length > 0) {
      errorMessages.push('Missing variables:');
      missing.forEach(v => errorMessages.push(`  - ${v}`));
      errorMessages.push('');
    }

    if (invalid.length > 0) {
      errorMessages.push('Invalid variables (empty or not a string):');
      invalid.forEach(v => errorMessages.push(`  - ${v}`));
      errorMessages.push('');
    }

    errorMessages.push('Please follow these steps:');
    errorMessages.push('1. Copy .env.example to .env in the project root');
    errorMessages.push('2. Fill in your Supabase credentials');
    errorMessages.push('3. Restart the development server');
    errorMessages.push('');
    errorMessages.push('For more info, see: .env.example');

    const message = errorMessages.join('\n');

    // Log to console for visibility
    console.error(message);

    // Throw error to prevent app from starting
    throw new Error(message);
  }

  // Additional validation for URL format
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    console.warn(
      '⚠️  Warning: VITE_SUPABASE_URL does not look like a valid Supabase URL.\n' +
      `   Expected format: https://[project-id].supabase.co\n` +
      `   Got: ${url}`
    );
  }

  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  };
}

// Validate on module load
export const env = validateEnv();

// Re-export for convenience
export const {
  VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ID,
} = env;
