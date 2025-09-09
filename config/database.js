const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            // Ensure data directory exists
            const dataDir = path.join(__dirname, '../data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log('📁 Created data directory');
            }
            
            this.db = new sqlite3.Database(path.join(__dirname, '../data/suara_samudra.db'), (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('📊 Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                email TEXT UNIQUE,
                location TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                author_name TEXT,
                location TEXT NOT NULL,
                coordinates TEXT,
                story_type TEXT NOT NULL,
                tags TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS contributions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                story_data TEXT NOT NULL,
                contact_info TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
            `CREATE TABLE IF NOT EXISTS quiz_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                quiz_type TEXT NOT NULL,
                current_question INTEGER DEFAULT 0,
                score INTEGER DEFAULT 0,
                answers TEXT,
                completed BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
            `CREATE TABLE IF NOT EXISTS story_interactions (
                id TEXT PRIMARY KEY,
                story_id TEXT NOT NULL,
                user_id TEXT,
                interaction_type TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
            `CREATE TABLE IF NOT EXISTS analytics (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                event_data TEXT,
                user_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        // Insert sample data if tables are empty
        await this.insertSampleData();
    }

    async insertSampleData() {
        const storyCount = await this.get('SELECT COUNT(*) as count FROM stories');
        
        if (storyCount.count === 0) {
            const sampleStories = [
                {
                    id: 'story-1',
                    title: 'The Wave That Changed Everything',
                    content: 'I was 12 years old when the water came. The sound still haunts me - like a thousand trains coming at once. My father recognized it immediately as the "Smong" our elders had warned about. He grabbed me and my siblings and we ran to the hills behind our house. We lost everything that day - our home, our photos, our school books. But what I remember most is how neighbors who had been fighting for years suddenly became family again. In the refugee camp, former enemies shared what little food they had. That\'s the lesson I carry with me - disaster doesn\'t care about politics or religion. When the wave comes, we\'re all just human beings trying to survive.',
                    author_name: 'Anonymous Survivor',
                    location: 'Banda Aceh',
                    coordinates: '[95.3213, 5.5539]',
                    story_type: 'Tsunami',
                    tags: 'tsunami,family,survival,smong,community',
                    status: 'approved'
                },
                {
                    id: 'story-2',
                    title: 'Rebuilding Our Village Together',
                    content: 'We had nothing left but each other. The gotong royong spirit is what saved us. Every morning, we would gather at what used to be the village center and decide what to rebuild first. The mosque, the school, or the houses? We chose the school because our children needed hope for the future.',
                    author_name: 'Village Elder',
                    location: 'Meulaboh',
                    coordinates: '[96.1264, 4.1458]',
                    story_type: 'Recovery',
                    tags: 'recovery,community,gotong-royong,education',
                    status: 'approved'
                },
                {
                    id: 'story-3',
                    title: 'From Conflict to Coffee Shop',
                    content: 'My warung kopi became a neutral ground. Former enemies now share tables and stories. Peace isn\'t just the absence of war - it\'s the presence of understanding. Every cup of coffee served is a small act of reconciliation.',
                    author_name: 'Coffee Shop Owner',
                    location: 'Lhokseumawe',
                    coordinates: '[97.1472, 5.1768]',
                    story_type: 'Peace',
                    tags: 'peace,reconciliation,community,coffee',
                    status: 'approved'
                },
                {
                    id: 'story-4',
                    title: 'Smong, The Whispering Sea',
                    content: 'Our elders taught us to recognize the signs. When the sea recedes unexpectedly, we run to the hills. This wisdom, passed down through generations, saved many lives. The Smong is not just a story - it\'s our survival guide.',
                    author_name: 'Traditional Elder',
                    location: 'Pulau Banyak',
                    coordinates: '[97.2372, 2.1158]',
                    story_type: 'Local Wisdom',
                    tags: 'smong,traditional-knowledge,tsunami,wisdom',
                    status: 'approved'
                },
                {
                    id: 'story-5',
                    title: 'Lessons from the Field: Flash Flood',
                    content: 'It was midnight when the flash flood came. Our neighbors helped us evacuate to a higher place. The community warning system we built after the tsunami worked perfectly. Technology and tradition working together.',
                    author_name: 'Community Leader',
                    location: 'Calang',
                    coordinates: '[95.9189, 4.5804]',
                    story_type: 'Tsunami',
                    tags: 'flash-flood,community,warning-system,technology',
                    status: 'approved'
                }
            ];

            for (const story of sampleStories) {
                await this.run(
                    'INSERT INTO stories (id, title, content, author_name, location, coordinates, story_type, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [story.id, story.title, story.content, story.author_name, story.location, story.coordinates, story.story_type, story.tags, story.status]
                );
            }

            console.log('✅ Sample stories inserted');
        }
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
                resolve();
            });
        });
    }
}

module.exports = new Database();