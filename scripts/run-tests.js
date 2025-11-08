#!/usr/bin/env node

/**
 * LKAP Unit Tests Runner
 * Runs Mocha tests for all linking functionality
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('\n🧪 LKAP Unit Tests\n');

// Check if mocha is installed
const mochaPath = path.join(__dirname, '..', 'node_modules', '.bin', 'mocha');
if (!fs.existsSync(mochaPath)) {
  console.error('❌ Mocha not found. Please run: npm install');
  process.exit(1);
}

// Check if tests exist
const testDir = path.join(__dirname, '..', 'src', '__tests__');
if (!fs.existsSync(testDir)) {
  console.error('❌ Test directory not found');
  process.exit(1);
}

// Check if out/extension.js exists (compiled code needed for imports)
const outFile = path.join(__dirname, '..', 'out', 'extension.js');
if (!fs.existsSync(outFile)) {
  console.error('❌ Extension not compiled. Please run: npm run compile');
  process.exit(1);
}

console.log('📋 Test Files Found:');
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));
testFiles.forEach(f => {
  console.log(`   - ${f}`);
});
console.log('');

// Run mocha with TypeScript support
const mocha = spawn('npx', [
  'mocha',
  '--require', 'ts-node/register',
  '--extension', 'ts',
  `${testDir}/**/*.test.ts`,
  '--timeout', '5000',
  '--reporter', 'spec'
], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit'
});

mocha.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log(`\n❌ Tests failed with exit code ${code}`);
  }
  process.exit(code);
});

mocha.on('error', (err) => {
  console.error('❌ Failed to run tests:', err.message);
  process.exit(1);
});
