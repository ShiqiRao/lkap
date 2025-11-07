import * as path from 'path';
import { LinkReference, GlobalLinkReferences } from '../types';

/**
 * 全局链接引用管理器的实现
 * 处理同名链接引用的冲突解决
 */
export class GlobalLinkReferencesImpl implements GlobalLinkReferences {
  // 存储结构: Map<引用名称, LinkReference[]>
  private references: Map<string, LinkReference[]> = new Map();

  // 性能优化缓存
  private normalizedPathCache: Map<string, string> = new Map();
  private resolvedConflictCache: Map<string, LinkReference> = new Map();

  /**
   * 获取指定名称的最佳匹配引用
   * @param name 引用名称
   * @param contextFile 当前文档路径，用于上下文相关的解析
   * @returns 最佳匹配的链接引用
   */
  getBestMatch(name: string, contextFile?: string): LinkReference | null {
    const candidates = this.references.get(name);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    // 使用缓存key来避免重复计算
    const cacheKey = `${name}:${contextFile || ''}`;
    const cached = this.resolvedConflictCache.get(cacheKey);
    if (cached) {
      // 验证缓存的引用仍然在候选列表中
      if (candidates.includes(cached)) {
        return cached;
      } else {
        // 缓存失效，清除
        this.resolvedConflictCache.delete(cacheKey);
      }
    }

    // 多个候选项的冲突解决策略
    const result = this.resolveConflict(candidates, contextFile);

    // 缓存结果
    this.resolvedConflictCache.set(cacheKey, result);

    return result;
  }

  /**
   * 添加链接引用
   * @param reference 要添加的引用
   */
  addReference(reference: LinkReference): void {
    const name = reference.name;

    if (!this.references.has(name)) {
      this.references.set(name, []);
    }

    const candidates = this.references.get(name)!;

    // 检查是否已经存在来自同一文件的相同引用
    const existingIndex = candidates.findIndex(
      ref => ref.sourceFile === reference.sourceFile && ref.path === reference.path
    );

    if (existingIndex >= 0) {
      // 更新现有引用
      candidates[existingIndex] = reference;
    } else {
      // 添加新引用
      candidates.push(reference);
    }

    // 清除相关的缓存
    this.clearCacheForName(name);
  }

  /**
   * 移除来自特定文件的所有引用
   * @param sourceFile 源文件路径
   */
  removeReferencesFromFile(sourceFile: string): void {
    const normalizedSourceFile = this.normalizePath(sourceFile);
    const affectedNames: string[] = [];

    for (const [name, candidates] of this.references.entries()) {
      const filtered = candidates.filter(
        ref => this.normalizePath(ref.sourceFile) !== normalizedSourceFile
      );

      if (filtered.length !== candidates.length) {
        affectedNames.push(name);
      }

      if (filtered.length === 0) {
        this.references.delete(name);
      } else {
        this.references.set(name, filtered);
      }
    }

    // 清除受影响名称的缓存
    affectedNames.forEach(name => this.clearCacheForName(name));
  }

  /**
   * 获取所有引用的副本
   */
  getAllReferences(): Map<string, LinkReference[]> {
    const result = new Map<string, LinkReference[]>();
    for (const [name, refs] of this.references.entries()) {
      result.set(name, [...refs]);
    }
    return result;
  }

  /**
   * 冲突解决策略
   * @param candidates 候选引用列表
   * @param contextFile 当前文档路径
   * @returns 选择的最佳引用
   */
  private resolveConflict(candidates: LinkReference[], contextFile?: string): LinkReference {
    // 策略1: 如果提供了上下文文件，优先选择同目录的引用
    if (contextFile) {
      const contextDir = path.dirname(this.normalizePath(contextFile));

      const sameDirectory = candidates.filter(ref => {
        const refDir = path.dirname(this.normalizePath(ref.sourceFile));
        return refDir === contextDir;
      });

      if (sameDirectory.length > 0) {
        return this.selectByPriority(sameDirectory);
      }
    }

    // 策略2: 按优先级选择
    return this.selectByPriority(candidates);
  }

  /**
   * 按优先级选择引用
   * @param candidates 候选引用列表
   * @returns 优先级最高的引用
   */
  private selectByPriority(candidates: LinkReference[]): LinkReference {
    // 排序：优先级高的在前，优先级相同的按文件路径排序确保稳定性
    const sorted = [...candidates].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // 降序，优先级高的在前
      }

      // 优先级相同时，按文件路径排序确保稳定性
      return this.normalizePath(a.sourceFile).localeCompare(this.normalizePath(b.sourceFile));
    });

    return sorted[0];
  }

  /**
   * 规范化文件路径
   * @param filePath 文件路径
   * @returns 规范化后的路径
   */
  private normalizePath(filePath: string): string {
    const cached = this.normalizedPathCache.get(filePath);
    if (cached !== undefined) {
      return cached;
    }

    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    this.normalizedPathCache.set(filePath, normalized);
    return normalized;
  }

  /**
   * 清除特定名称相关的缓存
   * @param name 引用名称
   */
  private clearCacheForName(name: string): void {
    // 清除所有包含该名称的冲突解决缓存
    const keysToDelete: string[] = [];
    for (const key of this.resolvedConflictCache.keys()) {
      if (key.startsWith(`${name}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.resolvedConflictCache.delete(key));
  }

  /**
   * 清除所有缓存
   */
  private clearAllCaches(): void {
    this.normalizedPathCache.clear();
    this.resolvedConflictCache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): { totalReferences: number; conflicts: number; cacheSize: number } {
    let totalReferences = 0;
    let conflicts = 0;

    for (const candidates of this.references.values()) {
      totalReferences += candidates.length;
      if (candidates.length > 1) {
        conflicts++;
      }
    }

    return {
      totalReferences,
      conflicts,
      cacheSize: this.normalizedPathCache.size + this.resolvedConflictCache.size
    };
  }
}