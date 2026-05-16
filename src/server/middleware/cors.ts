import type { Request, Response, NextFunction } from 'express';
import type { ServerConfig } from '../config.js';

export const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (origin === undefined) {
    return true;
  }

  if (
    origin.startsWith('http://localhost:') ||
    origin === 'http://localhost' ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'http://127.0.0.1' ||
    origin.startsWith('http://[::1]:') ||
    origin === 'http://[::1]' ||
    origin === 'https://gitnexus.vercel.app'
  ) {
    return true;
  }

  let hostname: string;
  let protocol: string;
  try {
    const parsed = new URL(origin);
    hostname = parsed.hostname;
    protocol = parsed.protocol;
  } catch {
    return false;
  }

  if (protocol !== 'http:' && protocol !== 'https:') return false;

  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false;
  }

  const [a, b] = octets;

  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
};


