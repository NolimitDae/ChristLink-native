declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_STRIPE_PK: string;
      EXPO_PUBLIC_API_BASE: string;
      EXPO_PUBLIC_SENTRY_DSN?: string;
    }
  }
}

export {};
