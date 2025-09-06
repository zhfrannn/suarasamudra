const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Track an analytics event
 * @param {string} eventType - Type of event (e.g., 'story_viewed', 'quiz_completed')
 * @param {object} eventData - Additional data about the event
 * @param {string} userId - User ID (optional)
 * @param {string} ipAddress - IP address (optional)
 * @param {string} userAgent - User agent string (optional)
 */
async function trackEvent(eventType, eventData = {}, userId = null, ipAddress = null, userAgent = null) {
    try {
        const eventId = uuidv4();
        
        await db.run(
            'INSERT INTO analytics (id, event_type, event_data, user_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
            [
                eventId,
                eventType,
                JSON.stringify(eventData),
                userId,
                ipAddress,
                userAgent
            ]
        );

        console.log(`📊 Event tracked: ${eventType}`, eventData);
    } catch (error) {
        console.error('Error tracking event:', error);
        // Don't throw error to avoid breaking the main functionality
    }
}

/**
 * Get analytics data for a specific time period
 * @param {string} eventType - Type of event to filter by (optional)
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of analytics records
 */
async function getAnalytics(eventType = null, days = 30) {
    try {
        let sql = 'SELECT * FROM analytics WHERE created_at >= date("now", "-" || ? || " days")';
        let params = [days];

        if (eventType) {
            sql += ' AND event_type = ?';
            params.push(eventType);
        }

        sql += ' ORDER BY created_at DESC';

        const results = await db.all(sql, params);
        
        return results.map(record => ({
            ...record,
            event_data: record.event_data ? JSON.parse(record.event_data) : {}
        }));
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return [];
    }
}

/**
 * Get event counts grouped by type
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of event type counts
 */
async function getEventCounts(days = 30) {
    try {
        const results = await db.all(`
            SELECT 
                event_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
            FROM analytics 
            WHERE created_at >= date('now', '-' || ? || ' days')
            GROUP BY event_type
            ORDER BY count DESC
        `, [days]);

        return results;
    } catch (error) {
        console.error('Error fetching event counts:', error);
        return [];
    }
}

/**
 * Get user activity summary
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} User activity summary
 */
async function getUserActivity(userId, days = 30) {
    try {
        const [totalEvents, eventTypes, recentActivity] = await Promise.all([
            db.get(`
                SELECT COUNT(*) as total
                FROM analytics 
                WHERE user_id = ? AND created_at >= date('now', '-' || ? || ' days')
            `, [userId, days]),
            
            db.all(`
                SELECT event_type, COUNT(*) as count
                FROM analytics 
                WHERE user_id = ? AND created_at >= date('now', '-' || ? || ' days')
                GROUP BY event_type
                ORDER BY count DESC
            `, [userId, days]),
            
            db.all(`
                SELECT event_type, event_data, created_at
                FROM analytics 
                WHERE user_id = ? AND created_at >= date('now', '-' || ? || ' days')
                ORDER BY created_at DESC
                LIMIT 10
            `, [userId, days])
        ]);

        return {
            total_events: totalEvents.total,
            event_types: eventTypes,
            recent_activity: recentActivity.map(record => ({
                ...record,
                event_data: record.event_data ? JSON.parse(record.event_data) : {}
            }))
        };
    } catch (error) {
        console.error('Error fetching user activity:', error);
        return {
            total_events: 0,
            event_types: [],
            recent_activity: []
        };
    }
}

/**
 * Clean up old analytics data
 * @param {number} days - Keep data newer than this many days
 */
async function cleanupOldData(days = 365) {
    try {
        const result = await db.run(`
            DELETE FROM analytics 
            WHERE created_at < date('now', '-' || ? || ' days')
        `, [days]);

        console.log(`🧹 Cleaned up ${result.changes} old analytics records`);
        return result.changes;
    } catch (error) {
        console.error('Error cleaning up analytics data:', error);
        return 0;
    }
}

module.exports = {
    trackEvent,
    getAnalytics,
    getEventCounts,
    getUserActivity,
    cleanupOldData
};