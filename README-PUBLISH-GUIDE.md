# VSCode 扩展发布指南

## 📋 发布前检查清单

### ✅ 已完成项目
- [x] 扩展功能实现（日记创建）
- [x] package.json 配置完善
- [x] LICENSE 文件
- [x] CHANGELOG.md
- [x] README.md（英文版）
- [x] README-CN.md（中文版）
- [x] .vscodeignore 文件

### ⚠️ 需要手动完成的项目

#### 1. 创建扩展图标
**当前状态**: 已创建 SVG 模板
**需要完成**: 转换为 128x128 PNG

**选项 A: 在线转换**
1. 访问 https://convertio.co/svg-png/
2. 上传 `resources/icons/icon.svg`
3. 设置尺寸为 128x128
4. 下载并保存为 `resources/icons/icon.png`

**选项 B: 使用设计工具**
- 使用 Figma/Sketch/Photoshop 创建 128x128 PNG
- 建议使用蓝色主题 (#2196F3) 配合笔记本和链接元素

#### 2. 注册 VSCode Marketplace 发布者
1. 访问 https://marketplace.visualstudio.com/manage
2. 使用 Microsoft/GitHub 账号登录
3. 创建发布者 (Publisher)
4. 更新 `package.json` 中的 `publisher` 字段

#### 3. 设置 GitHub 仓库（可选但推荐）
1. 在 GitHub 创建仓库
2. 更新 `package.json` 中的以下字段：
   ```json
   {
     "homepage": "https://github.com/YOUR-USERNAME/lkap#readme",
     "repository": {
       "type": "git",
       "url": "https://github.com/YOUR-USERNAME/lkap.git"
     },
     "bugs": {
       "url": "https://github.com/YOUR-USERNAME/lkap/issues"
     }
   }
   ```

## 🚀 发布步骤

### 1. 安装 vsce
```bash
npm install -g @vscode/vsce
```

### 2. 获取个人访问令牌
1. 访问 https://dev.azure.com/
2. 创建 Personal Access Token
3. 设置权限为 "Marketplace (manage)"

### 3. 登录 vsce
```bash
vsce login YOUR-PUBLISHER-NAME
```

### 4. 打包测试
```bash
npm run package
```

### 5. 发布
```bash
npm run publish
```

## 📝 发布后的维护

### 版本管理
- 使用语义化版本 (Semantic Versioning)
- 更新 CHANGELOG.md
- 创建 Git tags

### 监控和支持
- 监控插件市场的评分和评论
- 及时响应用户反馈和问题报告
- 定期更新和功能改进

## 🔍 质量检查

### 功能测试
- [ ] 在不同操作系统上测试（Windows, macOS, Linux）
- [ ] 测试各种 VSCode 版本兼容性
- [ ] 验证所有配置选项正常工作
- [ ] 测试错误处理和边缘情况

### 文档检查
- [ ] README 内容准确完整
- [ ] 配置选项文档清晰
- [ ] 示例和截图更新

### 性能验证
- [ ] 扩展启动时间 < 500ms
- [ ] 内存使用合理
- [ ] 大文件处理性能

## 📈 推广建议

1. **社交媒体分享**: Twitter, LinkedIn, Reddit
2. **技术社区**: VSCode 社区, Markdown 用户群
3. **博客文章**: 介绍功能和使用场景
4. **视频演示**: 录制功能演示视频

---

**准备好发布了吗？确保所有检查项都已完成！** ✨ 