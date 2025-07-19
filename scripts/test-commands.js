#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 LKAP 命令注册测试\n');

// 检查编译输出
const extensionFile = 'out/extension.js';
if (!fs.existsSync(extensionFile)) {
  console.log('❌ 扩展未编译，请运行 npm run compile');
  process.exit(1);
}

console.log('✅ 扩展文件存在');

// 检查 package.json 配置
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log('📋 检查命令配置:');
const commands = pkg.contributes.commands || [];
commands.forEach(cmd => {
  console.log(`   - ${cmd.command}: "${cmd.title}"`);
});

console.log('\n📋 检查快捷键绑定:');
const keybindings = pkg.contributes.keybindings || [];
keybindings.forEach(kb => {
  console.log(`   - ${kb.command}: ${kb.key} (Mac: ${kb.mac || 'N/A'})`);
});

console.log('\n📋 检查激活事件:');
const activationEvents = pkg.activationEvents || [];
activationEvents.forEach(event => {
  console.log(`   - ${event}`);
});

// 检查编译后的代码
console.log('\n🔍 检查编译后的代码:');
const extensionContent = fs.readFileSync(extensionFile, 'utf8');

// 检查 dailyNote.js 文件
const dailyNoteFile = 'out/commands/dailyNote.js';
let dailyNoteContent = '';
if (fs.existsSync(dailyNoteFile)) {
  dailyNoteContent = fs.readFileSync(dailyNoteFile, 'utf8');
}

const hasRegisterCommand = dailyNoteContent.includes('registerCommand') || extensionContent.includes('registerCommand');
const hasCreateDailyNote = dailyNoteContent.includes('lkap.createDailyNote') || extensionContent.includes('lkap.createDailyNote');
const hasActivateFunction = extensionContent.includes('function activate');
const hasRegisterDailyNoteCommands = extensionContent.includes('registerDailyNoteCommands');

console.log(`   - 包含 registerCommand: ${hasRegisterCommand ? '✅' : '❌'}`);
console.log(`   - 包含 lkap.createDailyNote: ${hasCreateDailyNote ? '✅' : '❌'}`);
console.log(`   - 包含 activate 函数: ${hasActivateFunction ? '✅' : '❌'}`);
console.log(`   - 包含 registerDailyNoteCommands 调用: ${hasRegisterDailyNoteCommands ? '✅' : '❌'}`);

if (hasRegisterCommand && hasCreateDailyNote && hasActivateFunction && hasRegisterDailyNoteCommands) {
  console.log('\n🎉 命令注册检查通过！');
  console.log('\n💡 如果仍然遇到 "command not found" 错误，请检查:');
  console.log('   1. 扩展是否在 VSCode 中正确安装');
  console.log('   2. 检查 VSCode 开发者控制台的错误信息');
  console.log('   3. 尝试重新加载 VSCode 窗口 (Ctrl+Shift+P -> "Reload Window")');
  console.log('   4. 确认扩展已激活（看是否有 "Link Knowledge And Plan extension is activating..." 日志）');
} else {
  console.log('\n❌ 发现问题，请检查代码实现');
}

console.log('\n📖 调试建议:');
console.log('   - 打开 VSCode 开发者控制台 (Help -> Toggle Developer Tools)');
console.log('   - 查看 Console 标签页的错误信息');
console.log('   - 确认扩展激活日志: "Link Knowledge And Plan extension is activating..."');
console.log('   - 检查是否有其他 TypeScript 编译错误'); 