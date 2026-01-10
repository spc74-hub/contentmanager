// Estado de la aplicación
let appState = {
    videos: [],
    filteredVideos: [],
    apiKey: localStorage.getItem('youtube_api_key') || '',
    isLoading: false,
    youtubeDataLoaded: false
};

// Elementos del DOM
const elements = {
    totalVideos: document.getElementById('total-videos'),
    authorFilter: document.getElementById('author-filter'),
    categoryFilter: document.getElementById('category-filter'),
    durationMin: document.getElementById('duration-min'),
    durationMax: document.getElementById('duration-max'),
    likesMin: document.getElementById('likes-min'),
    likesMax: document.getElementById('likes-max'),
    searchInput: document.getElementById('search-input'),
    clearFilters: document.getElementById('clear-filters'),
    categoryStats: document.getElementById('category-stats'),
    authorStats: document.getElementById('author-stats'),
    loading: document.getElementById('loading'),
    loadingProgress: document.getElementById('loading-progress'),
    mainContent: document.getElementById('main-content'),
    apiModal: document.getElementById('api-modal'),
    apiKeyInput: document.getElementById('api-key-input'),
    saveApiKey: document.getElementById('save-api-key'),
    skipApiKey: document.getElementById('skip-api-key')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Procesar los datos base
    processBaseData();

    // Comprobar si hay datos de YouTube guardados
    const cachedData = localStorage.getItem('youtube_video_data');

    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            // Verificar que los datos no tengan más de 24 horas
            if (parsed.timestamp && (Date.now() - parsed.timestamp) < 24 * 60 * 60 * 1000) {
                mergeYouTubeData(parsed.data);
                appState.youtubeDataLoaded = true;
                renderApp();
                return;
            }
        } catch (e) {
            console.error('Error parsing cached data:', e);
        }
    }

    // Si hay API key guardada, cargar datos automáticamente
    if (appState.apiKey) {
        elements.apiKeyInput.value = appState.apiKey;
        await loadYouTubeData();
    } else {
        // Mostrar modal para introducir API key
        elements.apiModal.classList.add('active');
    }

    setupEventListeners();
}

function processBaseData() {
    // Convertir los datos base en el formato de trabajo
    appState.videos = videosData.videos.map((video, index) => ({
        id: index,
        ...video,
        category: videosData.categories.find(c => c.id === video.categoryId),
        // Datos que se llenarán con YouTube API
        youtubeId: null,
        url: null,
        thumbnail: null,
        duration: null,
        durationMinutes: null,
        likes: null,
        views: null
    }));

    appState.filteredVideos = [...appState.videos];
}

function setupEventListeners() {
    // Filtros
    elements.authorFilter.addEventListener('change', applyFilters);
    elements.categoryFilter.addEventListener('change', applyFilters);
    elements.durationMin.addEventListener('input', debounce(applyFilters, 300));
    elements.durationMax.addEventListener('input', debounce(applyFilters, 300));
    elements.likesMin.addEventListener('input', debounce(applyFilters, 300));
    elements.likesMax.addEventListener('input', debounce(applyFilters, 300));
    elements.searchInput.addEventListener('input', debounce(applyFilters, 300));
    elements.clearFilters.addEventListener('click', clearFilters);

    // Modal API Key
    elements.saveApiKey.addEventListener('click', async () => {
        const key = elements.apiKeyInput.value.trim();
        if (key) {
            appState.apiKey = key;
            localStorage.setItem('youtube_api_key', key);
            elements.apiModal.classList.remove('active');
            await loadYouTubeData();
        }
    });

    elements.skipApiKey.addEventListener('click', () => {
        elements.apiModal.classList.remove('active');
        generateMockData();
        renderApp();
    });

    // Click en stats para filtrar
    elements.categoryStats.addEventListener('click', (e) => {
        const row = e.target.closest('.stat-row');
        if (row) {
            const categoryId = row.dataset.categoryId;
            elements.categoryFilter.value = categoryId;
            applyFilters();
        }
    });

    elements.authorStats.addEventListener('click', (e) => {
        const row = e.target.closest('.stat-row');
        if (row) {
            const author = row.dataset.author;
            elements.authorFilter.value = author;
            applyFilters();
        }
    });
}

// YouTube API Integration
async function loadYouTubeData() {
    elements.loading.classList.add('active');
    elements.mainContent.style.display = 'none';

    const youtubeData = {};
    const batchSize = 10;
    const videos = appState.videos;

    for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize);
        elements.loadingProgress.textContent = `Procesando ${Math.min(i + batchSize, videos.length)} de ${videos.length} videos...`;

        await Promise.all(batch.map(async (video) => {
            try {
                const data = await searchYouTubeVideo(video.title, video.author);
                if (data) {
                    youtubeData[video.id] = data;
                }
            } catch (error) {
                console.error(`Error fetching data for: ${video.title}`, error);
            }
        }));

        // Pequeña pausa entre lotes para evitar rate limiting
        if (i + batchSize < videos.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Guardar en cache
    localStorage.setItem('youtube_video_data', JSON.stringify({
        timestamp: Date.now(),
        data: youtubeData
    }));

    mergeYouTubeData(youtubeData);
    appState.youtubeDataLoaded = true;

    elements.loading.classList.remove('active');
    elements.mainContent.style.display = 'block';

    renderApp();
}

async function searchYouTubeVideo(title, author) {
    const searchQuery = encodeURIComponent(`${title} ${author}`);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1&key=${appState.apiKey}`;

    try {
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.error) {
            console.error('YouTube API Error:', searchData.error);
            return null;
        }

        if (searchData.items && searchData.items.length > 0) {
            const videoId = searchData.items[0].id.videoId;
            const snippet = searchData.items[0].snippet;

            // Obtener estadísticas del video
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoId}&key=${appState.apiKey}`;
            const statsResponse = await fetch(statsUrl);
            const statsData = await statsResponse.json();

            if (statsData.items && statsData.items.length > 0) {
                const stats = statsData.items[0].statistics;
                const contentDetails = statsData.items[0].contentDetails;
                const duration = parseDuration(contentDetails.duration);

                return {
                    youtubeId: videoId,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    thumbnail: snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url,
                    channelTitle: snippet.channelTitle,
                    duration: formatDuration(duration),
                    durationMinutes: Math.round(duration / 60),
                    likes: parseInt(stats.likeCount) || 0,
                    views: parseInt(stats.viewCount) || 0
                };
            }
        }
    } catch (error) {
        console.error('Error fetching YouTube data:', error);
    }

    return null;
}

function parseDuration(duration) {
    // Parsear formato ISO 8601 (PT1H2M3S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (match) {
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function mergeYouTubeData(youtubeData) {
    appState.videos = appState.videos.map(video => {
        const ytData = youtubeData[video.id];
        if (ytData) {
            return { ...video, ...ytData };
        }
        return video;
    });
    appState.filteredVideos = [...appState.videos];
}

function generateMockData() {
    // Generar datos de ejemplo cuando no hay API key
    appState.videos = appState.videos.map(video => ({
        ...video,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(video.title + ' ' + video.author)}`,
        thumbnail: null,
        duration: `${Math.floor(Math.random() * 50) + 5}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        durationMinutes: Math.floor(Math.random() * 50) + 5,
        likes: Math.floor(Math.random() * 50000) + 100,
        views: Math.floor(Math.random() * 500000) + 1000
    }));
    appState.filteredVideos = [...appState.videos];
}

// Filtros
function applyFilters() {
    const authorValue = elements.authorFilter.value;
    const categoryValue = elements.categoryFilter.value;
    const durationMin = parseInt(elements.durationMin.value) || 0;
    const durationMax = parseInt(elements.durationMax.value) || Infinity;
    const likesMin = parseInt(elements.likesMin.value) || 0;
    const likesMax = parseInt(elements.likesMax.value) || Infinity;
    const searchTerm = elements.searchInput.value.toLowerCase().trim();

    appState.filteredVideos = appState.videos.filter(video => {
        // Filtro por autor
        if (authorValue && video.author !== authorValue) return false;

        // Filtro por categoría
        if (categoryValue && video.categoryId !== categoryValue) return false;

        // Filtro por duración
        if (video.durationMinutes !== null) {
            if (video.durationMinutes < durationMin) return false;
            if (video.durationMinutes > durationMax) return false;
        }

        // Filtro por likes
        if (video.likes !== null) {
            if (video.likes < likesMin) return false;
            if (video.likes > likesMax) return false;
        }

        // Filtro por búsqueda
        if (searchTerm) {
            const matchTitle = video.title.toLowerCase().includes(searchTerm);
            const matchAuthor = video.author.toLowerCase().includes(searchTerm);
            const matchSummary = video.summary.toLowerCase().includes(searchTerm);
            if (!matchTitle && !matchAuthor && !matchSummary) return false;
        }

        return true;
    });

    renderVideos();
    updateStats();
}

function clearFilters() {
    elements.authorFilter.value = '';
    elements.categoryFilter.value = '';
    elements.durationMin.value = '';
    elements.durationMax.value = '';
    elements.likesMin.value = '';
    elements.likesMax.value = '';
    elements.searchInput.value = '';

    appState.filteredVideos = [...appState.videos];
    renderVideos();
    updateStats();
}

// Renderizado
function renderApp() {
    populateFilters();
    renderVideos();
    updateStats();
    elements.mainContent.style.display = 'block';
}

function populateFilters() {
    // Poblar filtro de autores
    const authors = [...new Set(appState.videos.map(v => v.author))].sort();
    elements.authorFilter.innerHTML = '<option value="">Todos los autores</option>';
    authors.forEach(author => {
        elements.authorFilter.innerHTML += `<option value="${author}">${author}</option>`;
    });

    // Poblar filtro de categorías
    elements.categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    videosData.categories.forEach(cat => {
        elements.categoryFilter.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });
}

function renderVideos() {
    // Agrupar videos por categoría
    const videosByCategory = {};

    appState.filteredVideos.forEach(video => {
        if (!videosByCategory[video.categoryId]) {
            videosByCategory[video.categoryId] = [];
        }
        videosByCategory[video.categoryId].push(video);
    });

    // Renderizar
    let html = '';

    videosData.categories.forEach(category => {
        const categoryVideos = videosByCategory[category.id] || [];
        if (categoryVideos.length === 0) return;

        html += `
            <section class="category-section" data-category="${category.id}">
                <div class="category-header">
                    <h2 class="category-title">
                        <span class="category-icon">${category.icon}</span>
                        ${category.name}
                    </h2>
                    <span class="category-count">${categoryVideos.length} videos</span>
                </div>
                <div class="videos-grid">
                    ${categoryVideos.map(video => renderVideoCard(video)).join('')}
                </div>
            </section>
        `;
    });

    if (appState.filteredVideos.length === 0) {
        html = `
            <div class="no-results">
                <h3>No se encontraron videos</h3>
                <p>Intenta ajustar los filtros de búsqueda</p>
            </div>
        `;
    }

    elements.mainContent.innerHTML = html;
    elements.totalVideos.textContent = appState.filteredVideos.length;
}

function renderVideoCard(video) {
    const thumbnailHtml = video.thumbnail
        ? `<img src="${video.thumbnail}" alt="${video.title}" loading="lazy">`
        : `<div class="placeholder">🎬</div>`;

    const likesClass = video.likes > 10000 ? 'high' : '';
    const likesFormatted = video.likes ? formatNumber(video.likes) : 'N/A';
    const viewsFormatted = video.views ? formatNumber(video.views) : 'N/A';

    return `
        <article class="video-card">
            <div class="video-thumbnail">
                ${thumbnailHtml}
                ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
            </div>
            <div class="video-content">
                <h3 class="video-title">
                    <a href="${video.url || '#'}" target="_blank" rel="noopener noreferrer">
                        ${video.title}
                    </a>
                </h3>
                <p class="video-author">
                    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(video.author)}" target="_blank" rel="noopener noreferrer">
                        ${video.author}
                    </a>
                </p>
                <p class="video-summary">${video.summary}</p>
                <div class="video-meta">
                    <span class="video-likes ${likesClass}">
                        👍 ${likesFormatted}
                    </span>
                    <span class="video-views">
                        👁️ ${viewsFormatted}
                    </span>
                    <a href="${video.url || '#'}" target="_blank" rel="noopener noreferrer" class="video-link">
                        Ver video →
                    </a>
                </div>
            </div>
        </article>
    `;
}

function updateStats() {
    // Stats por categoría
    const categoryStats = {};
    appState.filteredVideos.forEach(video => {
        categoryStats[video.categoryId] = (categoryStats[video.categoryId] || 0) + 1;
    });

    let categoryHtml = '';
    videosData.categories.forEach(cat => {
        const count = categoryStats[cat.id] || 0;
        if (count > 0) {
            categoryHtml += `
                <div class="stat-row" data-category-id="${cat.id}">
                    <span class="name">${cat.icon} ${cat.name}</span>
                    <span class="count">${count}</span>
                </div>
            `;
        }
    });
    elements.categoryStats.innerHTML = categoryHtml || '<p style="color: var(--text-secondary);">No hay videos</p>';

    // Stats por autor
    const authorStats = {};
    appState.filteredVideos.forEach(video => {
        authorStats[video.author] = (authorStats[video.author] || 0) + 1;
    });

    const sortedAuthors = Object.entries(authorStats)
        .sort((a, b) => b[1] - a[1]);

    let authorHtml = '';
    sortedAuthors.forEach(([author, count]) => {
        authorHtml += `
            <div class="stat-row" data-author="${author}">
                <span class="name">${author}</span>
                <span class="count">${count}</span>
            </div>
        `;
    });
    elements.authorStats.innerHTML = authorHtml || '<p style="color: var(--text-secondary);">No hay autores</p>';
}

// Utilidades
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// IMPORT PLAYLIST FUNCTIONALITY WITH OAUTH
// ============================================

// OAuth Configuration
const OAUTH_CONFIG = {
    clientId: '552345454752-bq257utgj6ga3nkrm98fbssqjf0j9oou.apps.googleusercontent.com',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly'
};

let importState = {
    playlists: [],
    selectedPlaylist: null,
    channelId: null,
    accessToken: null,
    user: null
};

let tokenClient = null;

// Import modal elements
const importElements = {
    modal: document.getElementById('import-modal'),
    btnImport: document.getElementById('btn-import-playlist'),
    channelInput: document.getElementById('channel-input'),
    btnLoadPlaylists: document.getElementById('btn-load-playlists'),
    btnCloseImport: document.getElementById('btn-close-import'),
    playlistsList: document.getElementById('playlists-list'),
    importCategory: document.getElementById('import-category'),
    btnBackStep1: document.getElementById('btn-back-step1'),
    btnImportSelected: document.getElementById('btn-import-selected'),
    stepAuth: document.getElementById('import-step-auth'),
    step1: document.getElementById('import-step-1'),
    step2: document.getElementById('import-step-2'),
    step3: document.getElementById('import-step-3'),
    progressText: document.getElementById('import-progress-text'),
    btnGoogleLogin: document.getElementById('btn-google-login'),
    userInfo: document.getElementById('user-info')
};

// Initialize Google Identity Services
function initGoogleAuth() {
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: OAUTH_CONFIG.clientId,
            scope: OAUTH_CONFIG.scopes,
            callback: handleOAuthCallback
        });
    } else {
        // Retry after a short delay if Google library not loaded yet
        setTimeout(initGoogleAuth, 500);
    }
}

function handleOAuthCallback(response) {
    if (response.access_token) {
        importState.accessToken = response.access_token;
        // Store token temporarily
        sessionStorage.setItem('youtube_oauth_token', response.access_token);
        loadUserPlaylistsWithOAuth();
    } else if (response.error) {
        console.error('OAuth error:', response.error);
        showImportError('Error al conectar con Google: ' + response.error);
        showImportStep('auth');
    }
}

// Setup import event listeners
function setupImportListeners() {
    // Open modal
    importElements.btnImport.addEventListener('click', () => {
        openImportModal();
    });

    // Close modal
    importElements.btnCloseImport.addEventListener('click', () => {
        closeImportModal();
    });

    // Google login
    if (importElements.btnGoogleLogin) {
        importElements.btnGoogleLogin.addEventListener('click', () => {
            if (tokenClient) {
                tokenClient.requestAccessToken();
            } else {
                alert('Google Identity Services no está cargado. Recarga la página.');
            }
        });
    }

    // Load playlists manually
    importElements.btnLoadPlaylists.addEventListener('click', async () => {
        await loadChannelPlaylists();
    });

    // Back to auth step
    importElements.btnBackStep1.addEventListener('click', () => {
        showImportStep('auth');
    });

    // Import selected playlist
    importElements.btnImportSelected.addEventListener('click', async () => {
        await importSelectedPlaylist();
    });

    // Playlist selection
    importElements.playlistsList.addEventListener('click', (e) => {
        const item = e.target.closest('.playlist-item');
        if (item) {
            selectPlaylist(item.dataset.playlistId);
        }
    });
}

function openImportModal() {
    if (!appState.apiKey) {
        alert('Primero necesitas configurar una API Key de YouTube');
        return;
    }

    // Populate category dropdown
    importElements.importCategory.innerHTML = '<option value="">-- Sin categoría --</option>';
    videosData.categories.forEach(cat => {
        importElements.importCategory.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });

    // Reset state
    importState.playlists = [];
    importState.selectedPlaylist = null;

    // Check if we have a valid token
    const savedToken = sessionStorage.getItem('youtube_oauth_token');
    if (savedToken) {
        importState.accessToken = savedToken;
        // Try to load playlists with saved token
        showImportStep(3);
        loadUserPlaylistsWithOAuth();
    } else {
        showImportStep('auth');
    }

    importElements.modal.classList.add('active');
}

function closeImportModal() {
    importElements.modal.classList.remove('active');
}

function showImportStep(step) {
    importElements.stepAuth.style.display = step === 'auth' ? 'block' : 'none';
    importElements.step1.style.display = step === 1 ? 'block' : 'none';
    importElements.step2.style.display = step === 2 ? 'block' : 'none';
    importElements.step3.style.display = step === 3 ? 'block' : 'none';
}

async function loadUserPlaylistsWithOAuth() {
    showImportStep(3);
    importElements.progressText.textContent = 'Cargando tus playlists...';

    try {
        // Fetch user's playlists using OAuth token
        const playlists = await fetchMyPlaylists();
        importState.playlists = playlists;

        if (playlists.length === 0) {
            showImportStep('auth');
            showImportError('No se encontraron playlists en tu cuenta.');
            return;
        }

        // Render playlists
        renderPlaylists(playlists);
        showImportStep(2);

    } catch (error) {
        console.error('Error loading playlists:', error);
        // Token might be expired, clear it
        sessionStorage.removeItem('youtube_oauth_token');
        importState.accessToken = null;
        showImportStep('auth');
        showImportError('Error al cargar las playlists. Por favor, vuelve a conectar con Google.');
    }
}

async function fetchMyPlaylists() {
    const playlists = [];
    let nextPageToken = '';

    do {
        const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50&pageToken=${nextPageToken}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${importState.accessToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('API Error:', data);
            if (response.status === 401) {
                throw new Error('Token expired');
            }
            if (response.status === 403) {
                // Try to get more details about the error
                const errorMsg = data.error?.message || 'Acceso denegado';
                const errorReason = data.error?.errors?.[0]?.reason || '';
                console.error('403 Error details:', errorMsg, errorReason);
                throw new Error(`Acceso denegado: ${errorReason}. ${errorMsg}`);
            }
            throw new Error(data.error?.message || 'Error fetching playlists');
        }

        if (data.items) {
            playlists.push(...data.items.map(item => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                videoCount: item.contentDetails.itemCount
            })));
        }

        nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);

    // Also fetch "Watch Later" and "Liked Videos" special playlists
    try {
        const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
            headers: {
                'Authorization': `Bearer ${importState.accessToken}`
            }
        });
        const channelData = await channelResponse.json();

        if (channelData.items && channelData.items[0]) {
            const relatedPlaylists = channelData.items[0].contentDetails.relatedPlaylists;

            // Add Liked Videos playlist
            if (relatedPlaylists.likes) {
                playlists.unshift({
                    id: relatedPlaylists.likes,
                    title: '👍 Videos que me gustan',
                    description: 'Videos que has marcado como Me gusta',
                    thumbnail: null,
                    videoCount: '?',
                    isSpecial: true
                });
            }

            // Watch Later is not accessible via API anymore, but we keep the structure
        }
    } catch (e) {
        console.log('Could not fetch special playlists:', e);
    }

    return playlists;
}

async function loadChannelPlaylists() {
    const input = importElements.channelInput.value.trim();
    if (!input) {
        showImportError('Por favor introduce la URL o nombre de tu canal');
        return;
    }

    showImportStep(3);
    importElements.progressText.textContent = 'Buscando canal...';

    try {
        // Resolve channel ID from input
        const channelId = await resolveChannelId(input);
        if (!channelId) {
            showImportStep(1);
            showImportError('No se pudo encontrar el canal. Asegúrate de que sea público.');
            return;
        }

        importState.channelId = channelId;
        importElements.progressText.textContent = 'Cargando playlists...';

        // Fetch playlists
        const playlists = await fetchChannelPlaylists(channelId);
        importState.playlists = playlists;

        if (playlists.length === 0) {
            showImportStep(1);
            showImportError('No se encontraron playlists públicas en este canal.');
            return;
        }

        // Render playlists
        renderPlaylists(playlists);
        showImportStep(2);

    } catch (error) {
        console.error('Error loading playlists:', error);
        showImportStep(1);
        showImportError('Error al cargar las playlists: ' + error.message);
    }
}

async function resolveChannelId(input) {
    // Handle different input formats
    let channelId = null;

    // Direct channel ID (starts with UC)
    if (input.startsWith('UC') && input.length === 24) {
        return input;
    }

    // @username format
    if (input.startsWith('@')) {
        const handle = input.substring(1);
        const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${appState.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return data.items[0].id;
        }
    }

    // URL format
    if (input.includes('youtube.com')) {
        // Extract from /channel/UCxxxxx
        const channelMatch = input.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
        if (channelMatch) {
            return channelMatch[1];
        }

        // Extract @handle from URL
        const handleMatch = input.match(/@([a-zA-Z0-9_-]+)/);
        if (handleMatch) {
            const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handleMatch[1]}&key=${appState.apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                return data.items[0].id;
            }
        }

        // Try to extract username from /user/ or /c/ format
        const userMatch = input.match(/\/(user|c)\/([a-zA-Z0-9_-]+)/);
        if (userMatch) {
            // Search for channel by username
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${userMatch[2]}&maxResults=1&key=${appState.apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                return data.items[0].snippet.channelId;
            }
        }
    }

    // Try searching by name
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(input)}&maxResults=1&key=${appState.apiKey}`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
        return data.items[0].snippet.channelId;
    }

    return null;
}

async function fetchChannelPlaylists(channelId) {
    const playlists = [];
    let nextPageToken = '';

    do {
        const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&pageToken=${nextPageToken}&key=${appState.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (data.items) {
            playlists.push(...data.items.map(item => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                videoCount: item.contentDetails.itemCount
            })));
        }

        nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);

    return playlists;
}

function renderPlaylists(playlists) {
    let html = '';

    playlists.forEach(playlist => {
        html += `
            <div class="playlist-item" data-playlist-id="${playlist.id}">
                <img class="playlist-thumbnail" src="${playlist.thumbnail || ''}" alt="${playlist.title}">
                <div class="playlist-info">
                    <div class="playlist-title">${playlist.title}</div>
                    <span class="playlist-count">${playlist.videoCount} videos</span>
                </div>
            </div>
        `;
    });

    importElements.playlistsList.innerHTML = html;
}

function selectPlaylist(playlistId) {
    importState.selectedPlaylist = importState.playlists.find(p => p.id === playlistId);

    // Update UI
    document.querySelectorAll('.playlist-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.playlistId === playlistId);
    });

    importElements.btnImportSelected.disabled = !importState.selectedPlaylist;
}

async function importSelectedPlaylist() {
    if (!importState.selectedPlaylist) return;

    const playlist = importState.selectedPlaylist;
    const categoryId = importElements.importCategory.value || null;

    showImportStep(3);
    importElements.progressText.textContent = `Importando ${playlist.title}...`;

    try {
        // Fetch all videos from playlist
        const videos = await fetchPlaylistVideos(playlist.id);

        importElements.progressText.textContent = `Obteniendo detalles de ${videos.length} videos...`;

        // Get video details (duration, likes, etc.)
        const videoIds = videos.map(v => v.videoId).join(',');
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${appState.apiKey}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        // Merge details
        const detailsMap = {};
        if (detailsData.items) {
            detailsData.items.forEach(item => {
                const duration = parseDuration(item.contentDetails.duration);
                detailsMap[item.id] = {
                    duration: formatDuration(duration),
                    durationMinutes: Math.round(duration / 60),
                    likes: parseInt(item.statistics.likeCount) || 0,
                    views: parseInt(item.statistics.viewCount) || 0
                };
            });
        }

        // Create video objects
        const newVideos = videos.map((video, index) => {
            const details = detailsMap[video.videoId] || {};
            const category = categoryId ? videosData.categories.find(c => c.id === categoryId) : null;

            return {
                id: appState.videos.length + index,
                categoryId: categoryId,
                category: category,
                title: video.title,
                author: video.channelTitle,
                summary: video.description ? video.description.substring(0, 300) + '...' : 'Sin descripción',
                youtubeId: video.videoId,
                url: `https://www.youtube.com/watch?v=${video.videoId}`,
                thumbnail: video.thumbnail,
                ...details,
                imported: true,
                playlistName: playlist.title
            };
        });

        // Add to state
        appState.videos.push(...newVideos);
        appState.filteredVideos = [...appState.videos];

        // Save imported videos to localStorage
        saveImportedVideos();

        // Re-render
        populateFilters();
        renderVideos();
        updateStats();

        // Show success and close
        closeImportModal();
        alert(`¡Importados ${newVideos.length} videos de "${playlist.title}"!`);

    } catch (error) {
        console.error('Error importing playlist:', error);
        showImportStep(2);
        alert('Error al importar la playlist: ' + error.message);
    }
}

async function fetchPlaylistVideos(playlistId) {
    const videos = [];
    let nextPageToken = '';

    do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${appState.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (data.items) {
            videos.push(...data.items.map(item => ({
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                channelTitle: item.snippet.videoOwnerChannelTitle,
                thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url
            })));
        }

        nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);

    return videos;
}

function saveImportedVideos() {
    const importedVideos = appState.videos.filter(v => v.imported);
    localStorage.setItem('imported_videos', JSON.stringify(importedVideos));
}

function loadImportedVideos() {
    const saved = localStorage.getItem('imported_videos');
    if (saved) {
        try {
            const importedVideos = JSON.parse(saved);
            importedVideos.forEach(video => {
                video.id = appState.videos.length;
                video.category = video.categoryId ? videosData.categories.find(c => c.id === video.categoryId) : null;
                appState.videos.push(video);
            });
            appState.filteredVideos = [...appState.videos];
        } catch (e) {
            console.error('Error loading imported videos:', e);
        }
    }
}

function showImportError(message) {
    // Find the active step to show error
    const activeStep = importElements.stepAuth.style.display !== 'none'
        ? importElements.stepAuth
        : importElements.step1;

    // Remove existing error
    const existingError = activeStep.querySelector('.error-message');
    if (existingError) existingError.remove();

    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    const buttons = activeStep.querySelector('.modal-buttons');
    if (buttons) {
        activeStep.insertBefore(errorDiv, buttons);
    } else {
        activeStep.appendChild(errorDiv);
    }

    // Remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

// Initialize import functionality when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupImportListeners();
    loadImportedVideos();
    initGoogleAuth();
});
