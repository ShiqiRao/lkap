#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 LKAP 扩展发布准备检查\n');

const checks = [
  {
    name: '检查 package.json',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const issues = [];
      
      if (pkg.publisher === 'your-publisher-name') {
        issues.push('publisher 字段需要设置为真实的发布者名称');
      }
      
      if (!pkg.icon) {
        issues.push('缺少 icon 字段');
      }
      
      if (!pkg.repository || pkg.repository.url.includes('your-username')) {
        issues.push('repository 字段需要设置为真实的仓库地址');
      }
      
      return issues;
    }
  },
  {
    name: '检查必需文件',
    check: () => {
      const requiredFiles = [
        'LICENSE',
        'CHANGELOG.md',
        'README.md',
        'README-CN.md',
        '.vscodeignore'
      ];
      
      const missing = requiredFiles.filter(file => !fs.existsSync(file));
      return missing.map(file => `缺少文件: ${file}`);
    }
  },
  {
    name: '检查扩展图标',
    check: () => {
      const iconPath = 'resources/icons/icon.png';
      if (!fs.existsSync(iconPath)) {
        return ['需要创建 128x128 PNG 图标文件'];
      }
      return [];
    }
  },
  {
    name: '检查编译状态',
    check: () => {
      if (!fs.existsSync('out/extension.js')) {
        return ['需要先编译项目: npm run compile'];
      }
      return [];
    }
  }
];

let allPassed = true;

checks.forEach(({ name, check }) => {
  console.log(`📋 ${name}...`);
  const issues = check();
  
  if (issues.length === 0) {
    console.log('   ✅ 通过\n');
  } else {
    console.log('   ❌ 发现问题:');
    issues.forEach(issue => console.log(`      - ${issue}`));
    console.log('');
    allPassed = false;
  }
});

if (allPassed) {
  console.log('🎉 所有检查通过！可以准备发布了。');
  console.log('\n下一步:');
  console.log('1. 运行 npm run package 创建 .vsix 文件');
  console.log('2. 测试 .vsix 文件');
  console.log('3. 运行 npm run publish 发布到市场');
} else {
  console.log('⚠️  请修复上述问题后再尝试发布。');
  console.log('\n参考 README-PUBLISH-GUIDE.md 获取详细指导。');
}

console.log('\n📖 发布指南: README-PUBLISH-GUIDE.md'); 