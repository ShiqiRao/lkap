# Link Knowledge And Plan - VSCode Extension

一个强大的 VSCode 扩展，用于管理 Markdown 笔记，支持日记创建、双向链接和标签管理。

**🌎 [English Documentation](./README.md)**

## 🚀 主要功能

### ✅ 已实现功能

#### 📝 快速创建日记
- **快捷键**: `Ctrl+Shift+T` (Windows/Linux) 或 `Cmd+Shift+T` (Mac)
- **命令**: "Create Today's Note"
- 自动创建以今日日期命名的笔记文件
- 支持自定义日期格式
- 智能模板系统，支持变量替换
- 如果日记已存在，直接打开

### 🔧 配置选项

在 VSCode 设置中搜索 "lkap" 可以找到以下配置项：

- **笔记存储路径** (`lkap.notesPath`): 默认 `./notes`
- **日期格式** (`lkap.dailyNoteFormat`): 默认 `YYYY-MM-DD`
- **日记模板** (`lkap.dailyNoteTemplate`): 自定义模板文件路径
- **自动创建链接** (`lkap.autoCreateLinks`): 默认 `true`
- **启用索引** (`lkap.enableIndexing`): 默认 `true`

## 📋 使用指南

### 创建日记

1. **方法一**: 使用快捷键 `Ctrl+Shift+T` (Windows/Linux) 或 `Cmd+Shift+T` (Mac)
2. **方法二**: 打开命令面板 (`Ctrl+Shift+P`)，输入 "Create Today's Note"
3. 扩展会自动在配置的笔记目录下创建今天的日记文件

### 自定义模板

1. 在工作区创建模板文件，例如 `templates/daily-note.md`
2. 在设置中将 `lkap.dailyNoteTemplate` 设置为模板文件路径
3. 模板支持以下变量：
   - `{{date}}`: 日期 (YYYY-MM-DD)
   - `{{dayOfWeek}}`: 星期几 (Monday, Tuesday, ...)
   - `{{timestamp}}`: 完整时间戳
   - `{{year}}`: 年份
   - `{{month}}`: 月份
   - `{{day}}`: 日期
   - `{{time}}`: 时间 (HH:mm:ss)

### 示例模板

```markdown
# {{date}} - {{dayOfWeek}}

## 🎯 今日目标
- [ ] 

## 📝 工作记录


## 📚 学习笔记


## 💭 随想记录


---
*创建于: {{time}}*
```

## 🛠️ 开发

### 环境搭建

1. 克隆项目
2. 安装依赖: `npm install`
3. 编译代码: `npm run compile`
4. 按 F5 启动调试模式

### 项目结构

```
src/
├── extension.ts              # 扩展主入口
├── commands/                 # 命令实现
│   └── dailyNote.ts         # 日记相关命令
├── utils/                   # 工具函数
│   ├── fileUtils.ts         # 文件操作
│   └── dateUtils.ts         # 日期处理
└── types/                   # 类型定义
    └── index.ts            # 公共类型
```

## 📁 文件结构示例

```
```

## 🗓️ 开发计划

### Phase 1: 基础功能 ✅
- [x] 项目搭建和环境配置
- [x] 快速创建日记功能
- [ ] 基础双向链接支持
- [ ] 简单标签解析
- [ ] 基础索引系统设计
- [ ] 文件发现和解析器实现

### Phase 2: 核心功能完善 (进行中)
- [ ] 链接自动完成和跳转
- [ ] 反向链接显示
- [ ] 标签树视图
- [ ] 配置管理界面
- [ ] 完整索引管理器实现
- [ ] 增量索引更新机制
- [ ] 索引持久化和缓存

### Phase 3: 高级功能 (计划中)
- [ ] 链接预览和悬停显示
- [ ] 标签批量操作
- [ ] 模板系统
- [ ] 搜索和过滤
- [ ] 索引性能优化
- [ ] 并发处理和内存管理
- [ ] 索引完整性验证

### Phase 4: 优化和发布 (计划中)
- [ ] 性能优化
- [ ] 用户体验改进
- [ ] 文档完善
- [ ] 扩展市场发布
- [ ] 索引性能基准测试
- [ ] 大规模笔记库测试

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如果您在使用过程中遇到问题，请：
1. 查看本文档的常见问题部分
2. 在 GitHub 上提交 Issue
3. 查看 VSCode 的开发者控制台输出

## 🌟 致谢

本项目受到 Obsidian 和 Roam Research 等流行笔记工具的启发，旨在将类似功能带到 VSCode 环境中。

---

**喜欢这个扩展？给我们一个 ⭐ 吧！**