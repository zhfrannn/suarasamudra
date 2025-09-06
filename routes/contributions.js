const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { trackEvent } = require('../utils/analytics');
const { sendNotificationEmail } = require('../utils/email');

// Submit a new story contribution
router.post('/', async (req, res) => {
    try {
        const {
            name,
            location,
            story_type,
            story_content,
            contact_info,
            consent,
            user_id
        } = req.body;

        // Validation
        if (!story_content || !location || !story_type) {
            return res.status(400).json({ 
                error: 'Missing required fields: story_content, location, story_type' 
            });
        }

        if (!consent) {
            return res.status(400).json({ 
                error: 'Consent is required to submit a story' 
            });
        }

        const contributionId = uuidv4();
        const storyData = JSON.stringify({
            name: name || 'Anonymous',
            location,
            story_type,
            story_content,
            tags: req.body.tags || [],
            coordinates: req.body.coordinates || null
        });

        // Insert contribution
        await db.run(
            'INSERT INTO contributions (id, user_id, story_data, contact_info, status) VALUES (?, ?, ?, ?, ?)',
            [contributionId, user_id || null, storyData, contact_info || null, 'pending']
        );

        // Send notification email if contact info provided
        if (contact_info && contact_info.includes('@')) {
            try {
                await sendNotificationEmail(
                    contact_info,
                    'Story Contribution Received',
                    `Thank you for sharing your story with Suara Samudra. Your contribution (ID: ${contributionId}) has been received and will be reviewed by our team.`
                );
            } catch (emailError) {
                console.error('Failed to send notification email:', emailError);
                // Don't fail the request if email fails
            }
        }

        await trackEvent('story_contributed', { 
            contribution_id: contributionId,
            story_type,
            location,
            user_id 
        });

        res.status(201).json({
            success: true,
            contribution_id: contributionId,
            message: 'Story contribution submitted successfully. Thank you for sharing your experience!'
        });
    } catch (error) {
        console.error('Error submitting contribution:', error);
        res.status(500).json({ error: 'Failed to submit story contribution' });
    }
});

// Get contribution status
router.get('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;

        const contribution = await db.get(
            'SELECT id, status, created_at, processed_at FROM contributions WHERE id = ?',
            [id]
        );

        if (!contribution) {
            return res.status(404).json({ error: 'Contribution not found' });
        }

        res.json({
            id: contribution.id,
            status: contribution.status,
            submitted_at: contribution.created_at,
            processed_at: contribution.processed_at,
            message: getStatusMessage(contribution.status)
        });
    } catch (error) {
        console.error('Error fetching contribution status:', error);
        res.status(500).json({ error: 'Failed to fetch contribution status' });
    }
});

// Get user's contributions
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const offset = (page - 1) * limit;

        const [contributions, totalResult] = await Promise.all([
            db.all(
                'SELECT id, status, created_at, processed_at FROM contributions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
                [userId, parseInt(limit), offset]
            ),
            db.get('SELECT COUNT(*) as total FROM contributions WHERE user_id = ?', [userId])
        ]);

        const processedContributions = contributions.map(contribution => ({
            ...contribution,
            message: getStatusMessage(contribution.status)
        }));

        res.json({
            contributions: processedContributions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult.total,
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user contributions:', error);
        res.status(500).json({ error: 'Failed to fetch user contributions' });
    }
});

// Submit feedback on a story
router.post('/feedback', async (req, res) => {
    try {
        const {
            story_id,
            feedback_type,
            feedback_content,
            user_id,
            contact_info
        } = req.body;

        if (!story_id || !feedback_type || !feedback_content) {
            return res.status(400).json({ 
                error: 'Missing required fields: story_id, feedback_type, feedback_content' 
            });
        }

        const feedbackId = uuidv4();
        const feedbackData = JSON.stringify({
            story_id,
            feedback_type,
            feedback_content,
            contact_info
        });

        await db.run(
            'INSERT INTO contributions (id, user_id, story_data, contact_info, status) VALUES (?, ?, ?, ?, ?)',
            [feedbackId, user_id || null, feedbackData, contact_info || null, 'feedback']
        );

        await trackEvent('feedback_submitted', { 
            feedback_id: feedbackId,
            story_id,
            feedback_type,
            user_id 
        });

        res.status(201).json({
            success: true,
            feedback_id: feedbackId,
            message: 'Feedback submitted successfully. Thank you for your input!'
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// Get contribution statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const [statusStats, typeStats, locationStats, recentStats] = await Promise.all([
            db.all('SELECT status, COUNT(*) as count FROM contributions GROUP BY status'),
            db.all(`
                SELECT JSON_EXTRACT(story_data, '$.story_type') as story_type, COUNT(*) as count 
                FROM contributions 
                WHERE status != 'feedback' 
                GROUP BY JSON_EXTRACT(story_data, '$.story_type')
            `),
            db.all(`
                SELECT JSON_EXTRACT(story_data, '$.location') as location, COUNT(*) as count 
                FROM contributions 
                WHERE status != 'feedback' 
                GROUP BY JSON_EXTRACT(story_data, '$.location')
                ORDER BY count DESC
                LIMIT 10
            `),
            db.all(`
                SELECT DATE(created_at) as date, COUNT(*) as count 
                FROM contributions 
                WHERE created_at >= date('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `)
        ];
        )

        res.json({
            status_distribution: statusStats,
            story_types: typeStats,
            top_locations: locationStats,
            recent_activity: recentStats
        });
    } catch (error) {
        console.error('Error fetching contribution stats:', error);
        res.status(500).json({ error: 'Failed to fetch contribution statistics' });
    }
});

function getStatusMessage(status) {
    const messages = {
        'pending': 'Your story is being reviewed by our team.',
        'approved': 'Your story has been approved and published!',
        'rejected': 'Your story needs some modifications. We\'ll contact you soon.',
        'feedback': 'Your feedback has been received and is being reviewed.'
    };
    return messages[status] || 'Status unknown';
}

module.exports = router;