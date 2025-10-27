#!/usr/bin/env node

/**
 * Check if all required services are running
 */

const http = require('http');

const services = [
  {
    name: 'Frontend (Vite)',
    url: 'http://localhost:5173',
    port: 5173
  },
  {
    name: 'Realtime Server (Socket.IO)',
    url: 'http://localhost:5174/health',
    port: 5174
  },
  {
    name: 'Python Backend (FastAPI)',
    url: 'http://localhost:8000/status',
    port: 8000
  }
];

function checkService(service) {
  return new Promise((resolve) => {
    const url = new URL(service.url);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve({
        ...service,
        status: res.statusCode >= 200 && res.statusCode < 400 ? '✅ Running' : '⚠️ Error',
        code: res.statusCode
      });
    });

    req.on('error', () => {
      resolve({
        ...service,
        status: '❌ Not running',
        code: null
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ...service,
        status: '❌ Timeout',
        code: null
      });
    });

    req.end();
  });
}

async function checkAllServices() {
  console.log('\n🔍 Checking Yarn services...\n');
  
  const results = await Promise.all(services.map(checkService));
  
  let allRunning = true;
  
  results.forEach(result => {
    console.log(`${result.status}  ${result.name}`);
    console.log(`   ${result.url}`);
    if (result.code) {
      console.log(`   Status: ${result.code}`);
    }
    console.log('');
    
    if (!result.status.includes('Running')) {
      allRunning = false;
    }
  });
  
  if (allRunning) {
    console.log('✨ All services are running! You\'re ready to go.\n');
    console.log('📝 Next steps:');
    console.log('   1. Open http://localhost:5173 in your browser');
    console.log('   2. Click "Create a yarn" to start a meeting');
    console.log('   3. Share the room code with others to join\n');
  } else {
    console.log('⚠️  Some services are not running. Start them with:\n');
    
    if (!results[0].status.includes('Running')) {
      console.log('   Frontend:        npm run dev');
    }
    if (!results[1].status.includes('Running')) {
      console.log('   Realtime Server: cd server && npm run dev');
    }
    if (!results[2].status.includes('Running')) {
      console.log('   Python Backend:  cd server && python main.py');
    }
    console.log('');
  }
}

checkAllServices().catch(err => {
  console.error('Error checking services:', err);
  process.exit(1);
});

