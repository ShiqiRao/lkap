import moment from 'moment';
import { DailyNoteTemplateVars } from '../types';

/**
 * 日期处理工具类
 */
export class DateUtils {
  /**
   * 获取今天的日期字符串
   */
  static getTodayString(format: string = 'YYYY-MM-DD'): string {
    return moment().format(format);
  }

  /**
   * 获取指定日期的字符串
   */
  static getDateString(date: Date, format: string = 'YYYY-MM-DD'): string {
    return moment(date).format(format);
  }

  /**
   * 解析日期字符串
   */
  static parseDate(dateString: string, format: string = 'YYYY-MM-DD'): Date | null {
    const parsed = moment(dateString, format);
    return parsed.isValid() ? parsed.toDate() : null;
  }

  /**
   * 获取昨天的日期字符串
   */
  static getYesterdayString(format: string = 'YYYY-MM-DD'): string {
    return moment().subtract(1, 'day').format(format);
  }

  /**
   * 获取明天的日期字符串
   */
  static getTomorrowString(format: string = 'YYYY-MM-DD'): string {
    return moment().add(1, 'day').format(format);
  }

  /**
   * 获取本周的开始日期
   */
  static getWeekStartString(format: string = 'YYYY-MM-DD'): string {
    return moment().startOf('week').format(format);
  }

  /**
   * 获取本月的开始日期
   */
  static getMonthStartString(format: string = 'YYYY-MM-DD'): string {
    return moment().startOf('month').format(format);
  }

  /**
   * 检查日期字符串是否有效
   */
  static isValidDate(dateString: string, format: string = 'YYYY-MM-DD'): boolean {
    return moment(dateString, format, true).isValid();
  }

  /**
   * 获取日记模板变量
   */
  static getDailyNoteTemplateVars(date?: Date): DailyNoteTemplateVars {
    const targetDate = moment(date);
    
    return {
      date: targetDate.format('YYYY-MM-DD'),
      dayOfWeek: targetDate.format('dddd'),
      timestamp: targetDate.format(),
      year: targetDate.format('YYYY'),
      month: targetDate.format('MM'),
      day: targetDate.format('DD'),
      weekday: targetDate.format('ddd'),
      time: targetDate.format('HH:mm:ss'),
      iso: targetDate.toISOString()
    };
  }

  /**
   * 从文件名中提取日期
   */
  static extractDateFromFileName(fileName: string, format: string = 'YYYY-MM-DD'): Date | null {
    // 移除文件扩展名
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    
    // 尝试解析日期
    const parsed = moment(nameWithoutExt, format);
    return parsed.isValid() ? parsed.toDate() : null;
  }

  /**
   * 生成日期范围内的所有日期
   */
  static getDateRange(startDate: Date, endDate: Date, format: string = 'YYYY-MM-DD'): string[] {
    const dates: string[] = [];
    const current = moment(startDate);
    const end = moment(endDate);

    while (current.isSameOrBefore(end)) {
      dates.push(current.format(format));
      current.add(1, 'day');
    }

    return dates;
  }

  /**
   * 获取相对日期描述（今天、昨天、明天等）
   */
  static getRelativeDateDescription(date: Date | string): string {
    const targetDate = moment(date);
    const today = moment();

    if (targetDate.isSame(today, 'day')) {
      return '今天';
    } else if (targetDate.isSame(today.clone().subtract(1, 'day'), 'day')) {
      return '昨天';
    } else if (targetDate.isSame(today.clone().add(1, 'day'), 'day')) {
      return '明天';
    } else if (targetDate.isSame(today, 'week')) {
      return `本周${targetDate.format('dddd')}`;
    } else {
      return targetDate.format('YYYY-MM-DD');
    }
  }
} 