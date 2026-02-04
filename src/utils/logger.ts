// ============================================
// ComES Backend - Logger Utility
// ============================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const levelColors: Record<LogLevel, string> = {
  info: colors.green,
  warn: colors.yellow,
  error: colors.red,
  debug: colors.cyan,
};

const levelIcons: Record<LogLevel, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  debug: '🔍',
};

const formatMessage = (level: LogLevel, message: string, data?: unknown): string => {
  const timestamp = new Date().toISOString();
  const color = levelColors[level];
  const icon = levelIcons[level];
  
  let output = `${color}[${timestamp}] ${icon} ${level.toUpperCase()}: ${message}${colors.reset}`;
  
  if (data) {
    if (data instanceof Error) {
      output += `\n${colors.red}${data.stack || data.message}${colors.reset}`;
    } else {
      output += `\n${colors.magenta}${JSON.stringify(data, null, 2)}${colors.reset}`;
    }
  }
  
  return output;
};

const log = (level: LogLevel, message: string, data?: unknown): void => {
  const formattedMessage = formatMessage(level, message, data);
  
  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(formattedMessage);
      }
      break;
    default:
      console.log(formattedMessage);
  }
};

export const logger = {
  info: (message: string, data?: unknown): void => log('info', message, data),
  warn: (message: string, data?: unknown): void => log('warn', message, data),
  error: (message: string, data?: unknown): void => log('error', message, data),
  debug: (message: string, data?: unknown): void => log('debug', message, data),
};

export default logger;
