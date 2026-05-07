export interface Env {
  PORT: number;
  HOST: string;
  NODE_ENV: 'development' | 'production' | 'test';
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRY: string;
  JWT_REFRESH_EXPIRY: string;
  JWT_ISSUER?: string;
  JWT_AUDIENCE?: string;
  CORS_ORIGIN: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  YOUTUBE_API_KEY?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
}

function requireEnv(name: string, value: string | undefined, requiredInProduction = false): string | undefined {
  if (!value && process.env.NODE_ENV === 'production' && requiredInProduction) {
    throw new Error(`FATAL: ${name} must be set in production.`);
  }
  return value;
}

export function loadEnv(): Env {
  return {
    PORT: parseInt(process.env.PORT ?? '3000', 10),
    HOST: process.env.HOST ?? '0.0.0.0',
    NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) ?? 'development',
    MONGODB_URI: process.env.MONGODB_URI ?? '',
    JWT_SECRET: requireEnv('JWT_SECRET', process.env.JWT_SECRET, true) ?? 'change-me',
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY ?? '30d',
    JWT_ISSUER: process.env.JWT_ISSUER,
    JWT_AUDIENCE: process.env.JWT_AUDIENCE,
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  };
}

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = loadEnv();
  }
  return _env;
}