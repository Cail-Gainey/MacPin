import { app } from 'electron';
import logger, { LogCategory } from './logger';

/**
 * @file memoryManager.ts
 * @description 内存管理工具，负责垃圾回收和内存监控
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 配置
const DEFAULT_GC_INTERVAL = 300000; // 默认垃圾回收间隔（毫秒）
const DEFAULT_MEMORY_MONITOR_INTERVAL = 10 * 60 * 1000; // 默认内存监控间隔（毫秒）
const MEMORY_THRESHOLD_MB = 200; // 内存阈值（MB），超过此值触发垃圾回收

// 定时器引用
let gcIntervalId: NodeJS.Timeout | null = null;
let memoryMonitorIntervalId: NodeJS.Timeout | null = null;

/**
 * 初始化内存管理
 * @param gcInterval 垃圾回收间隔（毫秒）
 */
export function initMemoryManager(gcInterval: number = DEFAULT_GC_INTERVAL): void {
  logger.info('初始化内存管理器', LogCategory.MEMORY);
  
  // 确保 global.gc() 可用
  enableGC();
  
  // 启动定时垃圾回收
  startPeriodicGC(gcInterval);
  
  // 启动内存监控
  startMemoryMonitoring();
}

/**
 * 启用垃圾回收
 */
export function enableGC(): void {
  try {
    // 检查 global.gc 是否存在
    if (!global.gc) {
      // 如果不存在，尝试手动启用
      logger.info('尝试手动启用垃圾回收...', LogCategory.MEMORY);
      app.commandLine.appendSwitch('js-flags', '--expose-gc');
      logger.info('已添加 --expose-gc 标志，需要重启应用才能生效', LogCategory.MEMORY);
    } else {
      logger.debug('垃圾回收已启用', LogCategory.MEMORY);
    }
  } catch (error) {
    logger.error('启用垃圾回收失败:', LogCategory.MEMORY, { error });
  }
}

/**
 * 手动执行垃圾回收
 * @returns 是否成功执行
 */
export function performGC(): boolean {
  try {
    if (global.gc) {
      global.gc();
      logger.debug('手动垃圾回收执行成功', LogCategory.MEMORY);
      return true;
    } else {
      logger.warn('global.gc 不可用，无法执行垃圾回收', LogCategory.MEMORY);
      return false;
    }
  } catch (error) {
    logger.error('执行垃圾回收失败:', LogCategory.MEMORY, { error });
    return false;
  }
}

/**
 * 启动定时垃圾回收
 * @param interval 间隔时间（毫秒）
 */
export function startPeriodicGC(interval: number = DEFAULT_GC_INTERVAL): void {
  // 如果已经有定时器在运行，先停止它
  stopPeriodicGC();
  
  logger.debug(`启动定时垃圾回收，间隔: ${interval}ms`, LogCategory.MEMORY);
  
  // 创建新的定时器
  gcIntervalId = setInterval(() => {
    performGC();
  }, interval);
}

/**
 * 停止定时垃圾回收
 */
export function stopPeriodicGC(): void {
  if (gcIntervalId) {
    clearInterval(gcIntervalId);
    gcIntervalId = null;
    logger.debug('已停止定时垃圾回收', LogCategory.MEMORY);
  }
}

/**
 * 获取当前内存使用情况
 * @returns 内存使用情况（MB）
 */
export function getMemoryUsage(): { rss: number, heapTotal: number, heapUsed: number } {
  const memoryUsage = process.memoryUsage();
  return {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),      // 常驻集大小
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // 堆内存总量
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024)   // 已用堆内存
  };
}

/**
 * 启动内存监控
 * @param interval 监控间隔（毫秒）
 */
export function startMemoryMonitoring(interval: number = DEFAULT_MEMORY_MONITOR_INTERVAL): void {
  // 如果已经有监控在运行，先停止它
  stopMemoryMonitoring();
  
  logger.debug(`启动内存监控，间隔: ${interval}ms`, LogCategory.MEMORY);
  
  // 立即执行一次内存检查
  checkMemoryUsage();
  
  // 创建新的定时器
  memoryMonitorIntervalId = setInterval(() => {
    checkMemoryUsage();
  }, interval);
}

/**
 * 停止内存监控
 */
export function stopMemoryMonitoring(): void {
  if (memoryMonitorIntervalId) {
    clearInterval(memoryMonitorIntervalId);
    memoryMonitorIntervalId = null;
    logger.debug('已停止内存监控', LogCategory.MEMORY);
  }
}

/**
 * 检查内存使用情况，如果超过阈值则执行垃圾回收
 */
export function checkMemoryUsage(): void {
  const memory = getMemoryUsage();
  logger.debug(`内存使用情况 - RSS: ${memory.rss}MB, 堆总量: ${memory.heapTotal}MB, 已用堆: ${memory.heapUsed}MB`, LogCategory.MEMORY);
  
  // 如果内存使用超过阈值，执行垃圾回收
  if (memory.heapUsed > MEMORY_THRESHOLD_MB) {
    logger.warn(`内存使用超过阈值 (${MEMORY_THRESHOLD_MB}MB)，执行垃圾回收`, LogCategory.MEMORY);
    performGC();
    
    // 回收后再次检查
    const afterGC = getMemoryUsage();
    const freed = memory.heapUsed - afterGC.heapUsed;
    logger.info(`垃圾回收完成，释放内存: ${freed > 0 ? freed : 0}MB`, LogCategory.MEMORY);
  }
}

/**
 * 清理资源
 * 在应用退出前调用
 */
export function cleanup(): void {
  stopPeriodicGC();
  stopMemoryMonitoring();
  logger.debug('内存管理器已清理', LogCategory.MEMORY);
}

// 导出默认对象
export default {
  initMemoryManager,
  enableGC,
  performGC,
  startPeriodicGC,
  stopPeriodicGC,
  getMemoryUsage,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  checkMemoryUsage,
  cleanup
};