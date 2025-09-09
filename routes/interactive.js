const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { trackEvent } = require('../utils/analytics');

// Quiz data
const quizData = [
    {
        id: 'scenario-1',
        title: "Scenario 1: Flash Flood at Midnight",
        question: "Based on true events from Calang, 2004. It's 2 AM and heavy rain has been falling for hours. You hear shouting outside and the sound of rushing water. What do you do first?",
        choices: [
            { 
                id: 'a', 
                text: "Wake up family members and tell them to go to the evacuation point.", 
                correct: true, 
                feedback: "✅**Feedback AI:** Jawaban tepat! Tindakan paling krusial adalah evakuasi segera ke tempat aman. Selamatkan diri, bukan harta. 👍",
                points: 10
            },
            { 
                id: 'b', 
                text: "Check social media to see what others are saying about the situation.", 
                correct: false, 
                feedback: "🚨**Feedback AI:** Pilihan ini berbahaya! Menunda evakuasi untuk mengecek media sosial bisa berakibat fatal. Ikuti naluri dan dengarkan peringatan di luar. ⚠️",
                points: 0
            },
            { 
                id: 'c', 
                text: "Go back to sleep, assuming the water won't reach your house.", 
                correct: false, 
                feedback: "🚨**Feedback AI:** Sangat berbahaya! Jangan pernah meremehkan peringatan bencana. Setiap detik berharga. ⚠️",
                points: 0
            }
        ]
    },
    {
        id: 'scenario-2',
        title: "Scenario 2: Post-Disaster Hoax",
        question: "Satu hari setelah gempa, sebuah pesan berantai tersebar di WhatsApp yang mengklaim akan ada gempa susulan tsunami yang lebih besar. Warga panik. Apa yang harus kamu lakukan?",
        choices: [
            { 
                id: 'a', 
                text: "Langsung menyebarkan pesan itu ke grup lain untuk memperingati semua orang.", 
                correct: false, 
                feedback: "🚨**Feedback AI:** Hati-hati! Menyebarkan informasi yang belum diverifikasi bisa menimbulkan kepanikan massal. ⚠️",
                points: 0
            },
            { 
                id: 'b', 
                text: "Tenang, dan verifikasi informasi tersebut dari sumber resmi seperti BMKG atau BPBD sebelum bertindak.", 
                correct: true, 
                feedback: "✅**Feedback AI:** Jawaban tepat! Verifikasi informasi dari sumber kredibel adalah kunci untuk melawan misinformasi. Kamu adalah agen komunikasi yang tangguh. 👍",
                points: 10
            },
            { 
                id: 'c', 
                text: "Mengabaikan pesan itu sepenuhnya, karena kamu tidak percaya isinya.", 
                correct: false, 
                feedback: "🚨**Feedback AI:** Mengabaikan pesan bisa jadi berbahaya jika ternyata benar. Verifikasi adalah langkah yang paling bijak. ⚠️",
                points: 0
            }
        ]
    },
    {
        id: 'scenario-3',
        title: "Scenario 3: Community Recovery",
        question: "Setelah bencana, komunitasmu memulai fase pemulihan. Banyak warga merasa trauma dan putus asa. Sebagai pemuda, bagaimana kamu bisa berkontribusi?",
        choices: [
            { 
                id: 'a', 
                text: "Menunggu bantuan datang dan tidak melakukan apa-apa.", 
                correct: false, 
                feedback: "🚨**Feedback AI:** Pemulihan membutuhkan partisipasi aktif. Setiap orang punya peran penting, sekecil apa pun. ⚠️",
                points: 0
            },
            { 
                id: 'b', 
                text: "Mengajak teman-temanmu untuk mengadakan kegiatan gotong royong dan mendengarkan cerita para penyintas untuk saling menguatkan.", 
                correct: true, 
                feedback: "✅**Feedback AI:** Jawaban tepat! Gotong royong dan dukungan psikososial adalah fondasi kuat untuk membangun kembali komunitas. Kamu telah menunjukkan empati dan inisiatif. 👍",
                points: 10
            },
            { 
                id: 'c', 
                text: "Mencari keuntungan pribadi dari situasi yang ada.", 
                correct: false, 
                feedback: "🚨**Feedback AI:** Sikap ini sangat tidak etis dan bisa merusak kepercayaan di komunitas. Pemulihan adalah tentang kolaborasi, bukan persaingan. ⚠️",
                points: 0
            }
        ]
    }
];

// Start a new quiz session
router.post('/quiz/start', async (req, res) => {
    try {
        const { user_id, quiz_type = 'disaster-preparedness' } = req.body;
        
        const sessionId = uuidv4();
        
        await db.run(
            'INSERT INTO quiz_sessions (id, user_id, quiz_type, current_question, score, answers) VALUES (?, ?, ?, ?, ?, ?)',
            [sessionId, user_id || 'anonymous', quiz_type, 0, 0, JSON.stringify([])]
        );

        await trackEvent('quiz_started', { 
            session_id: sessionId,
            quiz_type,
            user_id 
        });

        res.json({
            session_id: sessionId,
            quiz_type,
            total_questions: quizData.length,
            current_question: 0,
            first_question: quizData[0]
        });
    } catch (error) {
        console.error('Error starting quiz:', error);
        res.status(500).json({ error: 'Failed to start quiz session' });
    }
});

// Get current quiz question
router.get('/quiz/:sessionId/question', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await db.get(
            'SELECT * FROM quiz_sessions WHERE id = ? AND completed = FALSE',
            [sessionId]
        );

        if (!session) {
            return res.status(404).json({ error: 'Quiz session not found or already completed' });
        }

        if (session.current_question >= quizData.length) {
            return res.status(400).json({ error: 'Quiz already completed' });
        }

        const currentQuestion = quizData[session.current_question];
        
        res.json({
            session_id: sessionId,
            question_number: session.current_question + 1,
            total_questions: quizData.length,
            current_score: session.score,
            question: {
                id: currentQuestion.id,
                title: currentQuestion.title,
                question: currentQuestion.question,
                choices: currentQuestion.choices.map(choice => ({
                    id: choice.id,
                    text: choice.text
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching quiz question:', error);
        res.status(500).json({ error: 'Failed to fetch quiz question' });
    }
});

// Submit quiz answer
router.post('/quiz/:sessionId/answer', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { choice_id } = req.body;

        if (!choice_id) {
            return res.status(400).json({ error: 'Choice ID is required' });
        }

        const session = await db.get(
            'SELECT * FROM quiz_sessions WHERE id = ? AND completed = FALSE',
            [sessionId]
        );

        if (!session) {
            return res.status(404).json({ error: 'Quiz session not found or already completed' });
        }

        if (session.current_question >= quizData.length) {
            return res.status(400).json({ error: 'Quiz already completed' });
        }

        const currentQuestion = quizData[session.current_question];
        const selectedChoice = currentQuestion.choices.find(choice => choice.id === choice_id);

        if (!selectedChoice) {
            return res.status(400).json({ error: 'Invalid choice ID' });
        }

        // Update session with answer
        const answers = JSON.parse(session.answers);
        answers.push({
            question_id: currentQuestion.id,
            choice_id: choice_id,
            correct: selectedChoice.correct,
            points: selectedChoice.points
        });

        const newScore = session.score + selectedChoice.points;
        const nextQuestion = session.current_question + 1;
        const isCompleted = nextQuestion >= quizData.length;

        await db.run(
            'UPDATE quiz_sessions SET current_question = ?, score = ?, answers = ?, completed = ?, completed_at = ? WHERE id = ?',
            [
                nextQuestion, 
                newScore, 
                JSON.stringify(answers), 
                isCompleted,
                isCompleted ? new Date().toISOString() : null,
                sessionId
            ]
        );

        await trackEvent('quiz_answer_submitted', { 
            session_id: sessionId,
            question_id: currentQuestion.id,
            choice_id,
            correct: selectedChoice.correct,
            user_id: session.user_id
        });

        const response = {
            correct: selectedChoice.correct,
            feedback: selectedChoice.feedback,
            points_earned: selectedChoice.points,
            total_score: newScore,
            question_number: session.current_question + 1,
            total_questions: quizData.length
        };

        if (isCompleted) {
            const finalScore = Math.round((newScore / (quizData.length * 10)) * 100);
            response.quiz_completed = true;
            response.final_score_percentage = finalScore;
            response.certificate_eligible = finalScore >= 70;
            
            await trackEvent('quiz_completed', { 
                session_id: sessionId,
                final_score: newScore,
                percentage: finalScore,
                user_id: session.user_id
            });
        } else {
            response.next_question = quizData[nextQuestion];
        }

        res.json(response);
    } catch (error) {
        console.error('Error submitting quiz answer:', error);
        res.status(500).json({ error: 'Failed to submit quiz answer' });
    }
});

// Get quiz results
router.get('/quiz/:sessionId/results', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await db.get(
            'SELECT * FROM quiz_sessions WHERE id = ?',
            [sessionId]
        );

        if (!session) {
            return res.status(404).json({ error: 'Quiz session not found' });
        }

        const answers = JSON.parse(session.answers);
        const totalPossibleScore = quizData.length * 10;
        const percentage = Math.round((session.score / totalPossibleScore) * 100);

        const detailedResults = answers.map((answer, index) => {
            const question = quizData.find(q => q.id === answer.question_id);
            const choice = question.choices.find(c => c.id === answer.choice_id);
            
            return {
                question_number: index + 1,
                question_title: question.title,
                question_text: question.question,
                selected_choice: choice.text,
                correct: answer.correct,
                points_earned: answer.points,
                feedback: choice.feedback
            };
        });

        res.json({
            session_id: sessionId,
            completed: session.completed,
            completed_at: session.completed_at,
            total_score: session.score,
            total_possible_score: totalPossibleScore,
            percentage,
            certificate_eligible: percentage >= 70,
            detailed_results: detailedResults,
            recommendations: getRecommendations(percentage, answers)
        });
    } catch (error) {
        console.error('Error fetching quiz results:', error);
        res.status(500).json({ error: 'Failed to fetch quiz results' });
    }
});

// Get quiz leaderboard
router.get('/quiz/leaderboard', async (req, res) => {
    try {
        const { limit = 10, timeframe = 'all' } = req.query;

        let timeFilter = '';
        if (timeframe === 'week') {
            timeFilter = "AND created_at >= date('now', '-7 days')";
        } else if (timeframe === 'month') {
            timeFilter = "AND created_at >= date('now', '-30 days')";
        }

        const leaderboard = await db.all(`
            SELECT 
                user_id,
                MAX(score) as best_score,
                COUNT(*) as attempts,
                MAX(completed_at) as last_completed
            FROM quiz_sessions 
            WHERE completed = TRUE ${timeFilter}
            GROUP BY user_id
            ORDER BY best_score DESC, last_completed ASC
            LIMIT ?
        `, [parseInt(limit)]);

        const processedLeaderboard = leaderboard.map((entry, index) => ({
            rank: index + 1,
            user_id: entry.user_id === 'anonymous' ? 'Anonymous User' : entry.user_id,
            best_score: entry.best_score,
            percentage: Math.round((entry.best_score / 30) * 100),
            attempts: entry.attempts,
            last_completed: entry.last_completed
        }));

        res.json({
            timeframe,
            leaderboard: processedLeaderboard,
            total_participants: leaderboard.length
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Get interactive content recommendations
router.get('/recommendations', async (req, res) => {
    try {
        const { user_id, story_type, location } = req.query;

        // Get user's quiz performance if available
        let userPerformance = null;
        if (user_id && user_id !== 'anonymous') {
            userPerformance = await db.get(`
                SELECT AVG(score) as avg_score, COUNT(*) as quiz_count
                FROM quiz_sessions 
                WHERE user_id = ? AND completed = TRUE
            `, [user_id]);
        }

        // Base recommendations
        const recommendations = [
            {
                type: 'quiz',
                title: 'Disaster Preparedness Quiz',
                description: 'Test your knowledge about disaster preparedness and response',
                difficulty: 'beginner',
                estimated_time: '10 minutes',
                action_url: '/api/interactive/quiz/start'
            },
            {
                type: 'story',
                title: 'Related Stories',
                description: 'Explore stories similar to your interests',
                action_url: `/api/stories?type=${story_type || ''}&location=${location || ''}`
            },
            {
                type: 'educational',
                title: 'Smong: Traditional Tsunami Warning',
                description: 'Learn about Aceh\'s traditional early warning system',
                difficulty: 'beginner',
                estimated_time: '5 minutes'
            }
        ];

        // Customize based on user performance
        if (userPerformance && userPerformance.avg_score > 20) {
            recommendations.push({
                type: 'advanced_quiz',
                title: 'Advanced Disaster Response Scenarios',
                description: 'Challenge yourself with complex disaster response situations',
                difficulty: 'advanced',
                estimated_time: '15 minutes'
            });
        }

        res.json({
            recommendations,
            user_performance: userPerformance
        });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

function getRecommendations(percentage, answers) {
    const recommendations = [];

    if (percentage < 50) {
        recommendations.push({
            type: 'study',
            title: 'Review Disaster Preparedness Basics',
            description: 'Focus on fundamental disaster preparedness concepts'
        });
    }

    if (percentage >= 70) {
        recommendations.push({
            type: 'advanced',
            title: 'Advanced Scenarios',
            description: 'Try more complex disaster response scenarios'
        });
    }

    // Check specific weak areas
    const wrongAnswers = answers.filter(a => !a.correct);
    if (wrongAnswers.length > 0) {
        recommendations.push({
            type: 'targeted_learning',
            title: 'Focus Areas',
            description: 'Review topics where you need improvement',
            topics: wrongAnswers.map(a => a.question_id)
        });
    }

    return recommendations;
}

module.exports = router;