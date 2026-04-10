    // dynamic auth check to prevent stale state
    const getAuthData = () => {
        const token = localStorage.getItem('authToken');
        return {
            token: token,
            isLoggedIn: Boolean(token),
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };
    };
    
    // Elements for AI mood detection
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('captureBtn');
    const countdown = document.getElementById('countdown');
    const result = document.getElementById('result');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    canvas.width = 640;
    canvas.height = 480;
    
    // Elements for manual mood selection
    const moodOptions = document.querySelectorAll('.mood-option');
    const saveManualMoodBtn = document.getElementById('save-manual-mood-btn');
    const moodNotes = document.getElementById('mood-notes');
    
    // Variables for tracking selected mood
    let selectedMood = null;
    let mediaStream = null;
    
    // Mood data for the chart
    let moodHistory = [];
    let moodChart = null;
    let filteredMoodHistory = [];
    
    // Emoji map for moods
    const moodEmojis = {
        'Angry': '😠',
        'Disgust': '🤢',
        'Fear': '😨',
        'Happy': '😄',
        'Neutral': '😐',
        'Sad': '😢',
        'Surprise': '😲'
    };
    
    // API Configuration - will be loaded from server
    let apiConfig = {
        backendApiUrl: window.ENV_API_URL || 'http://localhost:5001', // Default fallback
        mlServiceUrl: 'http://localhost:5000/predict_emotion' // Default fallback
    };
    
    // Initialize the page
    initializePage();
    
    // Set up mood options selection
    moodOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove selected class from all options
            moodOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            this.classList.add('selected');
            
            // Update selected mood
            selectedMood = {
                value: parseInt(this.getAttribute('data-mood')),
                label: this.getAttribute('data-label')
            };
        });
    });
    
    // Save manual mood button click handler
    saveManualMoodBtn.addEventListener('click', function() {
        const auth = getAuthData();
        if (!auth.isLoggedIn) {
            if (typeof window.requireAuth === 'function') {
                window.requireAuth('Login to save your mood.');
            } else {
                alert('Please login to save your mood.');
            }
            return;
        }

        if (!selectedMood) {
            showWarning('Please select a mood before saving.');
            return;
        }
        
        const notes = moodNotes.value;
        saveManualMood(selectedMood.value, selectedMood.label, notes);
    });
    
    // Capture mood with AI button click handler
    captureBtn.addEventListener('click', function() {
        const auth = getAuthData();
        console.log('Capture button clicked. Auth state:', auth.isLoggedIn);
        
        if (!auth.isLoggedIn) {
            if (typeof window.requireAuth === 'function') {
                window.requireAuth('Login to use AI mood detection.');
            } else {
                alert('Please login to use AI mood detection.');
            }
            return;
        }

        startMoodCapture();
    });
    
    // Function to initialize the page
    async function initializePage() {
        const auth = getAuthData();
        console.log('Initializing mood page. Auth:', auth.isLoggedIn);
        
        // Load API configuration from frontend environment config
        loadApiConfig();

        // Initialize chart safely
        try {
            initMoodChart();
        } catch (e) {
            console.error('Chart initialization failed:', e);
        }

        if (!auth.isLoggedIn) {
            showGuestMoodState();
            return;
        }
        
        // Check recent mood items
        checkRecentMood();
        loadMoodHistory();
    }

    function showGuestMoodState() {
        if (result) {
            result.innerHTML = '<div class="result-content">Login to capture and save your mood entries.</div>';
        }

        const historyList = document.getElementById('historyList');
        if (historyList) {
            historyList.innerHTML = '<p class="empty-history">Login to view your mood history.</p>';
        }

        const recommendationContent = document.getElementById('recommendation-content');
        if (recommendationContent) {
            recommendationContent.innerHTML = '<p style="color:#888;">Login to get personalized recommendations based on your mood.</p>';
        }
    }
    
    // Function to load API configuration from frontend environment config
    function loadApiConfig() {
        if (window.ENV_CONFIG) {
            apiConfig.backendApiUrl = window.ENV_CONFIG.backendApiUrl;
            apiConfig.mlServiceUrl = window.ENV_CONFIG.mlServiceUrl;
            console.log('API configuration loaded from environment:', apiConfig);
        } else {
            console.warn('Environment config not available, using defaults:', apiConfig);
        }
    }
    
    // Function to check if user has recently tracked their mood
    async function checkRecentMood() {
        if (!isLoggedIn) {
            return;
        }

        try {
            const apiUrl = `${apiConfig.backendApiUrl}/api/mood/recent`;
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers
            });
            
            const data = await response.json();
            
            if (data.success && data.isRecent) {
                // User has tracked mood within the last 2 hours
                updateMoodTrackerButton(data.data);
            }
        } catch (error) {
            console.error('Error checking recent mood:', error);
        }
    }
    
    // Function to update the mood tracker button with current mood
    function updateMoodTrackerButton(moodData) {
        const moodTrackerBtn = document.getElementById('mood-tracker-btn');
        const emoji = moodEmojis[moodData.label] || '📊';
        // Only change content, not size
        moodTrackerBtn.innerHTML = `
            <span class="mood-emoji">${emoji}</span> Mood: <strong>${moodData.label}</strong>
        `;
        moodTrackerBtn.classList.add('current-mood');
    }
    
    // Function to load mood history from the server
    async function loadMoodHistory() {
        if (!isLoggedIn) {
            return;
        }

        try {
            const apiUrl = `${apiConfig.backendApiUrl}/api/mood?limit=30`;
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers
            });
            
            const data = await response.json();
            
            if (data.success) {
                moodHistory = data.data;
                // Set max date to today but don't auto-select
                if (historyDateFilter) {
                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];
                    historyDateFilter.max = todayStr;
                    // Don't auto-set the value - leave it empty by default
                }
                filterMoodHistoryByDate();
            }
        } catch (error) {
            console.error('Error loading mood history:', error);
            showError('Failed to load mood history. Please try again later.');
        }
    }
    
    // Date filter for mood history
    const historyDateFilter = document.getElementById('history-date-filter');
    
    // Set max date for filter to today but don't auto-select a date
    if (historyDateFilter) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        historyDateFilter.max = todayStr;
        // Leave value empty by default - don't auto-set to today
        historyDateFilter.addEventListener('change', function() {
            filterMoodHistoryByDate();
        });
    }
    
    // Filter mood history by selected date (last 7 days only)
    function filterMoodHistoryByDate() {
        if (!moodHistory.length) {
            filteredMoodHistory = [];
            updateHistoryList();
            updateMoodChart();
            return;
        }
        
        // If no date is selected, show all entries (no filter)
        if (!historyDateFilter || !historyDateFilter.value) {
            filteredMoodHistory = moodHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            updateHistoryList();
            updateMoodChart();
            return;
        }
        
        const selectedDate = new Date(historyDateFilter.value);
        selectedDate.setHours(23,59,59,999); // include full day
        const startDate = new Date(selectedDate);
        startDate.setDate(startDate.getDate() - 6); // 7 days window
        startDate.setHours(0,0,0,0);
        
        // Filter and sort by most recent first
        filteredMoodHistory = moodHistory.filter(entry => {
            const entryDate = new Date(entry.createdAt);
            return entryDate >= startDate && entryDate <= selectedDate;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        updateHistoryList();
        updateMoodChart();
    }
    
    // Function to update the history list display with better timestamps
    function updateHistoryList() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        const list = filteredMoodHistory && filteredMoodHistory.length ? filteredMoodHistory : [];
        if (list.length === 0) {
            historyList.innerHTML = '<p class="empty-history">No mood entries yet.</p>';
            return;
        }
        
        // Display most recent 10 entries
        const recentEntries = list.slice(0, 10);
        
        recentEntries.forEach(entry => {
            const date = new Date(entry.createdAt);
            
            // Format date and time in a more user-friendly way
            const formattedDate = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const formattedTime = date.toLocaleTimeString(undefined, { 
                hour: '2-digit', 
                minute: '2-digit'
            });
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            // Add captured method indicator (AI or manual)
            const captureMethod = entry.capturedVia === 'ai' ? 
                '<span class="capture-method ai">AI</span>' : 
                '<span class="capture-method manual">Manual</span>';
            
            // Add mood color dot
            const moodDot = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${getMoodColor(entry.label)};margin-right:5px;"></span>`;
            
            historyItem.innerHTML = `
                <span>${formattedDate}, ${formattedTime}</span>
                <div class="mood-details">
                    ${captureMethod}
                    <span class="mood-label-display">
                        ${moodDot}
                        ${entry.label}
                    </span>
                </div>
            `;
            
            historyList.appendChild(historyItem);
        });
    }
    
    // Initialize the chart
    function initMoodChart() {
        const ctx = document.getElementById('mood-history-chart').getContext('2d');
        
        moodChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Mood Level',
                    data: [],
                    backgroundColor: 'rgba(64, 115, 192, 0.2)',
                    borderColor: 'rgba(64, 115, 192, 1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: [], // Will be set dynamically
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0,
                        max: 6,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                const labels = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise'];
                                return labels[value] || '';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const moodLabels = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise'];
                                const value = context.raw;
                                return `Mood: ${moodLabels[value]}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Update chart with mood history data
    function updateMoodChart() {
        if (!moodChart) return;
        const list = filteredMoodHistory && filteredMoodHistory.length ? filteredMoodHistory : [];
        if (list.length === 0) {
            moodChart.data.labels = [];
            moodChart.data.datasets[0].data = [];
            moodChart.data.datasets[0].pointBackgroundColor = [];
            moodChart.update();
            return;
        }
        
        // Only last 10 data points, most recent first, but chart expects oldest first
        const chartData = list.slice(0, 10).reverse();
        
        const labels = chartData.map(entry => {
            const date = new Date(entry.createdAt);
            // Format date to be more readable
            return date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        });
        
        const data = chartData.map(entry => entry.value);
        
        // Set point color for each mood
        const pointColors = chartData.map(entry => getMoodColor(entry.label));
        moodChart.data.labels = labels;
        moodChart.data.datasets[0].data = data;
        moodChart.data.datasets[0].pointBackgroundColor = pointColors;
        
        // Add tooltips to show more info
        moodChart.options.plugins.tooltip.callbacks.title = function(tooltipItems) {
            const index = tooltipItems[0].dataIndex;
            const entry = chartData[index];
            const date = new Date(entry.createdAt);
            return date.toLocaleString();
        };
        
        moodChart.options.plugins.tooltip.callbacks.afterLabel = function(context) {
            const index = context.dataIndex;
            const entry = chartData[index];
            let result = [];
            
            if (entry.notes) {
                result.push(`Note: ${entry.notes.substring(0, 30)}${entry.notes.length > 30 ? '...' : ''}`);
            }
            
            result.push(`Captured via: ${entry.capturedVia === 'ai' ? 'AI Detection' : 'Manual Selection'}`);
            
            return result;
        };
        
        moodChart.update();
    }
    
    // Function to save mood data (common function for both AI and manual)
    async function saveMoodData(value, label, notes, captureMethod) {
        const auth = getAuthData();
        if (!auth.isLoggedIn) {
            showError('Session expired. Please login again.');
            return false;
        }

        const targetBtn = captureMethod === 'ai' ? captureBtn : saveManualMoodBtn;
        const originalText = targetBtn.textContent;
        try {
            targetBtn.disabled = true;
            targetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            const apiUrl = `${apiConfig.backendApiUrl}/api/mood`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: auth.headers,
                body: JSON.stringify({
                    value,
                    label,
                    notes: notes || '',
                    capturedVia: captureMethod
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            targetBtn.disabled = false;
            targetBtn.textContent = originalText;
            
            if (data.success) {
                showSuccess(`Mood ${captureMethod === 'ai' ? 'detected' : 'saved'} as ${label}!`);
                if (captureMethod === 'manual') {
                    moodOptions.forEach(opt => opt.classList.remove('selected'));
                    moodNotes.value = '';
                    selectedMood = null;
                }
                await loadMoodHistory();
                updateMoodTrackerButton({ value, label });
                await loadRecommendations(label);
                return true;
            } else {
                showError(data.message || 'Failed to save mood.');
                return false;
            }
        } catch (error) {
            console.error('Save mood error:', error);
            showError(`Error: ${error.message}`);
            targetBtn.disabled = false;
            targetBtn.textContent = originalText;
            return false;
        }
    }

    // Fail-safe notification helpers
    function showSuccess(msg) {
        if (typeof window.showSuccess === 'function') window.showSuccess(msg);
        else console.log('SUCCESS:', msg);
    }
    function showError(msg) {
        if (typeof window.showError === 'function') window.showError(msg);
        else {
            console.error('ERROR:', msg);
            if (result) result.innerHTML = `<div class="result-content" style="background:#fdeded">${msg}</div>`;
        }
    }
    function showWarning(msg) {
        if (typeof window.showWarning === 'function') window.showWarning(msg);
        else alert(msg);
    }
    
    // Replace existing saveManualMood function with this improved version
    async function saveManualMood(value, label, notes) {
        return await saveMoodData(value, label, notes, 'manual');
    }
    
    // Function to start the mood capture process with AI
    async function startMoodCapture() {
        const auth = getAuthData();
        if (!auth.isLoggedIn) {
            showWarning('Please login first.');
            return;
        }

        try {
            // Disable capture button
            captureBtn.disabled = true;
            
            // Show analyzing message
            result.innerHTML = '<div class="result-content">Preparing camera...</div>';
            
            // Try high-resolution first, fallback to simple video if it fails
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: { ideal: 640 }, height: { ideal: 480 } } 
                });
            } catch (innerError) {
                console.warn('High-res camera request failed, trying simple constraints...', innerError);
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            
            // Display video stream
            video.srcObject = mediaStream;
            
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = () => resolve();
                video.onerror = (e) => reject(e);
                // Timeout after 3 seconds if metadata never loads
                setTimeout(() => reject(new Error("Video metadata timeout")), 3000);
            });
            
            // Start video playback
            await video.play();
            
            // Start countdown
            result.innerHTML = '<div class="result-content">Get ready for mood detection...</div>';
            startCountdown();
        } catch (error) {
            console.error('Detailed camera error:', error);
            let errorMsg = 'Error accessing camera.';
            
            // Provide more specific feedback based on error type
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMsg = 'Camera permission denied. Please allow camera access in your browser settings.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMsg = 'No camera found. Please connect a webcam.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMsg = 'Camera is already in use by another application. Please close other apps using the camera.';
            } else {
                errorMsg += ` (${error.message || error.name})`;
            }
            
            result.innerHTML = `<div class="result-content">${errorMsg}</div>`;
            result.style.backgroundColor = '#fdeded';
            captureBtn.disabled = false;
        }
    }
    
    // Function to start the countdown
    function startCountdown() {
        let count = 3;
        countdown.textContent = count;
        countdown.style.display = 'flex';
        
        const countdownInterval = setInterval(() => {
            count--;
            countdown.textContent = count;
            
            if (count <= 0) {
                clearInterval(countdownInterval);
                countdown.style.display = 'none';
                captureMoodImage();
            }
        }, 1000);
    }
    
    // Function to capture the mood image — 3-frame sampling for accuracy
    function captureMoodImage() {
        try {
            result.innerHTML = '<div class="result-content"><i class="fas fa-spinner fa-spin"></i> Analyzing your mood (3 frames)...</div>';

            let captureCount = 0;
            const maxCaptures = 3;
            const predictions = [];

            const captureFrame = () => {
                // Draw current live video frame to canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(blob => {
                    const file = new File([blob], 'mood-capture.jpg', {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    const formData = new FormData();
                    formData.append('image', file); // 'image' matches aiController.js and HF app.py

                    const apiUrl = `${apiConfig.backendApiUrl}/api/ai/analyze-face`;

                    fetch(apiUrl, {
                        method: 'POST',
                        headers: isLoggedIn ? { 'Authorization': `Bearer ${authToken}` } : {},
                        body: formData
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.success) {
                            predictions.push({
                                label: data.moodLabel,
                                value: data.mood,
                                confidence: data.confidence || 0
                            });
                            console.log(`Frame ${captureCount + 1} result:`, data.moodLabel, '| confidence:', data.confidence);
                        } else {
                            console.warn(`Frame ${captureCount + 1}: no face detected or failed`, data?.message);
                        }
                    })
                    .catch(err => console.warn(`Frame ${captureCount + 1} fetch error:`, err))
                    .finally(() => {
                        captureCount++;

                        if (captureCount < maxCaptures) {
                            // Capture next frame after 600ms while webcam is still live
                            setTimeout(captureFrame, 600);
                        } else {
                            // All frames captured — NOW stop webcam
                            if (mediaStream) {
                                mediaStream.getTracks().forEach(track => track.stop());
                                video.srcObject = null;
                            }

                            if (predictions.length === 0) {
                                result.innerHTML = `
                                    <div class="result-content">
                                        <span>⚠️ No face detected in any frame.</span>
                                        <br><small>Ensure good lighting, face the camera directly, and try again.</small>
                                    </div>`;
                                result.style.backgroundColor = '#fdeded';
                                captureBtn.disabled = false;
                                return;
                            }

                            // Vote: pick the most frequently detected emotion across all 3 frames
                            const freq = {};
                            predictions.forEach(p => freq[p.label] = (freq[p.label] || 0) + 1);
                            const bestLabel = Object.keys(freq).reduce((a, b) => freq[a] >= freq[b] ? a : b);
                            const best = predictions.find(p => p.label === bestLabel);

                            console.log(`Voting result: ${bestLabel} (appeared ${freq[bestLabel]}/${predictions.length} frames)`);
                            displayAndSaveMood(best.value, best.label);
                        }
                    });
                }, 'image/jpeg', 0.9);
            };

            // Kick off first frame capture
            captureFrame();

        } catch (error) {
            console.error('Error in captureMoodImage:', error);
            result.innerHTML = `<div class="result-content">Error: ${error.message}. Please try again.</div>`;
            result.style.backgroundColor = '#fdeded';
            captureBtn.disabled = false;
        }
    }

    // Helper: display final voted result and trigger all side effects
    async function displayAndSaveMood(moodValue, moodLabel) {
        const emoji = moodEmojis[moodLabel] || '🤔';
        result.innerHTML = `
            <div class="result-content">
                <span class="mood-emoji">${emoji}</span>
                <span>You seem to be feeling <strong>${moodLabel}</strong></span>
                <div class="save-status">✨ Auto-Saved to Mood History</div>
            </div>`;
        result.style.backgroundColor = '#edf7ed';

        await loadMoodHistory();
        updateMoodTrackerButton({ value: moodValue, label: moodLabel });
        await loadRecommendations(moodLabel);
        showSuccess(`Mood detected as ${moodLabel}!`);
        captureBtn.disabled = false;
    }

    // Update the analyzeMoodImage function to use the Node.js Backend Bridge (Fastest & Safest)
    async function analyzeMoodImage(formData) {
        try {
            // Send directly to our unified Node.js Backend Bridge
            const apiUrl = `${apiConfig.backendApiUrl}/api/ai/analyze-face`;
            
            console.log('Sending image to Backend Bridge at:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    ...(isLoggedIn ? { 'Authorization': `Bearer ${authToken}` } : {})
                    // Multipart boundary is automatically handled by the browser for FormData
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Backend Bridge responded with status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Backend Bridge response:', data);
            
            if (data && data.success) {
                const moodValue = data.mood;
                const moodLabel = data.moodLabel;
                const emoji = moodEmojis[moodLabel] || '🤔';
                
                // Display result
                result.innerHTML = `
                    <div class="result-content">
                        <span class="mood-emoji">${emoji}</span>
                        <span>You seem to be feeling <strong>${moodLabel}</strong></span>
                        <div class="save-status">Status: Auto-Saved to Mood History ✨</div>
                    </div>
                `;
                
                // Set background color based on mood
                result.style.backgroundColor = '#edf7ed';
                
                // Update everything UI-wise
                await loadMoodHistory();
                updateMoodTrackerButton({ value: moodValue, label: moodLabel });
                await loadRecommendations(moodLabel);
                
                showSuccess(`Mood detected and recorded as ${moodLabel}!`);
            } else {
                throw new Error(data.message || 'Mood detection failed');
            }
        } catch (error) {
            console.error('Error connecting to Mood Architecture:', error);
            result.innerHTML = `
                <div class="result-content">
                    <span>Error: Could not connect to ChittSaathi AI. Please ensure your Backend &amp; ML services are live.</span>
                    <br><small>${error.message}</small>
                </div>
            `;
            result.style.backgroundColor = '#fdeded';
        } finally {
            // Re-enable capture button
            captureBtn.disabled = false;
        }
    }
    
    // Helper: get color for each mood
    function getMoodColor(label) {
        switch(label) {
            case 'Angry': return '#e74c3c';
            case 'Disgust': return '#27ae60';
            case 'Fear': return '#8e44ad';
            case 'Happy': return '#f1c40f';
            case 'Neutral': return '#95a5a6';
            case 'Sad': return '#3498db';
            case 'Surprise': return '#e67e22';
            default: return '#888';
        }
    }
    
    // Function to load and display recommendations based on mood
    async function loadRecommendations(moodLabel) {
        if (!isLoggedIn) {
            return;
        }

        try {
            // Load resources from resources.json
            const response = await fetch('resource/resources.json');
            const resources = await response.json();
            
            // Filter resources based on mood
            const filteredResources = filterResourcesByMood(resources, moodLabel.toLowerCase());
            
            // Display recommendations
            displayRecommendations(filteredResources, moodLabel);
            
            // Show the recommendations section
            const recommendationsSection = document.getElementById('mood-recommendations');
            recommendationsSection.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading recommendations:', error);
            showError('Failed to load recommendations. Please try again later.');
        }
    }
    
    // Function to filter resources by mood
    function filterResourcesByMood(resources, mood) {
        const filtered = {
            quotes: [],
            videos: [],
            audio: [],
            posters: [],
            guides: [],
            books: []
        };
        
        // Filter each resource type
        Object.keys(resources).forEach(resourceType => {
            if (Array.isArray(resources[resourceType])) {
                resources[resourceType].forEach(resource => {
                    if (resource.tags && resource.tags.includes(mood)) {
                        filtered[resourceType].push(resource);
                    }
                });
            }
        });
        
        return filtered;
    }
    
    // Function to display recommendations in masonry layout
    function displayRecommendations(resources, moodLabel) {
        const recommendationContent = document.getElementById('recommendation-content');
        
        // Create masonry container
        let html = `
            <div class="recommendations-header">
                <h4>Recommended for your ${moodLabel} mood</h4>
                <p>Here are some resources that might help you feel better:</p>
            </div>
            <div class="masonry-container">
        `;
        
        // Add quotes
        if (resources.quotes && resources.quotes.length > 0) {
            resources.quotes.forEach(quoteGroup => {
                if (quoteGroup.quotes && quoteGroup.quotes.length > 0) {
                    const randomQuote = quoteGroup.quotes[Math.floor(Math.random() * quoteGroup.quotes.length)];
                    html += `
                        <div class="masonry-item quote-item">
                            <h5>Inspirational Quote</h5>
                            <p class="quote-text">"${randomQuote}"</p>
                        </div>
                    `;
                }
            });
        }
        
        // Add videos
        if (resources.videos && resources.videos.length > 0) {
            resources.videos.slice(0, 2).forEach((video, index) => {
                const videoId = `video-${index}`;
                html += `
                    <div class="masonry-item video-item">
                        <h5>${video.title}</h5>
                        <p>${video.description}</p>
                        <div class="video-container-inline">
                            <video id="${videoId}" controls style="width: 100%; border-radius: 8px;">
                                <source src="${video.file}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                            <button class="fullscreen-btn" onclick="toggleFullscreen('${videoId}')">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                        <div class="resource-meta">
                            <span class="duration">${video.duration}</span>
                        </div>
                    </div>
                `;
            });
        }
        
        // Add audio
        if (resources.audio && resources.audio.length > 0) {
            resources.audio.slice(0, 2).forEach(audio => {
                html += `
                    <div class="masonry-item audio-item">
                        <h5>${audio.title}</h5>
                        <p>${audio.description}</p>
                        <div class="audio-container-inline">
                            <audio controls style="width: 100%;">
                                <source src="${audio.file}" type="audio/mpeg">
                                Your browser does not support the audio tag.
                            </audio>
                        </div>
                        <div class="resource-meta">
                            <span class="duration">${audio.duration}</span>
                        </div>
                    </div>
                `;
            });
        }
        
        // Add posters
        if (resources.posters && resources.posters.length > 0) {
            resources.posters.slice(0, 2).forEach(poster => {
                html += `
                    <div class="masonry-item poster-item">
                        <h5>${poster.title}</h5>
                        <p>${poster.description}</p>
                        <div class="poster-preview">
                            <img src="${poster.file}" alt="${poster.title}" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px;">
                        </div>
                    </div>
                `;
            });
        }
        
        // Add guides
        if (resources.guides && resources.guides.length > 0) {
            resources.guides.slice(0, 1).forEach(guide => {
                html += `
                    <div class="masonry-item guide-item">
                        <h5>${guide.title}</h5>
                        <p>${guide.description}</p>
                        <button class="btn-small" onclick="openPDF('${guide.file}')">Read Guide</button>
                    </div>
                `;
            });
        }
        
        // Add books
        if (resources.books && resources.books.length > 0) {
            resources.books.slice(0, 1).forEach(book => {
                html += `
                    <div class="masonry-item book-item">
                        <h5>${book.title}</h5>
                        <p>${book.description}</p>
                        <button class="btn-small" onclick="openPDF('${book.file}')">Read Book</button>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        
        recommendationContent.innerHTML = html;
    }
    
    // Function to toggle fullscreen for videos
    window.toggleFullscreen = function(videoId) {
        const video = document.getElementById(videoId);
        if (video) {
            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.msRequestFullscreen) {
                video.msRequestFullscreen();
            }
        }
    };
    
    // Function to open PDF files
    window.openPDF = function(file) {
        window.open(file, '_blank');
    };
});