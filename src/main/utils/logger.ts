import { createLogger, format, transports } from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

/**
 * @file logger.ts
 * @description 日志管理模块，负责配置和管理应用日志
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 日志目录路径
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const CURRENT_LOG_DIR = path.join(LOG_DIR, 'last');

// 日志级别定义
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 日志类别定义
export enum LogCategory {
  APP = 'app',
  CLIPBOARD = 'clipboard',
  MEMORY = 'memory',
  SETTINGS = 'settings',
  WINDOW = 'window',
  TRAY = 'tray',
  IPC = 'ipc',
  SHORTCUT = 'shortcut',
  SYSTEM = 'system'
}

// 日志过滤配置
const logFilters: Record<LogCategory, LogLevel> = {
  [LogCategory.APP]: LogLevel.INFO,
  [LogCategory.CLIPBOARD]: LogLevel.INFO,
  [LogCategory.MEMORY]: LogLevel.WARN, // 只记录警告和错误级别的内存日志
  [LogCategory.SETTINGS]: LogLevel.INFO,
  [LogCategory.WINDOW]: LogLevel.INFO,
  [LogCategory.TRAY]: LogLevel.INFO,
  [LogCategory.IPC]: LogLevel.WARN, // 只记录警告和错误级别的IPC日志
  [LogCategory.SHORTCUT]: LogLevel.INFO,
  [LogCategory.SYSTEM]: LogLevel.INFO
};

// 日志级别优先级
const logLevelPriority: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
};

// 创建日志格式
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.printf(({ level, message, timestamp, category, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const categoryStr = category ? `[${category}] ` : '';
    return `${timestamp} [${level.toUpperCase()}]: ${categoryStr}${message}${metaStr}`;
  })
);

// 创建控制台日志记录器（临时用于启动阶段）
const consoleLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.colorize(),
    logFormat
  ),
  transports: [
    new transports.Console()
  ]
});

// 确保日志目录存在
function ensureLogDirectoryExists(): void {
  try {
    // 如果日志目录已存在，则清空它
    if (fs.existsSync(CURRENT_LOG_DIR)) {
      const files = fs.readdirSync(CURRENT_LOG_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(CURRENT_LOG_DIR, file));
      }
      consoleLogger.info(`已清空日志目录: ${CURRENT_LOG_DIR}`);
    } else {
      // 创建日志目录
      fs.mkdirSync(CURRENT_LOG_DIR, { recursive: true });
      consoleLogger.info(`已创建日志目录: ${CURRENT_LOG_DIR}`);
    }
  } catch (error) {
    consoleLogger.error('创建或清空日志目录失败:', error);
  }
}

// 确保日志目录存在
ensureLogDirectoryExists();

// 创建日志过滤器
const logFilter = format((info) => {
  // 如果没有指定类别，默认为系统类别
  const category = (info.category as LogCategory) || LogCategory.SYSTEM;
  
  // 获取该类别的最低日志级别
  const minLevel = logFilters[category] || LogLevel.INFO;
  
  // 如果当前日志级别低于该类别的最低级别，则过滤掉
  if (logLevelPriority[info.level as LogLevel] < logLevelPriority[minLevel]) {
    return false;
  }
  
  return info;
});

// 创建主日志记录器
const logger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: format.combine(
    logFilter(),
    logFormat
  ),
  transports: [
    // 控制台输出
    new transports.Console({
      format: format.combine(
        format.colorize(),
        logFormat
      )
    }),
    // 文件输出 - 所有日志
    new transports.File({
      filename: path.join(CURRENT_LOG_DIR, 'all.log'),
    }),
    // 文件输出 - 错误日志
    new transports.File({
      filename: path.join(CURRENT_LOG_DIR, 'error.log'),
      level: 'error'
    })
  ]
});

// 记录日志系统初始化成功
logger.info('日志系统初始化完成', { category: LogCategory.SYSTEM });

/**
 * 更新日志级别
 * @param level 新的日志级别 ('debug', 'info', 'warn', 'error')
 */
export function setLogLevel(level: string): void {
  if (Object.values(LogLevel).includes(level as LogLevel)) {
    logger.level = level;
    logger.info(`日志级别已更新为: ${level}`, { category: LogCategory.SYSTEM });
  } else {
    logger.warn(`无效的日志级别: ${level}，保持当前级别: ${logger.level}`, { category: LogCategory.SYSTEM });
  }
}

/**
 * 更新特定类别的日志级别
 * @param category 日志类别
 * @param level 新的日志级别
 */
export function setCategoryLogLevel(category: LogCategory, level: LogLevel): void {
  if (logFilters[category]) {
    logFilters[category] = level;
    logger.info(`已更新 ${category} 类别的日志级别为: ${level}`, { category: LogCategory.SYSTEM });
  } else {
    logger.warn(`无效的日志类别: ${category}`, { category: LogCategory.SYSTEM });
  }
}

// 添加未捕获异常和未处理拒绝的处理程序
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error, { category: LogCategory.SYSTEM });
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的Promise拒绝:', reason, { category: LogCategory.SYSTEM });
});

// 创建增强版日志接口
const enhancedLogger = {
  debug: (message: string, category: LogCategory = LogCategory.SYSTEM, meta: Record<string, any> = {}) => {
    logger.debug(message, { category, ...meta });
  },
  
  info: (message: string, category: LogCategory = LogCategory.SYSTEM, meta: Record<string, any> = {}) => {
    logger.info(message, { category, ...meta });
  },
  
  warn: (message: string, category: LogCategory = LogCategory.SYSTEM, meta: Record<string, any> = {}) => {
    logger.warn(message, { category, ...meta });
  },
  
  error: (message: string, category: LogCategory = LogCategory.SYSTEM, meta: Record<string, any> = {}) => {
    logger.error(message, { category, ...meta });
  },
  
  // 兼容原始接口
  log: (level: string, message: string) => {
    logger.log(level, message);
  },
  
  // 设置日志级别
  setLevel: setLogLevel,
  setCategoryLevel: setCategoryLogLevel,
  
  // 获取当前日志级别
  get level() {
    return logger.level;
  },
  set level(level: string) {
    setLogLevel(level);
  }
};

export default enhancedLogger; 