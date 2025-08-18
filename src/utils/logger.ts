// Simple logger gated by env flag to reduce noisy console.log in production
// Usage: import { logger } from './logger'; logger.debug('msg');

const DEBUG_ENABLED = (process.env.REACT_APP_DEBUG_LOGS || '').toLowerCase() === 'true';

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, ...args: any[]) {
  if (level === 'debug' && !DEBUG_ENABLED) return;
  const prefix = {
    debug: '🐞',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌'
  }[level];
  // eslint-disable-next-line no-console
  (console as any)[level === 'debug' ? 'log' : level](`${prefix} [${level.toUpperCase()}]`, ...args);
}

export const logger = {
  debug: (...a: any[]) => log('debug', ...a),
  info: (...a: any[]) => log('info', ...a),
  warn: (...a: any[]) => log('warn', ...a),
  error: (...a: any[]) => log('error', ...a)
};

export default logger;
