const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const storyRoutes = require('./routes/stories');
const userRoutes = require('./routes/users');
const contributionRoutes = require('./routes/contributions');
const interactiveRoutes = require('./routes/interactive');
const analyticsRoutes = require('./routes/analytics');

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for frontend
}));
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('.'));

// API Routes
app.use('/api/stories', storyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/interactive', interactiveRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve frontend files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/stories', (req, res) => {
    res.sendFile(path.join(__dirname, 'stories.html'));
});

app.get('/interactive', (req, res) => {
    res.sendFile(path.join(__dirname, 'interactive.html'));
});

app.get('/contribute', (req, res) => {
    res.sendFile(path.join(__dirname, 'contribute.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const db = require('./config/database');
db.init().then(() => {
    app.listen(PORT, () => {
        console.log(`🌊 Suara Samudra server running on port ${PORT}`);
        console.log(`📍 Frontend: http://localhost:${PORT}`);
        console.log(`🔗 API: http://localhost:${PORT}/api`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

module.exports = app;