# Link Knowledge And Plan - VSCode Extension

一个功能强大的 VSCode 扩展，专为 markdown 格式的笔记管理而设计。

## ✨ 主要功能

### 📅 快速创建日记
- **快捷键操作**: 通过自定义快捷键快速创建当天的笔记文件
- **智能跳转**: 如果当天的笔记已存在，将直接跳转到该文件
- **文件命名**: 支持自定义日期格式（如 `2024-01-15.md`、`2024/01/15.md` 等）

### 🔗 双向链接
- **Wiki 链接**: 支持 `[[title]]` 语法创建双向链接
- **自动创建**: 点击不存在的链接时自动创建对应的 markdown 文件
- **反向链接**: 在文件中显示所有指向当前文件的反向链接
- **链接预览**: 悬停显示链接目标文件的预览内容

### 🏷️ 标签管理
- **标签语法**: 支持 `#tag` 或 `@tag` 语法为文档添加标签
- **标签面板**: 在侧边栏显示所有标签和相关文件
- **标签筛选**: 通过标签快速筛选和查找相关笔记
- **标签统计**: 显示每个标签下的文件数量

## 🚀 安装使用

### 安装方式
1. 在 VSCode 扩展市场搜索 "Markdown Note Manager"
2. 点击安装并重启 VSCode
3. 或者下载 `.vsix` 文件手动安装

### 快速开始
1. **设置笔记目录**: 在设置中配置笔记存储路径
2. **创建日记**: 使用快捷键 `Ctrl+Shift+T` (Windows/Linux) 或 `Cmd+Shift+T` (Mac)
3. **添加链接**: 在文档中输入 `[[文件名]]` 创建双向链接
4. **添加标签**: 在文档中使用 `#标签名` 为文档分类

## ⚙️ 配置选项

```json
{
  "linkKnowledgeAndPlan.dailyNotesPath": "./dailyNotes",
  "linkKnowledgeAndPlan.dailyNoteFormat": "YYYY-MM-DD",
  "linkKnowledgeAndPlan.autoCreateLinks": true,
  "linkKnowledgeAndPlan.tagPrefix": "#",
  "linkKnowledgeAndPlan.showBacklinks": true,
  "linkKnowledgeAndPlan.linkPreview": true
}
```

### 配置说明
- `notesPath`: 笔记文件存储路径
- `dailyNoteFormat`: 日记文件名的日期格式
- `autoCreateLinks`: 是否自动创建不存在的链接文件
- `tagPrefix`: 标签前缀符号（# 或 @）
- `showBacklinks`: 是否显示反向链接
- `linkPreview`: 是否启用链接悬停预览

## 📁 文件结构示例

```
notes/
├── 2024-01-15.md          # 日记文件
├── 项目管理.md            # 笔记文件
├── 学习笔记.md            # 笔记文件
└── .obsidian/             # 配置文件夹（可选）
    └── graph.json         # 图谱配置
```

## 🔧 开发与贡献

### 技术栈
- TypeScript
- VSCode Extension API
- Node.js

### 本地开发
```bash
# 克隆项目
git clone <repository-url>

# 安装依赖
npm install

# 开始开发
npm run dev

# 构建扩展
npm run build

# 打包
npm run package
```

### 贡献指南
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📝 更新日志

### v1.0.0 (计划中)
- ✅ 快速创建日记功能
- ✅ 双向链接支持
- ✅ 标签管理系统
- ✅ 基础配置选项

### 未来计划
- 📊 笔记关系图谱可视化
- 🔍 全文搜索功能
- 📄 模板系统
- 🌙 夜间模式支持
- 📱 移动端同步

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 💬 反馈与支持

- 🐛 [报告 Bug](https://github.com/username/markdown-note-manager/issues)
- 💡 [功能建议](https://github.com/username/markdown-note-manager/discussions)
- 📧 邮箱：support@example.com

---

**喜欢这个扩展？给我们一个 ⭐ 吧！**
