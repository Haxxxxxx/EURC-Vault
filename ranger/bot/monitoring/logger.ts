/**
 * Structured JSON logger with timestamps and context.
 * Wraps console output with consistent formatting.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private readonly prefix: string;
  private minLevel: LogLevel;

  private readonly levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info:  1,
    warn:  2,
    error: 3,
  };

  constructor(prefix = 'ranger', minLevel: LogLevel = 'info') {
    this.prefix = prefix;
    this.minLevel = minLevel;
  }

  child(subPrefix: string): Logger {
    return new Logger(`${this.prefix}:${subPrefix}`, this.minLevel);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelOrder[level] >= this.levelOrder[this.minLevel];
  }

  private format(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    err?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.prefix}] ${message}`,
    };
    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }
    if (err) {
      entry.error = {
        message: err.message,
        stack: err.stack,
      };
    }
    return entry;
  }

  private emit(level: LogLevel, entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    this.emit('debug', this.format('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    this.emit('info', this.format('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    this.emit('warn', this.format('warn', message, context));
  }

  error(message: string, err?: Error | unknown, context?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    const error = err instanceof Error ? err : new Error(String(err));
    this.emit('error', this.format('error', message, context, error));
  }
}

const logLevel = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
export const logger = new Logger('ranger', logLevel);

export default logger;
