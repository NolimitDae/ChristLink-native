declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_STRIPE_PK: string;
      EXPO_PUBLIC_API_BASE: string;
      EXPO_PUBLIC_SENTRY_DSN?: string;
      EXPO_PUBLIC_STRIPE_MERCHANT_ID?: string;
      GOOGLE_MAPS_API_KEY?: string;
    }
  }
}

export {};
