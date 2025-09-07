const fs = require('fs');
const path = require('path');

console.log('🌊 Setting up Suara Samudra backend...');

// Create data directory
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Created data directory');
}

// Copy .env.example to .env if it doesn't exist
const envExample = path.join(__dirname, '../.env.example');
const envFile = path.join(__dirname, '../.env');

if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    console.log('✅ Created .env file from example');
    console.log('⚠️  Please update the .env file with your configuration');
}

console.log('🎉 Setup complete! Run "npm start" to start the server.');
console.log('📖 Visit http://localhost:3000 to see your application.');