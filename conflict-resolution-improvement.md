# 冲突解决系统设计与实现

## 问题分析

用户指出了 `globalLinkReferences: Map<string, LinkReference>` 数据结构的重要缺陷：

### 原始问题
```typescript
// 有问题的设计
private globalLinkReferences: Map<string, LinkReference> = new Map();

// 冲突场景
// 文件A: [interview-questions]: notes/interview-questions.md
// 文件B: [interview-questions]: research/interview-questions.md
// 结果：后加载的文件会覆盖前面的引用！
```

### 核心问题
1. **名称冲突**: 不同文档可能定义相同名称的链接引用
2. **覆盖问题**: `Map.set()` 会覆盖已存在的同名引用
3. **无上下文**: 无法根据使用场景选择合适的引用
4. **无优先级**: 无法处理引用的重要性差异

## 解决方案设计

### 1. 新的数据结构

```typescript
// 增强的链接引用
interface LinkReference {
  name: string;
  path: string;
  title?: string;
  sourceFile: string;  // 来源文件信息
  priority?: number;   // 优先级支持
}

// 全局引用管理器接口
interface GlobalLinkReferences {
  getBestMatch(name: string, contextFile?: string): LinkReference | null;
  addReference(reference: LinkReference): void;
  removeReferencesFromFile(sourceFile: string): void;
  getAllReferences(): Map<string, LinkReference[]>;
}
```

### 2. 冲突解决算法

实现了多层次的智能冲突解决策略：

```typescript
// 冲突解决策略
private resolveConflict(candidates: LinkReference[], contextFile?: string): LinkReference {
  // 策略1: 上下文优先 - 同目录的引用优先
  if (contextFile) {
    const contextDir = path.dirname(contextFile);
    const sameDirectory = candidates.filter(ref =>
      path.dirname(ref.sourceFile) === contextDir
    );
    if (sameDirectory.length > 0) {
      return this.selectByPriority(sameDirectory);
    }
  }

  // 策略2: 优先级排序
  return this.selectByPriority(candidates);
}
```

### 3. 优先级系统

```typescript
private selectByPriority(candidates: LinkReference[]): LinkReference {
  return candidates.sort((a, b) => {
    // 主排序：优先级（降序）
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    // 次排序：文件路径（确保稳定性）
    return a.sourceFile.localeCompare(b.sourceFile);
  })[0];
}
```

## 实现特性

### 1. 智能冲突解决
- **上下文感知**: 优先选择同目录的引用
- **优先级支持**: 支持手动设置引用重要性
- **稳定排序**: 相同条件下保证结果一致性

### 2. 高效管理
```typescript
// 内部存储: Map<引用名称, LinkReference[]>
private references: Map<string, LinkReference[]> = new Map();

// 添加引用（支持更新和去重）
addReference(reference: LinkReference): void {
  const candidates = this.references.get(name) || [];
  const existingIndex = candidates.findIndex(ref =>
    ref.sourceFile === reference.sourceFile && ref.path === reference.path
  );

  if (existingIndex >= 0) {
    candidates[existingIndex] = reference; // 更新
  } else {
    candidates.push(reference); // 添加
  }
}
```

### 3. 文件生命周期管理
```typescript
// 文件删除时清理所有相关引用
removeReferencesFromFile(sourceFile: string): void {
  for (const [name, candidates] of this.references.entries()) {
    const filtered = candidates.filter(ref => ref.sourceFile !== sourceFile);
    if (filtered.length === 0) {
      this.references.delete(name); // 无引用时移除条目
    } else {
      this.references.set(name, filtered);
    }
  }
}
```

## 使用场景验证

### 场景1: 同名不同域引用
```markdown
// research/index.md
[interview-questions]: research-interview-questions.md

// docs/main.md
[interview-questions]: docs-interview-questions.md

// research/note.md
[[interview-questions]]  → research-interview-questions.md (同目录优先)

// docs/guide.md
[[interview-questions]]  → docs-interview-questions.md (同目录优先)

// root/other.md
[[interview-questions]]  → 根据优先级选择最佳匹配
```

### 场景2: 优先级冲突解决
```markdown
// 高优先级引用
[interview-questions]: important/questions.md (priority: 2)

// 低优先级引用
[interview-questions]: archive/old-questions.md (priority: 1)

// 结果：始终选择 important/questions.md
```

### 场景3: 文件更新和删除
- 文件更新：自动移除旧引用，添加新引用
- 文件删除：清理所有来自该文件的引用
- 实时重新计算：影响的链接立即更新

## 性能优化

1. **O(1) 查找**: 基于哈希表的快速名称匹配
2. **最小化计算**: 只在有冲突时执行解决算法
3. **增量更新**: 只更新变化文件的引用
4. **内存效率**: 共享引用对象，避免重复存储

## 向后兼容

- 保留原有API接口
- 渐进式升级路径
- 不破坏现有功能
- 优雅的回退机制

## 技术收益

1. ✅ **正确性**: 彻底解决名称冲突问题
2. ✅ **智能性**: 上下文感知的引用解析
3. ✅ **灵活性**: 支持优先级和自定义策略
4. ✅ **健壮性**: 完整的文件生命周期管理
5. ✅ **性能**: 高效的查找和更新机制

这个重构解决了原始数据结构的根本缺陷，为复杂的多项目、多域名链接场景提供了可靠的解决方案。