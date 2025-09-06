const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { trackEvent } = require('../utils/analytics');

// Get general analytics overview
router.get('/overview', async (req, res) => {
    try {
        const [
            totalStories,
            totalUsers,
            totalContributions,
            totalQuizzes,
            recentActivity
        ] = await Promise.all([
            db.get('SELECT COUNT(*) as count FROM stories WHERE status = "approved"'),
            db.get('SELECT COUNT(*) as count FROM users'),
            db.get('SELECT COUNT(*) as count FROM contributions'),
            db.get('SELECT COUNT(*) as count FROM quiz_sessions WHERE completed = TRUE'),
            db.all(`
                SELECT DATE(created_at) as date, COUNT(*) as count 
                FROM analytics 
                WHERE created_at >= date('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `)
        ]);

        const overview = {
            total_stories: totalStories.count,
            total_users: totalUsers.count,
            total_contributions: totalContributions.count,
            total_quizzes_completed: totalQuizzes.count,
            recent_activity: recentActivity
        };

        res.json(overview);
    } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
});

// Get story analytics
router.get('/stories', async (req, res) => {
    try {
        const { timeframe = '30' } = req.query;

        const [
            storyTypes,
            storyLocations,
            popularStories,
            viewsOverTime
        ] = await Promise.all([
            db.all('SELECT story_type, COUNT(*) as count FROM stories WHERE status = "approved" GROUP BY story_type ORDER BY count DESC'),
            db.all('SELECT location, COUNT(*) as count FROM stories WHERE status = "approved" GROUP BY location ORDER BY count DESC LIMIT 10'),
            db.all('SELECT id, title, views, likes FROM stories WHERE status = "approved" ORDER BY views DESC LIMIT 10'),
            db.all(`
                SELECT DATE(created_at) as date, COUNT(*) as count 
                FROM stories 
                WHERE status = "approved" AND created_at >= date('now', '-${parseInt(timeframe)} days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `)
        ]);

        res.json({
            story_types: storyTypes,
            story_locations: storyLocations,
            popular_stories: popularStories,
            views_over_time: viewsOverTime
        });
    } catch (error) {
        console.error('Error fetching story analytics:', error);
        res.status(500).json({ error: 'Failed to fetch story analytics' });
    }
});

// Get user engagement analytics
router.get('/engagement', async (req, res) => {
    try {
        const { timeframe = '30' } = req.query;

        const [
            userActivity,
            quizPerformance,
            interactionTypes,
            engagementTrends
        ] = await Promise.all([
            db.all(`
                SELECT 
                    COUNT(DISTINCT user_id) as active_users,
                    DATE(created_at) as date
                FROM analytics 
                WHERE created_at >= date('now', '-${parseInt(timeframe)} days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `),
            db.all(`
                SELECT 
                    AVG(score) as avg_score,
                    COUNT(*) as total_attempts,
                    DATE(completed_at) as date
                FROM quiz_sessions 
                WHERE completed = TRUE AND completed_at >= date('now', '-${parseInt(timeframe)} days')
                GROUP BY DATE(completed_at)
                ORDER BY date DESC
            `),
            db.all('SELECT interaction_type, COUNT(*) as count FROM story_interactions GROUP BY interaction_type'),
            db.all(`
                SELECT 
                    event_type,
                    COUNT(*) as count,
                    DATE(created_at) as date
                FROM analytics 
                WHERE created_at >= date('now', '-${parseInt(timeframe)} days')
                GROUP BY event_type, DATE(created_at)
                ORDER BY date DESC, count DESC
            `)
        ]);

        res.json({
            user_activity: userActivity,
            quiz_performance: quizPerformance,
            interaction_types: interactionTypes,
            engagement_trends: engagementTrends
        });
    } catch (error) {
        console.error('Error fetching engagement analytics:', error);
        res.status(500).json({ error: 'Failed to fetch engagement analytics' });
    }
});

// Track custom event
router.post('/track', async (req, res) => {
    try {
        const { event_type, event_data, user_id } = req.body;

        if (!event_type) {
            return res.status(400).json({ error: 'Event type is required' });
        }

        await trackEvent(event_type, event_data, user_id, req.ip, req.get('User-Agent'));

        res.json({ success: true, message: 'Event tracked successfully' });
    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// Get real-time statistics
router.get('/realtime', async (req, res) => {
    try {
        const [
            activeUsers,
            recentEvents,
            currentQuizzes,
            recentContributions
        ] = await Promise.all([
            db.get(`
                SELECT COUNT(DISTINCT user_id) as count 
                FROM analytics 
                WHERE created_at >= datetime('now', '-1 hour')
            `),
            db.all(`
                SELECT event_type, COUNT(*) as count 
                FROM analytics 
                WHERE created_at >= datetime('now', '-1 hour')
                GROUP BY event_type
                ORDER BY count DESC
                LIMIT 5
            `),
            db.get(`
                SELECT COUNT(*) as count 
                FROM quiz_sessions 
                WHERE created_at >= datetime('now', '-1 hour') AND completed = FALSE
            `),
            db.get(`
                SELECT COUNT(*) as count 
                FROM contributions 
                WHERE created_at >= datetime('now', '-1 hour')
            `)
        ]);

        res.json({
            active_users_last_hour: activeUsers.count,
            recent_events: recentEvents,
            active_quizzes: currentQuizzes.count,
            recent_contributions: recentContributions.count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching real-time analytics:', error);
        res.status(500).json({ error: 'Failed to fetch real-time analytics' });
    }
});

// Get geographic analytics
router.get('/geographic', async (req, res) => {
    try {
        const [
            storyDistribution,
            userDistribution,
            contributionDistribution
        ] = await Promise.all([
            db.all(`
                SELECT 
                    location,
                    COUNT(*) as story_count,
                    AVG(views) as avg_views,
                    AVG(likes) as avg_likes
                FROM stories 
                WHERE status = "approved" AND location IS NOT NULL
                GROUP BY location
                ORDER BY story_count DESC
            `),
            db.all(`
                SELECT 
                    location,
                    COUNT(*) as user_count
                FROM users 
                WHERE location IS NOT NULL
                GROUP BY location
                ORDER BY user_count DESC
            `),
            db.all(`
                SELECT 
                    JSON_EXTRACT(story_data, '$.location') as location,
                    COUNT(*) as contribution_count
                FROM contributions 
                WHERE JSON_EXTRACT(story_data, '$.location') IS NOT NULL
                GROUP BY JSON_EXTRACT(story_data, '$.location')
                ORDER BY contribution_count DESC
            `)
        ]);

        res.json({
            story_distribution: storyDistribution,
            user_distribution: userDistribution,
            contribution_distribution: contributionDistribution
        });
    } catch (error) {
        console.error('Error fetching geographic analytics:', error);
        res.status(500).json({ error: 'Failed to fetch geographic analytics' });
    }
});

module.exports = router;