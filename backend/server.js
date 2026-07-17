// Entry point for production deployment (Vercel)
// This file redirects to the compiled TypeScript code in dist/

// Check if we're in production and compiled code exists
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist', 'server.js');
const srcPath = path.join(__dirname, 'src', 'server.ts');

// In production, use compiled code from dist/
if (fs.existsSync(distPath)) {
  console.log('🚀 Starting production server from dist/server.js');
  require('./dist/server.js');
} else if (process.env.NODE_ENV === 'production') {
  console.error('❌ Production build not found. Please run "npm run build" first.');
  process.exit(1);
} else {
  // In development, use ts-node-dev (should not reach here normally)
  console.log('⚠️ Development mode - please use "npm run dev" instead');
  require('ts-node/register');
  require(srcPath);
}
