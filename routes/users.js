const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { trackEvent } = require('../utils/analytics');

// Create or update user profile
router.post('/profile', async (req, res) => {
    try {
        const { name, email, location, user_id } = req.body;

        if (!name && !email && !location) {
            return res.status(400).json({ error: 'At least one field (name, email, location) is required' });
        }

        const userId = user_id || uuidv4();
        
        // Check if user exists
        const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (existingUser) {
            // Update existing user
            const updates = [];
            const params = [];
            
            if (name !== undefined) {
                updates.push('name = ?');
                params.push(name);
            }
            if (email !== undefined) {
                updates.push('email = ?');
                params.push(email);
            }
            if (location !== undefined) {
                updates.push('location = ?');
                params.push(location);
            }
            
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(userId);

            await db.run(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            await trackEvent('user_profile_updated', { user_id: userId });
        } else {
            // Create new user
            await db.run(
                'INSERT INTO users (id, name, email, location) VALUES (?, ?, ?, ?)',
                [userId, name || null, email || null, location || null]
            );

            await trackEvent('user_profile_created', { user_id: userId });
        }

        const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                location: updatedUser.location,
                created_at: updatedUser.created_at,
                updated_at: updatedUser.updated_at
            }
        });
    } catch (error) {
        console.error('Error managing user profile:', error);
        
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        res.status(500).json({ error: 'Failed to manage user profile' });
    }
});

// Get user profile
router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user statistics
        const [contributionStats, quizStats, interactionStats] = await Promise.all([
            db.get('SELECT COUNT(*) as total_contributions FROM contributions WHERE user_id = ?', [userId]),
            db.get('SELECT COUNT(*) as total_quizzes, AVG(score) as avg_score, MAX(score) as best_score FROM quiz_sessions WHERE user_id = ? AND completed = TRUE', [userId]),
            db.get('SELECT COUNT(*) as total_interactions FROM story_interactions WHERE user_id = ?', [userId])
        ]);

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                location: user.location,
                created_at: user.created_at,
                updated_at: user.updated_at
            },
            statistics: {
                contributions: contributionStats.total_contributions || 0,
                quizzes_completed: quizStats.total_quizzes || 0,
                average_quiz_score: Math.round(quizStats.avg_score || 0),
                best_quiz_score: quizStats.best_score || 0,
                story_interactions: interactionStats.total_interactions || 0
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Get user activity feed
router.get('/:userId/activity', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const offset = (page - 1) * limit;

        // Get recent activities
        const activities = await db.all(`
            SELECT 
                'contribution' as type,
                id,
                created_at,
                status,
                NULL as score
            FROM contributions 
            WHERE user_id = ?
            
            UNION ALL
            
            SELECT 
                'quiz' as type,
                id,
                completed_at as created_at,
                CASE WHEN completed = 1 THEN 'completed' ELSE 'in_progress' END as status,
                score
            FROM quiz_sessions 
            WHERE user_id = ? AND completed = 1
            
            UNION ALL
            
            SELECT 
                'interaction' as type,
                id,
                created_at,
                interaction_type as status,
                NULL as score
            FROM story_interactions 
            WHERE user_id = ?
            
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, userId, userId, parseInt(limit), offset]);

        const totalResult = await db.get(`
            SELECT COUNT(*) as total FROM (
                SELECT id FROM contributions WHERE user_id = ?
                UNION ALL
                SELECT id FROM quiz_sessions WHERE user_id = ? AND completed = 1
                UNION ALL
                SELECT id FROM story_interactions WHERE user_id = ?
            )
        `, [userId, userId, userId]);

        res.json({
            activities,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult.total,
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ error: 'Failed to fetch user activity' });
    }
});

// Get user achievements
router.get('/:userId/achievements', async (req, res) => {
    try {
        const { userId } = req.params;

        const [user, stats] = await Promise.all([
            db.get('SELECT * FROM users WHERE id = ?', [userId]),
            db.get(`
                SELECT 
                    COUNT(DISTINCT c.id) as contributions,
                    COUNT(DISTINCT q.id) as quizzes,
                    AVG(q.score) as avg_score,
                    MAX(q.score) as best_score,
                    COUNT(DISTINCT si.id) as interactions
                FROM users u
                LEFT JOIN contributions c ON u.id = c.user_id
                LEFT JOIN quiz_sessions q ON u.id = q.user_id AND q.completed = 1
                LEFT JOIN story_interactions si ON u.id = si.user_id
                WHERE u.id = ?
            `, [userId])
        ]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const achievements = [];

        // Story contributor achievements
        if (stats.contributions >= 1) {
            achievements.push({
                id: 'first_story',
                title: 'First Story Shared',
                description: 'Shared your first story with the community',
                icon: '📖',
                earned_at: user.created_at
            });
        }

        if (stats.contributions >= 5) {
            achievements.push({
                id: 'story_teller',
                title: 'Story Teller',
                description: 'Shared 5 stories with the community',
                icon: '📚',
                earned_at: user.created_at
            });
        }

        // Quiz achievements
        if (stats.quizzes >= 1) {
            achievements.push({
                id: 'quiz_starter',
                title: 'Quiz Starter',
                description: 'Completed your first disaster preparedness quiz',
                icon: '🎯',
                earned_at: user.created_at
            });
        }

        if (stats.best_score >= 25) {
            achievements.push({
                id: 'disaster_expert',
                title: 'Disaster Preparedness Expert',
                description: 'Scored 80% or higher on a quiz',
                icon: '🏆',
                earned_at: user.created_at
            });
        }

        if (stats.best_score === 30) {
            achievements.push({
                id: 'perfect_score',
                title: 'Perfect Score',
                description: 'Achieved a perfect score on a quiz',
                icon: '⭐',
                earned_at: user.created_at
            });
        }

        // Community engagement achievements
        if (stats.interactions >= 10) {
            achievements.push({
                id: 'community_member',
                title: 'Active Community Member',
                description: 'Engaged with 10 or more stories',
                icon: '👥',
                earned_at: user.created_at
            });
        }

        res.json({
            user_id: userId,
            total_achievements: achievements.length,
            achievements,
            progress: {
                next_achievements: getNextAchievements(stats)
            }
        });
    } catch (error) {
        console.error('Error fetching user achievements:', error);
        res.status(500).json({ error: 'Failed to fetch user achievements' });
    }
});

// Delete user account
router.delete('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { confirm } = req.body;

        if (!confirm) {
            return res.status(400).json({ error: 'Account deletion must be confirmed' });
        }

        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete user data (cascade delete)
        await Promise.all([
            db.run('DELETE FROM story_interactions WHERE user_id = ?', [userId]),
            db.run('DELETE FROM quiz_sessions WHERE user_id = ?', [userId]),
            db.run('DELETE FROM contributions WHERE user_id = ?', [userId]),
            db.run('DELETE FROM users WHERE id = ?', [userId])
        ]);

        await trackEvent('user_account_deleted', { user_id: userId });

        res.json({
            success: true,
            message: 'User account and all associated data have been deleted'
        });
    } catch (error) {
        console.error('Error deleting user account:', error);
        res.status(500).json({ error: 'Failed to delete user account' });
    }
});

function getNextAchievements(stats) {
    const next = [];

    if (stats.contributions < 5) {
        next.push({
            id: 'story_teller',
            title: 'Story Teller',
            description: 'Share 5 stories with the community',
            progress: stats.contributions,
            target: 5
        });
    }

    if (stats.quizzes < 1) {
        next.push({
            id: 'quiz_starter',
            title: 'Quiz Starter',
            description: 'Complete your first disaster preparedness quiz',
            progress: 0,
            target: 1
        });
    }

    if (stats.best_score < 25) {
        next.push({
            id: 'disaster_expert',
            title: 'Disaster Preparedness Expert',
            description: 'Score 80% or higher on a quiz',
            progress: Math.round((stats.best_score || 0) / 30 * 100),
            target: 80
        });
    }

    return next;
}

module.exports = router;