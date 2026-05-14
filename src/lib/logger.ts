// Centralized logging utility for the application
// Logs to console in development, external service in production

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  isDev: boolean;
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  private format(entry: LogEntry): string {
    const { timestamp, level, message } = entry;
    return `[${timestamp}] [${level}] ${message}`;
  }

  private log(entry: LogEntry) {
    const formatted = this.format(entry);

    // Console output in all environments
    switch (entry.level) {
      case LogLevel.DEBUG:
        if (this.isDev) console.debug(formatted, entry.context);
        break;
      case LogLevel.INFO:
        console.info(formatted, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(formatted, entry.context);
        break;
      case LogLevel.ERROR:
        console.error(formatted, entry.context);
        break;
    }

    // In production, send to external service (implement as needed)
    if (!this.isDev && entry.level === LogLevel.ERROR) {
      this.sendToExternalService(entry);
    }
  }

  private sendToExternalService(entry: LogEntry) {
    // TODO: Implement external error tracking (Sentry, DataDog, etc.)
    // Example:
    // fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) })
  }

  debug(message: string, context?: Record<string, any>) {
    this.log({
      level: LogLevel.DEBUG,
      message,
      context,
      timestamp: new Date().toISOString(),
      isDev: this.isDev,
    });
  }

  info(message: string, context?: Record<string, any>) {
    this.log({
      level: LogLevel.INFO,
      message,
      context,
      timestamp: new Date().toISOString(),
      isDev: this.isDev,
    });
  }

  warn(message: string, context?: Record<string, any>) {
    this.log({
      level: LogLevel.WARN,
      message,
      context,
      timestamp: new Date().toISOString(),
      isDev: this.isDev,
    });
  }

  error(message: string, error?: Error | unknown, context?: Record<string, any>) {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        errorMessage: error.message,
        errorStack: error.stack,
      }),
    };

    this.log({
      level: LogLevel.ERROR,
      message,
      context: errorContext,
      timestamp: new Date().toISOString(),
      isDev: this.isDev,
    });
  }
}

export const logger = new Logger();
