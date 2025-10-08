// Simple test script to verify the Deepgram integration
console.log('🧪 Testing Deepgram Integration...\n');

// Test 1: Check if required dependencies are installed
console.log('1. Checking dependencies...');
try {
  const fs = require('fs');
  const path = require('path');
  
  // Check backend package.json
  const backendPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'server', 'package.json'), 'utf8'));
  const requiredDeps = ['@deepgram/sdk', 'openai', 'uuid'];
  
  const missingDeps = requiredDeps.filter(dep => !backendPackage.dependencies[dep]);
  
  if (missingDeps.length === 0) {
    console.log('✅ Backend dependencies are installed');
  } else {
    console.log('❌ Missing backend dependencies:', missingDeps.join(', '));
    console.log('   Run: cd server && npm install');
  }
  
  // Check frontend files
  const frontendFiles = [
    'src/lib/audioCapture.ts',
    'src/pages/Meeting.tsx',
    'src/lib/realtime.ts'
  ];
  
  const missingFiles = frontendFiles.filter(file => !fs.existsSync(path.join(__dirname, file)));
  
  if (missingFiles.length === 0) {
    console.log('✅ Frontend integration files exist');
  } else {
    console.log('❌ Missing frontend files:', missingFiles.join(', '));
  }
  
} catch (error) {
  console.log('❌ Error checking files:', error.message);
}

// Test 2: Check environment configuration
console.log('\n2. Checking environment configuration...');
try {
  const fs = require('fs');
  const path = require('path');
  
  const envExample = fs.readFileSync(path.join(__dirname, 'env.example'), 'utf8');
  
  if (envExample.includes('DEEPGRAM_API_KEY') && envExample.includes('OPENAI_API_KEY')) {
    console.log('✅ Environment template includes required API keys');
  } else {
    console.log('❌ Environment template missing API key placeholders');
  }
  
  // Check if .env exists in server directory
  if (fs.existsSync(path.join(__dirname, 'server', '.env'))) {
    console.log('✅ Server .env file exists');
  } else {
    console.log('⚠️  Server .env file not found - you need to create it');
    console.log('   Copy server/.env.example to server/.env and add your API keys');
  }
  
} catch (error) {
  console.log('❌ Error checking environment:', error.message);
}

// Test 3: Check TypeScript compilation
console.log('\n3. Checking TypeScript compilation...');
try {
  const { execSync } = require('child_process');
  
  // Try to compile the backend
  execSync('cd server && npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ Backend TypeScript compilation successful');
  
} catch (error) {
  console.log('❌ Backend TypeScript compilation failed');
  console.log('   Error:', error.message);
}

console.log('\n🎉 Integration test complete!');
console.log('\nNext steps:');
console.log('1. Add your API keys to server/.env');
console.log('2. Start the backend: cd server && npm run dev');
console.log('3. Start the frontend: npm run dev');
console.log('4. Open http://localhost:8080 and test the meeting features');
