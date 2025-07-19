#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 LKAP 扩展包验证\n');

// 检查打包文件
const extensionFile = 'out/extension.js';
if (!fs.existsSync(extensionFile)) {
  console.log('❌ 打包文件不存在，请运行 npm run build');
  process.exit(1);
}

const extensionContent = fs.readFileSync(extensionFile, 'utf8');
const fileSize = fs.statSync(extensionFile).size;

console.log(`✅ 扩展文件存在 (${Math.round(fileSize / 1024)}KB)`);

// 检查关键依赖是否被打包
const checks = [
  { name: 'moment.js', pattern: 'moment', critical: true },
  { name: 'registerCommand', pattern: 'registerCommand', critical: true },
  { name: 'lkap.createDailyNote', pattern: 'lkap.createDailyNote', critical: true },
  { name: 'activate函数', pattern: 'activate(', critical: true }, // 修改匹配模式
  { name: 'moment调用', pattern: 'moment(', critical: false }, // 修改匹配模式
  { name: 'vscode模块引用', pattern: 'vscode', critical: true } // 简化匹配
];

console.log('\n📋 检查打包内容:');

let allCriticalPassed = true;

checks.forEach(check => {
  const found = extensionContent.includes(check.pattern);
  const status = found ? '✅' : (check.critical ? '❌' : '⚠️');
  console.log(`   ${status} ${check.name}: ${found ? '已包含' : '未找到'}`);
  
  if (check.critical && !found) {
    allCriticalPassed = false;
  }
});

// 检查文件大小合理性
console.log('\n📏 文件大小分析:');
if (fileSize < 50000) {
  console.log('   ⚠️ 文件可能太小，依赖可能未正确打包');
  allCriticalPassed = false;
} else if (fileSize > 1000000) {
  console.log('   ⚠️ 文件较大，可能包含不必要的依赖');
} else {
  console.log('   ✅ 文件大小合理');
}

// 检查 .vsix 文件
const vsixFiles = fs.readdirSync('.').filter(f => f.endsWith('.vsix'));
if (vsixFiles.length > 0) {
  const latestVsix = vsixFiles.sort().reverse()[0];
  const vsixSize = fs.statSync(latestVsix).size;
  console.log(`\n📦 VSIX包: ${latestVsix} (${Math.round(vsixSize / 1024 / 1024 * 100) / 100}MB)`);
}

console.log('\n' + '='.repeat(50));

if (allCriticalPassed) {
  console.log('🎉 验证通过！扩展包已准备就绪');
  console.log('\n📤 下一步:');
  console.log('   1. 在新的 VSCode 环境中安装 .vsix 文件测试');
  console.log('   2. 验证快捷键 Ctrl+Shift+T 是否工作');
  console.log('   3. 检查开发者控制台是否有错误');
  console.log('   4. 如果一切正常，可以发布到市场');
} else {
  console.log('❌ 验证失败！请检查上述问题');
}

console.log('\n💡 安装命令:');
console.log('   code --install-extension ' + (vsixFiles[0] || 'lkap-x.x.x.vsix')); 