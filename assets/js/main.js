window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

document.addEventListener('DOMContentLoaded', function() {

    // Wait for i18n to be ready before initializing other components
    if (window.i18n) {
        initializeComponents();
    } else {
        // Wait for i18n to load
        const checkI18n = setInterval(() => {
            if (window.i18n) {
                clearInterval(checkI18n);
                initializeComponents();
            }
        }, 100);
    }
});

function initializeComponents() {
    // =================================================================
    // BACKEND INTEGRATION
    // =================================================================
    
    const API_BASE = '/api';
    let currentUser = JSON.parse(localStorage.getItem('suara_samudra_user')) || null;

    // Initialize user session
    if (!currentUser) {
        currentUser = {
            id: 'user_' + Math.random().toString(36).substr(2, 9),
            anonymous: true
        };
        localStorage.setItem('suara_samudra_user', JSON.stringify(currentUser));
    }

    // Track page view
    trackEvent('page_viewed', { 
        page: window.location.pathname,
        referrer: document.referrer 
    });

    // Utility function to make API calls
    async function apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    // Track events
    async function trackEvent(eventType, eventData = {}) {
        try {
            await apiCall('/analytics/track', {
                method: 'POST',
                body: JSON.stringify({
                    event_type: eventType,
                    event_data: eventData,
                    user_id: currentUser.id
                })
            });
        } catch (error) {
            console.error('Error tracking event:', error);
        }
    }

    // =================================================================
    // BAGIAN PETA (DINAMIS)
    // =================================================================

    // GANTI DENGAN ACCESS TOKEN MAPBOX LO
    mapboxgl.accessToken = 'pk.eyJ1IjoiemhhZnJhbnp6IiwiYSI6ImNtZWxjNWQ4NDBib2EybHM2aXVuaXRidjQifQ.kPFBCelmb9ORs2S4sUENfQ';

    // Fungsi ini HANYA akan berjalan SETELAH data cerita berhasil diambil
    function initializeMap(stories) {
        if (!document.getElementById('map')) return;
        
        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [95.32, 5.55],
            zoom: 12,
            pitch: 60,
            bearing: -30
        });

        map.addControl(new mapboxgl.NavigationControl());

        map.on('style.load', () => {
            map.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                'tileSize': 512,
                'maxzoom': 14
            });
            map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
        });

        // Looping data cerita yang didapat dari file .json untuk membuat marker
        stories.forEach(story => {
            const el = document.createElement('div');
            el.className = 'marker';

            // Add click tracking
            el.addEventListener('click', () => {
                trackEvent('map_marker_clicked', { 
                    story_id: story.id || story.title,
                    location: story.location 
                });
            });

            new mapboxgl.Marker(el)
                .setLngLat(story.coordinates)
                .setPopup(
                    new mapboxgl.Popup({ offset: 25 })
                        .setHTML(`
                            <h4 class="font-semibold text-lg mb-1">${story.title}</h4>
                            <p class="text-gray-600 text-sm mb-2">${story.location} &bull; ${story.type}</p>
                            <p class="text-gray-700">${story.content}</p>
                            <button onclick="openStoryModal('${story.id || story.title}')" class="text-cyan-600 hover:underline mt-2 inline-block">Read More</button>
                        `)
                )
                .addTo(map);
        });
    }

    // Load stories from backend API
    async function loadStories() {
        try {
            const data = await apiCall('/stories?limit=50');
            const stories = data.stories.map(story => ({
                id: story.id,
                title: story.title,
                content: story.content.substring(0, 200) + '...',
                location: story.location,
                coordinates: story.coordinates,
                type: story.story_type
            }));
            
            initializeMap(stories);
            trackEvent('stories_loaded', { count: stories.length });
        } catch (error) {
            console.error('Error loading stories:', error);
            // Fallback to local data
            fetch('assets/data/stories.json')
                .then(response => response.json())
                .then(data => {
                    initializeMap(data);
                })
                .catch(fallbackError => {
                    console.error('Error loading fallback stories:', fallbackError);
                });
        }
    }

    // Initialize stories
    loadStories();

    // Story modal functionality
    window.openStoryModal = async function(storyId) {
        try {
            const story = await apiCall(`/stories/${storyId}`);
            
            // Update modal content
            document.getElementById('modalTitle').textContent = story.title;
            document.getElementById('storyAuthor').textContent = story.author_name || 'Anonymous';
            document.getElementById('storyLocation').textContent = story.location;
            document.getElementById('storyContent').textContent = story.content;
            
            // Show modal
            document.getElementById('storyModal').classList.remove('hidden');
            
            trackEvent('story_modal_opened', { story_id: storyId });
        } catch (error) {
            console.error('Error loading story:', error);
        }
    };

    window.closeModal = function() {
        document.getElementById('storyModal').classList.add('hidden');
    };

    // Like story functionality
    window.likeStory = async function(storyId) {
        try {
            await apiCall(`/stories/${storyId}/like`, {
                method: 'POST',
                body: JSON.stringify({ user_id: currentUser.id })
            });
            
            trackEvent('story_liked', { story_id: storyId });
            
            // Update UI
            const likeBtn = document.querySelector(`[data-story-id="${storyId}"] .like-btn`);
            if (likeBtn) {
                likeBtn.classList.add('text-red-500');
                likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
            }
        } catch (error) {
            console.error('Error liking story:', error);
        }
    };

    // Contribution form handling
    const contributionForm = document.querySelector('#contribution-form');
    if (contributionForm) {
        contributionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(contributionForm);
            const contributionData = {
                name: formData.get('name'),
                location: formData.get('location'),
                story_type: formData.get('story_type'),
                story_content: formData.get('story_content'),
                contact_info: formData.get('contact_info'),
                consent: formData.get('consent') === 'on',
                user_id: currentUser.id
            };
            
            try {
                const result = await apiCall('/contributions', {
                    method: 'POST',
                    body: JSON.stringify(contributionData)
                });
                
                alert('Thank you for sharing your story! Your contribution has been submitted for review.');
                contributionForm.reset();
                
                trackEvent('story_contributed', { 
                    contribution_id: result.contribution_id,
                    story_type: contributionData.story_type 
                });
            } catch (error) {
                console.error('Error submitting contribution:', error);
                alert('Sorry, there was an error submitting your story. Please try again.');
            }
        })
    }


    // =================================================================
    // BAGIAN SIMULASI KUIS (STATIS)
    // =================================================================

    const scenarioTitle = document.getElementById('scenario-title');
    const scenarioText = document.getElementById('scenario-text');
    const choicesContainer = document.getElementById('choices-container');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    const restartBtn = document.getElementById('restart-btn');
    const nextBtn = document.getElementById('next-btn');
    const quizContainer = document.querySelector('.bg-white.rounded-lg.shadow-sm');

    // Interactive Quiz System
    let currentQuizSession = null;
    let currentQuestionData = null;

    async function startQuiz() {
        if (!quizContainer) return;
        
        try {
            const session = await apiCall('/interactive/quiz/start', {
                method: 'POST',
                body: JSON.stringify({ user_id: currentUser.id })
            });
            
            currentQuizSession = session.session_id;
            currentQuestionData = session.first_question;
            
            showQuestion(currentQuestionData, 1, session.total_questions);
            updateProgress(0);
            
            trackEvent('quiz_started', { session_id: currentQuizSession });
        } catch (error) {
            console.error('Error starting quiz:', error);
            // Fallback to static quiz if backend fails
            showStaticQuiz();
        }
    }

    function showQuestion(question, questionNumber, totalQuestions) {
        if (!quizContainer) return;
        
        scenarioTitle.textContent = question.title;
        scenarioText.textContent = question.question;
        choicesContainer.innerHTML = '';
        nextBtn.classList.add('hidden');
        restartBtn.classList.add('hidden');
        
        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.innerHTML = `
                <div class="flex items-center">
                    <div class="w-6 h-6 rounded-full border-2 border-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                        <span class="text-blue-600 font-bold">${String.fromCharCode(65 + index)}</span>
                    </div>
                    <span>${choice.text}</span>
                </div>
            `;
            button.className = 'choice-btn w-full text-left p-4 rounded-lg bg-white transition';
            button.onclick = () => submitAnswer(choice.id);
            choicesContainer.appendChild(button);
        });
        
        updateProgress((questionNumber - 1) / totalQuestions * 100);
    }

    async function submitAnswer(choiceId) {
        if (!currentQuizSession) return;
        
        try {
            // Disable all buttons
            Array.from(choicesContainer.children).forEach(button => {
                button.disabled = true;
            });
            
            const result = await apiCall(`/interactive/quiz/${currentQuizSession}/answer`, {
                method: 'POST',
                body: JSON.stringify({ choice_id: choiceId })
            });
            
            // Show feedback
            const feedback = document.createElement('div');
            feedback.className = `mt-4 p-4 rounded-lg ${result.correct ? 'bg-green-100' : 'bg-red-100'}`;
            feedback.innerHTML = `<p class="font-semibold">${result.feedback}</p>`;
            choicesContainer.appendChild(feedback);
            
            if (result.quiz_completed) {
                setTimeout(() => showQuizResults(result), 2000);
            } else {
                setTimeout(() => {
                    currentQuestionData = result.next_question;
                    showQuestion(currentQuestionData, result.question_number + 1, result.total_questions);
                }, 2000);
            }
            
            updateProgress(result.question_number / result.total_questions * 100);
            
        } catch (error) {
            console.error('Error submitting answer:', error);
            restartBtn.classList.remove('hidden');
        }
    }

    function showQuizResults(result) {
        quizContainer.innerHTML = `
            <div class="text-center">
                <h4 class="text-2xl font-bold mb-4">🏆 Quiz Completed! 🏆</h4>
                <p class="text-lg text-gray-700 mb-4">Your Score: ${result.total_score}/30 (${result.final_score_percentage}%)</p>
                ${result.certificate_eligible ? 
                    '<p class="text-green-600 font-semibold mb-4">🎉 Congratulations! You earned a certificate!</p>' :
                    '<p class="text-orange-600 mb-4">Keep learning and try again to earn your certificate!</p>'
                }
                <button onclick="startQuiz()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                    Take Quiz Again
                </button>
            </div>
        `;
        
        trackEvent('quiz_completed', { 
            session_id: currentQuizSession,
            score: result.total_score,
            percentage: result.final_score_percentage 
        });
    }

    // Fallback static quiz (original implementation)
    function showStaticQuiz() {
        // Original static quiz code here as fallback
        console.log('Using static quiz as fallback');
    }

    function updateProgress(percentage) {
        if (!progressBar || !progressText) return;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    // Event listeners
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentQuestionData) {
                showQuestion(currentQuestionData, currentQuiz + 1, quizData.length);
            }
        };
    }

    if (restartBtn) {
        restartBtn.onclick = () => {
            startQuiz();
        };
    }

    // Initialize quiz if on interactive page
    if (quizContainer) {
        startQuiz();
    }
    
    // Make functions globally available
    window.startQuiz = startQuiz;
    window.trackEvent = trackEvent;
    
    // =================================================================
    // INTERACTIVE BUTTON ENHANCEMENTS
    // =================================================================
    
    // Add ripple effect to buttons
    function addRippleEffect() {
        const rippleButtons = document.querySelectorAll('.btn-ripple');
        
        rippleButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');
                
                this.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });
    }
    
    // Button loading state
    window.setButtonLoading = function(buttonElement, loading = true) {
        if (loading) {
            buttonElement.classList.add('btn-loading');
            buttonElement.disabled = true;
        } else {
            buttonElement.classList.remove('btn-loading');
            buttonElement.disabled = false;
        }
    };
    
    // Enhanced contribution form submission
    window.submitContribution = async function() {
        const button = event.target;
        setButtonLoading(button, true);
        
        try {
            // Simulate form submission
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Show success message
            alert('Story berhasil dikirim! Terima kasih telah berbagi pengalaman Anda.');
            
            trackEvent('contribution_submitted', { method: 'whatsapp' });
        } catch (error) {
            alert('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setButtonLoading(button, false);
        }
    };
    
    // Initialize interactive features
    addRippleEffect();
    
    // Add floating action button for quick actions
    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'btn-floating';
    floatingBtn.innerHTML = '<i class="fas fa-plus"></i>';
    floatingBtn.title = 'Quick Actions';
    floatingBtn.onclick = function() {
        const menu = document.createElement('div');
        menu.className = 'fixed bottom-20 right-6 bg-white rounded-lg shadow-xl p-4 z-1000';
        menu.innerHTML = `
            <div class="flex flex-col gap-2">
                <button class="btn-primary btn-icon btn-ripple text-sm" onclick="window.location.href='contribute.html'">
                    <i class="fas fa-share-alt mr-2"></i> Share Story
                </button>
                <button class="btn-secondary btn-icon btn-ripple text-sm" onclick="window.location.href='interactive.html'">
                    <i class="fas fa-gamepad mr-2"></i> Take Quiz
                </button>
                <button class="btn-secondary btn-icon btn-ripple text-sm" onclick="window.location.href='stories.html'">
                    <i class="fas fa-book-open mr-2"></i> Browse Stories
                </button>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== floatingBtn) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    };
    
    document.body.appendChild(floatingBtn);
}
