 document.addEventListener('DOMContentLoaded', function() {

    // GANTI DENGAN ACCESS TOKEN MAPBOX LO
    mapboxgl.accessToken = 'pk.eyJ1IjoiemhhZnJhbnp6IiwiYSI6ImNtZWxjNWQ4NDBib2EybHM2aXVuaXRidjQifQ.kPFBCelmb9ORs2S4sUENfQ';

    // Fungsi untuk menginisialisasi peta dengan data cerita
    function initializeMap(stories) {
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

        stories.forEach(story => {
            const el = document.createElement('div');
            el.className = 'marker';

            new mapboxgl.Marker(el)
                .setLngLat(story.coordinates)
                .setPopup(
                    new mapboxgl.Popup({ offset: 25 })
                        .setHTML(`
                            <h4 class="font-semibold text-lg mb-1">${story.title}</h4>
                            <p class="text-gray-600 text-sm mb-2">${story.location} &bull; ${story.type}</p>
                            <p class="text-gray-700">${story.content}</p>
                            <a href="#stories" class="text-cyan-600 hover:underline mt-2 inline-block">Read More</a>
                        `)
                )
                .addTo(map);
        });
    }

    // --- INI BAGIAN UTAMANYA ---
    // Mengambil data cerita dari file JSON
    fetch('assets/data/stories.json')
        .then(response => response.json()) // Mengubah data mentah menjadi objek JavaScript
        .then(data => {
            // Setelah data berhasil didapat, panggil fungsi untuk menampilkan peta
            initializeMap(data);
        })
        .catch(error => console.error('Error memuat data cerita:', error)); // Menampilkan error jika gagal

    // ... (Kode untuk Simulasi Kuis Interaktif diletakkan di sini, di luar fetch) ...
    const scenarioTitle = document.getElementById('scenario-title');
    // dst...

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
        
        const stories = fetch

        stories.forEach(story => {
            const el = document.createElement('div');
            el.className = 'marker';

            new mapboxgl.Marker(el)
                .setLngLat(story.coordinates)
                .setPopup(
                    new mapboxgl.Popup({ offset: 25 })
                        .setHTML(`
                            <h4 class="font-semibold text-lg mb-1">${story.title}</h4>
                            <p class="text-gray-600 text-sm mb-2">${story.location} &bull; ${story.type}</p>
                            <p class="text-gray-700">${story.content}</p>
                            <a href="#stories" class="text-cyan-600 hover:underline mt-2 inline-block">Read More</a>
                        `)
                )
                .addTo(map);
        });

        // Simulasi Kuis Interaktif
        const scenarioTitle = document.getElementById('scenario-title');
        const scenarioText = document.getElementById('scenario-text');
        const choicesContainer = document.getElementById('choices-container');
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');
        const restartBtn = document.getElementById('restart-btn');
        const nextBtn = document.getElementById('next-btn');
        const quizContainer = document.querySelector('.bg-white.rounded-lg.shadow-sm');

        const quizData = [
            {
                title: "Scenario 1: Flash Flood at Midnight",
                question: "Based on true events from Calang, 2004. It's 2 AM and heavy rain has been falling for hours. You hear shouting outside and the sound of rushing water. What do you do first?",
                choices: [
                    { text: "Wake up family members and tell them to go to the evacuation point.", correct: true, feedback: "✅**Feedback AI:** Jawaban tepat! Tindakan paling krusial adalah evakuasi segera ke tempat aman. Selamatkan diri, bukan harta. 👍" },
                    { text: "Check social media to see what others are saying about the situation.", correct: false, feedback: "🚨**Feedback AI:** Pilihan ini berbahaya! Menunda evakuasi untuk mengecek media sosial bisa berakibat fatal. Ikuti naluri dan dengarkan peringatan di luar. ⚠️" },
                    { text: "Go back to sleep, assuming the water won't reach your house.", correct: false, feedback: "🚨**Feedback AI:** Sangat berbahaya! Jangan pernah meremehkan peringatan bencana. Setiap detik berharga. ⚠️" }
                ]
            },
            {
                title: "Scenario 2: Post-Disaster Hoax",
                question: "Satu hari setelah gempa, sebuah pesan berantai tersebar di WhatsApp yang mengklaim akan ada gempa susulan tsunami yang lebih besar. Warga panik. Apa yang harus kamu lakukan?",
                choices: [
                    { text: "Langsung menyebarkan pesan itu ke grup lain untuk memperingati semua orang.", correct: false, feedback: "🚨**Feedback AI:** Hati-hati! Menyebarkan informasi yang belum diverifikasi bisa menimbulkan kepanikan massal. ⚠️" },
                    { text: "Tenang, dan verifikasi informasi tersebut dari sumber resmi seperti BMKG atau BPBD sebelum bertindak.", correct: true, feedback: "✅**Feedback AI:** Jawaban tepat! Verifikasi informasi dari sumber kredibel adalah kunci untuk melawan misinformasi. Kamu adalah agen komunikasi yang tangguh. 👍" },
                    { text: "Mengabaikan pesan itu sepenuhnya, karena kamu tidak percaya isinya.", correct: false, feedback: "🚨**Feedback AI:** Mengabaikan pesan bisa jadi berbahaya jika ternyata benar. Verifikasi adalah langkah yang paling bijak. ⚠️" }
                ]
            },
            {
                title: "Scenario 3: Community Recovery",
                question: "Setelah bencana, komunitasmu memulai fase pemulihan. Banyak warga merasa trauma dan putus asa. Sebagai pemuda, bagaimana kamu bisa berkontribusi?",
                choices: [
                    { text: "Menunggu bantuan datang dan tidak melakukan apa-apa.", correct: false, feedback: "🚨**Feedback AI:** Pemulihan membutuhkan partisipasi aktif. Setiap orang punya peran penting, sekecil apa pun. ⚠️" },
                    { text: "Mengajak teman-temanmu untuk mengadakan kegiatan gotong royong dan mendengarkan cerita para penyintas untuk saling menguatkan.", correct: true, feedback: "✅**Feedback AI:** Jawaban tepat! Gotong royong dan dukungan psikososial adalah fondasi kuat untuk membangun kembali komunitas. Kamu telah menunjukkan empati dan inisiatif. 👍" },
                    { text: "Mencari keuntungan pribadi dari situasi yang ada.", correct: false, feedback: "🚨**Feedback AI:** Sikap ini sangat tidak etis dan bisa merusak kepercayaan di komunitas. Pemulihan adalah tentang kolaborasi, bukan persaingan. ⚠️" }
                ]
            }
        ];

        let currentQuiz = 0;

        function showQuiz() {
            if (currentQuiz < quizData.length) {
                const quiz = quizData[currentQuiz];
                scenarioTitle.textContent = quiz.title;
                scenarioText.textContent = quiz.question;
                choicesContainer.innerHTML = '';
                nextBtn.classList.add('hidden');
                restartBtn.classList.add('hidden');
                quizContainer.style.opacity = 1;

                quiz.choices.forEach(choice => {
                    const button = document.createElement('button');
                    button.innerHTML = `
                        <div class="flex items-center">
                            <div class="w-6 h-6 rounded-full border-2 border-blue-600 flex items-center justify-center mr-3">
                                <span class="text-blue-600 font-bold">${String.fromCharCode(65 + quiz.choices.indexOf(choice))}</span>
                            </div>
                            <span>${choice.text}</span>
                        </div>
                    `;
                    button.className = 'choice-btn w-full text-left p-4 rounded-lg bg-white transition';
                    button.onclick = () => selectAnswer(choice);
                    choicesContainer.appendChild(button);
                });
            } else {
                quizContainer.innerHTML = `
                    <div class="text-center">
                        <h4 class="text-2xl font-bold mb-4">🏆 Simulasi Selesai! 🏆</h4>
                        <p class="text-lg text-gray-700">Kamu berhasil melewati semua skenario dan menunjukkan resiliensi yang luar biasa.</p>
                        <p class="text-sm mt-4">Sekarang kamu adalah agen perubahan dan fasilitator tangguh bencana.</p>
                    </div>
                `;
                restartBtn.classList.remove('hidden');
                updateProgress(100);
            }
        }

        function selectAnswer(choice) {
            Array.from(choicesContainer.children).forEach(button => {
                button.disabled = true;
            });
            const feedback = document.createElement('div');
            feedback.className = `mt-4 p-4 rounded-lg ${choice.correct ? 'bg-green-100' : 'bg-red-100'}`;
            feedback.innerHTML = `<p class="font-semibold">${choice.feedback}</p>`;
            choicesContainer.appendChild(feedback);

            if (choice.correct) {
                nextBtn.classList.remove('hidden');
                updateProgress(Math.min(100, (currentQuiz + 1) / quizData.length * 100));
            } else {
                restartBtn.classList.remove('hidden');
            }
        }

        function updateProgress(percentage) {
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = `${Math.round(percentage)}%`;
        }

        nextBtn.onclick = () => {
            currentQuiz++;
            showQuiz();
        };

        restartBtn.onclick = () => {
            currentQuiz = 0;
            updateProgress(0);
            showQuiz();
        };

        // Mulai simulasi saat halaman dimuat
        showQuiz();
    });
