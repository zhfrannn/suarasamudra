const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { trackEvent } = require('../utils/analytics');

// Get all stories with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            type, 
            location, 
            search,
            sort = 'created_at',
            order = 'DESC'
        } = req.query;

        let sql = 'SELECT * FROM stories WHERE status = "approved"';
        let params = [];
        let countSql = 'SELECT COUNT(*) as total FROM stories WHERE status = "approved"';
        let countParams = [];

        // Add filters
        if (type) {
            sql += ' AND story_type = ?';
            params.push(type);
            countSql += ' AND story_type = ?';
            countParams.push(type);
        }

        if (location) {
            sql += ' AND location LIKE ?';
            params.push(`%${location}%`);
            countSql += ' AND location LIKE ?';
            countParams.push(`%${location}%`);
        }

        if (search) {
            sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            countSql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Add sorting
        const validSorts = ['created_at', 'views', 'likes', 'title'];
        const validOrders = ['ASC', 'DESC'];
        
        if (validSorts.includes(sort) && validOrders.includes(order.toUpperCase())) {
            sql += ` ORDER BY ${sort} ${order.toUpperCase()}`;
        }

        // Add pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [stories, totalResult] = await Promise.all([
            db.all(sql, params),
            db.get(countSql, countParams)
        ]);

        // Parse coordinates for each story
        const processedStories = stories.map(story => ({
            ...story,
            coordinates: story.coordinates ? JSON.parse(story.coordinates) : null,
            tags: story.tags ? story.tags.split(',') : []
        }));

        await trackEvent('stories_viewed', { 
            filters: { type, location, search },
            page,
            limit 
        });

        res.json({
            stories: processedStories,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult.total,
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching stories:', error);
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});

// Get single story by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const story = await db.get('SELECT * FROM stories WHERE id = ? AND status = "approved"', [id]);
        
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // Increment view count
        await db.run('UPDATE stories SET views = views + 1 WHERE id = ?', [id]);
        
        // Parse coordinates and tags
        const processedStory = {
            ...story,
            coordinates: story.coordinates ? JSON.parse(story.coordinates) : null,
            tags: story.tags ? story.tags.split(',') : [],
            views: story.views + 1
        };

        await trackEvent('story_viewed', { story_id: id });

        res.json(processedStory);
    } catch (error) {
        console.error('Error fetching story:', error);
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});

// Like a story
router.post('/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;

        // Check if story exists
        const story = await db.get('SELECT * FROM stories WHERE id = ? AND status = "approved"', [id]);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // Check if user already liked this story
        const existingLike = await db.get(
            'SELECT * FROM story_interactions WHERE story_id = ? AND user_id = ? AND interaction_type = "like"',
            [id, user_id || 'anonymous']
        );

        if (existingLike) {
            return res.status(400).json({ error: 'Story already liked' });
        }

        // Add like interaction
        await db.run(
            'INSERT INTO story_interactions (id, story_id, user_id, interaction_type) VALUES (?, ?, ?, ?)',
            [uuidv4(), id, user_id || 'anonymous', 'like']
        );

        // Increment like count
        await db.run('UPDATE stories SET likes = likes + 1 WHERE id = ?', [id]);

        const updatedStory = await db.get('SELECT likes FROM stories WHERE id = ?', [id]);

        await trackEvent('story_liked', { story_id: id, user_id });

        res.json({ 
            success: true, 
            likes: updatedStory.likes,
            message: 'Story liked successfully' 
        });
    } catch (error) {
        console.error('Error liking story:', error);
        res.status(500).json({ error: 'Failed to like story' });
    }
});

// Get story statistics
router.get('/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        const [story, interactions] = await Promise.all([
            db.get('SELECT views, likes FROM stories WHERE id = ? AND status = "approved"', [id]),
            db.all('SELECT interaction_type, COUNT(*) as count FROM story_interactions WHERE story_id = ? GROUP BY interaction_type', [id])
        ]);

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        const stats = {
            views: story.views,
            likes: story.likes,
            interactions: interactions.reduce((acc, item) => {
                acc[item.interaction_type] = item.count;
                return acc;
            }, {})
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching story stats:', error);
        res.status(500).json({ error: 'Failed to fetch story statistics' });
    }
});

// Get related stories
router.get('/:id/related', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 3;

        const currentStory = await db.get('SELECT story_type, tags, location FROM stories WHERE id = ?', [id]);
        
        if (!currentStory) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // Find related stories based on type, location, or tags
        let sql = `
            SELECT id, title, author_name, location, story_type, tags, views, likes, created_at
            FROM stories 
            WHERE id != ? AND status = "approved" AND (
                story_type = ? OR 
                location = ? OR 
                tags LIKE ?
            )
            ORDER BY 
                CASE 
                    WHEN story_type = ? THEN 3
                    WHEN location = ? THEN 2
                    ELSE 1
                END DESC,
                views DESC
            LIMIT ?
        `;

        const tagPattern = currentStory.tags ? `%${currentStory.tags.split(',')[0]}%` : '%';
        
        const relatedStories = await db.all(sql, [
            id, 
            currentStory.story_type, 
            currentStory.location, 
            tagPattern,
            currentStory.story_type,
            currentStory.location,
            limit
        ]);

        const processedStories = relatedStories.map(story => ({
            ...story,
            tags: story.tags ? story.tags.split(',') : []
        }));

        res.json(processedStories);
    } catch (error) {
        console.error('Error fetching related stories:', error);
        res.status(500).json({ error: 'Failed to fetch related stories' });
    }
});

// Get story types and locations for filters
router.get('/meta/filters', async (req, res) => {
    try {
        const [types, locations] = await Promise.all([
            db.all('SELECT DISTINCT story_type as value, COUNT(*) as count FROM stories WHERE status = "approved" GROUP BY story_type ORDER BY count DESC'),
            db.all('SELECT DISTINCT location as value, COUNT(*) as count FROM stories WHERE status = "approved" GROUP BY location ORDER BY count DESC')
        ]);

        res.json({
            types,
            locations
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({ error: 'Failed to fetch filter options' });
    }
});

module.exports = router;