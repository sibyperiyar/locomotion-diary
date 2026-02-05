// Imports removed for standard script support (Globals: DiaryStore, parseTimeline)


// --- Constants & Config ---
// --- Constants & Config ---

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const viewOnboarding = document.getElementById('view-onboarding');
const viewBook = document.getElementById('view-book');
const bookContent = document.getElementById('book-content');

// Global State
let currentEntries = []; // Keeps track of currently loaded view
let currentRenderedEntries = [];
let currentPage = 1;

let PAGE_SIZE = 20;
let currentSort = localStorage.getItem('diary_sort_order') || 'desc'; // 'desc' (newest) or 'asc' (oldest)

// Expose globals for HTML event handlers (since Module scope is private)
// Expose globals for HTML event handlers
window.promptSavePlace = promptSavePlace;
window.openMap = openMap;
window.renderBook = renderBook;

// Initialize DB on Load
// Initialize DB (Called by auth.js)
window.startApp = async function () {
    // --- AUTHENTICATION CHECK ---
    const authScreen = document.getElementById('app-lock-screen');
    const pwdInput = document.getElementById('auth-password');
    const btnUnlock = document.getElementById('btn-unlock-app');
    const authError = document.getElementById('auth-error');
    const authTitle = document.getElementById('lock-title');
    const authMsg = document.getElementById('lock-message');
    const authSetupNote = document.getElementById('auth-setup-note');

    // --- STARTUP LOGIC ---
    authScreen.style.display = 'none';

    try {
        await DiaryStore.open();
        const years = await DiaryStore.getAllYears();

        if (years.length > 0) {
            // Check for saved year
            const lastYear = localStorage.getItem('lastVisitedYear');
            if (lastYear && years.includes(parseInt(lastYear))) {
                loadYear(lastYear);
            } else {
                // Auto-load the latest year
                loadYear(years[0]);
            }
        } else {
            console.log("No data found, showing empty book.");
            switchView('book');
            renderBook([], true);
        }
    } catch (e) {
        console.error("DB Init Failed", e);
    }

    // DB Init done.
};



async function loadYear(year) {
    // Save Persistence
    localStorage.setItem('lastVisitedYear', year);

    const entries = await DiaryStore.getEventsByYear(year);



    currentEntries = entries;

    // Apply Sort
    sortEntries(currentEntries);

    // Enrich with local known places
    enrichNarratives(currentEntries);
    checkForKnownPlaces(currentEntries);

    // Setup UI
    populateSearchFilters(currentEntries);
    document.getElementById('search-controls').style.display = 'flex'; // Fix: Unhide Search
    document.getElementById('pagination-controls').style.display = 'flex'; // Fix: Unhide Pagination
    renderBook(currentEntries);
    switchView('book');
    updateYearSwitcher(year);
}

// Year Switcher UI Helper
// Year Switcher UI Helper
async function updateYearSwitcher(currentYear) {
    let switcher = document.getElementById('year-switcher');

    // Create if not exists (Fallback)
    if (!switcher) {
        const header = document.querySelector('.header-left');
        switcher = document.createElement('select');
        switcher.id = 'year-switcher';
        switcher.className = 'nav-btn secondary';
        if (header) header.appendChild(switcher);
    }

    // Ensure styles are nice (in case JS created it or CSS missing)
    // But mainly relies on CSS now.

    // ATTACH IDEMPOTENT LISTENER (remove old to be safe or just set onchange)
    switcher.onchange = (e) => {
        loadYear(e.target.value);
    };

    // Evaluate available years again
    const years = await DiaryStore.getAllYears();
    switcher.innerHTML = '';

    // EMPTY STATE HANDLING FOR SWITCHER
    if (years.length === 0) {
        const op = document.createElement('option');
        op.value = "";
        op.textContent = "📅 No Data";
        switcher.appendChild(op);
        switcher.disabled = true;
    } else {
        switcher.disabled = false;
        years.forEach(y => {
            const op = document.createElement('option');
            op.value = y;
            op.textContent = `📅 ${y}`;
            if (parseInt(y) === parseInt(currentYear)) op.selected = true;
            switcher.appendChild(op);
        });
    }
}

// --- Parser Logic ---
// logic imported from parser.js



// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// --- Language Management ---
function initLanguage() {
    const savedLang = localStorage.getItem('lang') || 'en';
    const switcher = document.getElementById('lang-switcher');
    if (switcher) switcher.value = savedLang;
    setLanguage(savedLang);

    // Listener
    if (switcher) {
        switcher.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
}

function setLanguage(lang) {
    if (!window.translations || !window.translations[lang]) return;

    // Save preference
    localStorage.setItem('lang', lang);

    // Update Text Content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });

    // Update Titles (for buttons with icons)
    document.querySelectorAll('[title]').forEach(el => {
        // This is a rough heuristic since we didn't add data-i18n to titles yet
        // For now, we only update explicit text content. 
        // Future: Add data-i18n-title attribute.
    });

    // Special case for Theme Button Icon which is dynamic
    updateThemeIcon(document.documentElement.getAttribute('data-theme'));
}

// Initialize Theme
initTheme();
// Initialize Language
initLanguage();

"use strict";
// V5 DEBUG

// Ensure global access
window.fetchWeatherForCurrentView = fetchWeatherForCurrentView;

// --- Event Listeners ---

// Prevent default browser behavior (opening file) for the entire document
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
});

// DEBUG: Verify App Loads
console.log('Locomotion Diary: App JS Loaded');
// alert("App Loaded!"); // Uncomment if needed for extreme debugging

// Safer Event Delegation for DropZone
// Safer Event Delegation for DropZone - REMOVED to prevent double triggering with switchView logic
// document.addEventListener('click', (e) => { ... });

// Restored Listener
if (dropZone) {
    dropZone.addEventListener('click', () => {
        const input = document.getElementById('file-input');
        if (input) input.click();
    });
}

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Keep specific styling logic
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    // Support drop anywhere in the dropzone
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

// Navigation Listeners
if (document.getElementById('btn-import')) {
    document.getElementById('btn-import').addEventListener('click', () => {
        // Show Cancel button always
        const cancelDiv = document.getElementById('import-actions');
        if (cancelDiv) cancelDiv.style.display = 'block';

        switchView('onboarding');
    });
}

if (document.getElementById('btn-cancel-import')) {
    document.getElementById('btn-cancel-import').addEventListener('click', () => {
        switchView('book');
    });
}
if (document.getElementById('btn-archives')) {
    document.getElementById('btn-archives').addEventListener('click', () => {
        switchView('archives');
        // Render archives if needed
        if (typeof renderArchives === 'function') renderArchives();
        else {
            // Basic fallback if renderArchives isn't global
            const grid = document.getElementById('archives-grid');
            if (grid && window.DiaryStore) {
                window.DiaryStore.getAllYears().then(years => {
                    // Simple render
                    grid.innerHTML = years.map(y => `<div class="month-card" onclick="loadYear(${y})"><h3>${y}</h3></div>`).join('');
                });
            }
        }
    });
}

// Map / Locations View
if (document.getElementById('btn-locations')) {
    document.getElementById('btn-locations').addEventListener('click', openLocationManager);
}

if (document.getElementById('btn-photos')) {
    document.getElementById('btn-photos').addEventListener('click', () => {
        if (PhotoManager && PhotoManager.isSupported()) {
            PhotoManager.selectDirectory();
        } else {
            alert("Your browser does not support Local File Access (Chromium required).");
        }
    });
}

if (document.getElementById('btn-theme')) {
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
}

if (document.getElementById('btn-stats')) {
    document.getElementById('btn-stats').addEventListener('click', () => {
        if (!currentEntries || currentEntries.length === 0) {
            alert("No data available for stats. Please load a year first.");
            return;
        }
        switchView('analytics');
    });
}

// --- Settings & Update Logic ---
const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnCheckUpdates = document.getElementById('btn-check-updates');
const inputUpdateUrl = document.getElementById('setting-update-url');
const versionDisplay = document.getElementById('settings-version-display');

if (btnSettings && settingsModal) {
    btnSettings.addEventListener('click', () => {
        // Init Settings UI
        if (typeof APP_VERSION !== 'undefined') {
            versionDisplay.textContent = `Version ${APP_VERSION}`;
        } else {
            versionDisplay.textContent = "Version: Unknown";
        }

        const savedUrl = localStorage.getItem('update_url') || DEFAULT_UPDATE_URL || "";
        inputUpdateUrl.value = savedUrl;

        // Load Radius
        const currentRadius = getMatchRadius(); // Now reads from LS or default
        const inputRadius = document.getElementById('setting-radius');
        if (inputRadius) inputRadius.value = currentRadius;

        settingsModal.style.display = 'flex';
    });
}

// Logic for Analytics Settings Button duplicate
const btnAnalyticsSettings = document.getElementById('btn-analytics-settings');
if (btnAnalyticsSettings) {
    btnAnalyticsSettings.addEventListener('click', () => {
        // Open same modal
        if (btnSettings) btnSettings.click();
    });
}

if (btnSettingsClose) {
    btnSettingsClose.addEventListener('click', () => {
        // Save Settings
        const url = inputUpdateUrl.value.trim();
        if (url) {
            localStorage.setItem('update_url', url);
        }

        // Save Radius
        const inputRadius = document.getElementById('setting-radius');
        if (inputRadius) {
            const val = parseInt(inputRadius.value);
            if (!isNaN(val) && val > 0) {
                const oldVal = getMatchRadius();
                if (val !== oldVal) {
                    localStorage.setItem('locomotion_radius', val);
                    alert(`Radius updated to ${val}m. Reloading...`);
                    location.reload();
                    return; // Stop further closing, reload happens
                }
            } else {
                alert("Invalid Radius. Must be > 0.");
                return;
            }
        }

        settingsModal.style.display = 'none';
    });
}

if (btnCheckUpdates) {
    btnCheckUpdates.addEventListener('click', async () => {
        const url = inputUpdateUrl.value.trim();
        if (!url) {
            alert("Please enter a valid Update Server URL.");
            return;
        }

        btnCheckUpdates.disabled = true;
        btnCheckUpdates.textContent = "Checking...";

        try {
            const response = await fetch(url + '?t=' + new Date().getTime()); // Prevent caching
            if (!response.ok) throw new Error("Server not reachable");

            const data = await response.json();
            // Expected JSON: { "version": "1.0.2", "notes": "...", "downloadUrl": "..." }

            const remoteVersion = data.version;
            const currentVersion = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : "0.0.0";

            if (compareVersions(remoteVersion, currentVersion) > 0) {
                const doUpdate = confirm(`New Version Available: ${remoteVersion}\n\nNotes: ${data.notes || "No notes"}\n\nDownload now?`);
                if (doUpdate && data.downloadUrl) {
                    window.open(data.downloadUrl, '_blank');
                }
            } else {
                alert("You are on the latest version.");
            }

        } catch (e) {
            alert("Update Check Failed: " + e.message);
        } finally {
            btnCheckUpdates.disabled = false;
            btnCheckUpdates.textContent = "🔄 Check for Updates";
        }
    });
}

// Manual Force Reload
if (document.getElementById('btn-force-reload')) {
    document.getElementById('btn-force-reload').addEventListener('click', async () => {
        if (confirm("Reload the app to get the latest version?")) {
            // Try to unregister SW to force fresh start
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }
            window.location.reload();
        }
    });
}

function compareVersions(v1, v2) {
    // Simple semver comparison
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}



// PDF Export
if (document.getElementById('btn-export')) {
    document.getElementById('btn-export').addEventListener('click', () => {
        const overlay = document.getElementById('export-overlay');
        if (overlay) overlay.style.display = 'flex';

        // 1. Save State
        const originalPageSize = PAGE_SIZE;
        const originalPage = currentPage;

        // 2. Prepare for Print (Show All)
        PAGE_SIZE = 100000; // Effectively infinite
        currentPage = 1;
        const dataToRender = currentRenderedEntries || currentEntries;
        renderBook(dataToRender); // Force full render

        // 3. Inject Extras (TOC & Annexure)
        // CRITICAL: Flip Sort Order for PDF (Oldest -> Newest)
        // Since UI is Newest -> Oldest, we verify the first item.
        // If dataToRender[0] > dataToRender[last], it's Descending.
        if (dataToRender.length > 1) {
            const first = new Date(dataToRender[0].startTime);
            const last = new Date(dataToRender[dataToRender.length - 1].startTime);
            if (first > last) {
                // It is Descending, so Reverse it for Book
                dataToRender.reverse();
            }
        }

        const tocHTML = generateTOC(dataToRender);
        const annexureHTML = generateLocationAnnexure(dataToRender);

        const bookContent = document.getElementById('book-content');
        if (bookContent) {
            // Prepend TOC
            const tocDiv = document.createElement('div');
            tocDiv.id = 'print-toc-container';
            tocDiv.innerHTML = tocHTML;
            bookContent.prepend(tocDiv);

            // Append Annexure
            const annexDiv = document.createElement('div');
            annexDiv.id = 'print-annex-container';
            annexDiv.innerHTML = annexureHTML;
            bookContent.appendChild(annexDiv);
        }

        // 4. Print
        requestAnimationFrame(() => {
            setTimeout(() => {
                window.print();

                // 5. Restore State (after print dialog closes)
                if (overlay) overlay.style.display = 'none';
                PAGE_SIZE = originalPageSize;
                currentPage = originalPage;
                renderBook(dataToRender); // Restore view (removes injected divs)
            }, 500);
        });
    });
}

if (document.getElementById('btn-export-json')) {
    document.getElementById('btn-export-json').addEventListener('click', () => exportData());
}

// Search Listeners
if (document.getElementById('btn-sort')) {
    const btn = document.getElementById('btn-sort');
    // Set initial icon
    btn.textContent = currentSort === 'desc' ? '⬇️ Sort' : '⬆️ Sort';

    btn.addEventListener('click', () => {
        currentSort = currentSort === 'desc' ? 'asc' : 'desc';
        localStorage.setItem('diary_sort_order', currentSort);
        btn.textContent = currentSort === 'desc' ? '⬇️ Sort' : '⬆️ Sort';

        // Re-sort and Render
        /* 
           Crucial: We re-sort `currentRenderedEntries` if specific view,
           OR `currentEntries` if general. 
           Usually we want to re-sort the *currently active filtered list*.
           So let's apply sort to currentRenderedEntries and re-render.
           Wait, `currentRenderedEntries` is just the visible set? 
           No, usually we want to resort the whole potentially filtered set.
           Actually `currentRenderedEntries` in `renderBook` logic *usually* meant 
           "the set of entries passed to renderBook".
           But in `applyFilters` we filter `currentEntries` into a subset.
           Let's assume we want to re-run the render loop.
        */

        // If filters are active, we should re-apply filters (which calls sort).
        // But `applyFilters` reads DOM inputs. That's fine.
        // Or we can just sort `currentRenderedEntries`?
        // Let's modify `sortEntries` to be a helper we can call on any array.

        // Simpler: Just re-apply whatever state we are in.
        // If searching: applyFilters()
        // If browsing year: loadYear() NO that reloads DB.

        // FAST PATH: Re-sort `currentRenderedEntries` (which holds the full filtered dataset ideally)
        // Let's check `renderBook`. It sets `currentRenderedEntries = entries` if resetPage=true.
        // Yes, `currentRenderedEntries` holds the full dataset being paginated.
        sortEntries(currentRenderedEntries);
        renderBook(currentRenderedEntries, true);
    });
}

function sortEntries(entries) {
    if (!entries) return;
    entries.sort((a, b) => {
        const da = new Date(a.startTime);
        const db = new Date(b.startTime);
        return currentSort === 'desc' ? db - da : da - db;
    });
}

// Function alias for Search Filter to use
// Filter Logic is defined below (search for applyFilters)

if (document.getElementById('btn-filter')) {
    document.getElementById('btn-filter').addEventListener('click', applyFilters);
}
if (document.getElementById('btn-clear-filter')) {
    document.getElementById('btn-clear-filter').addEventListener('click', () => {
        document.getElementById('search-date-from').value = '';
        document.getElementById('search-date-to').value = '';
        document.getElementById('search-location').value = '';
        renderBook(currentEntries, true);
    });
}

// Pagination Listeners
document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderBook(currentRenderedEntries, false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

document.getElementById('btn-next-page')?.addEventListener('click', () => {
    const maxPage = Math.ceil(currentRenderedEntries.length / PAGE_SIZE);
    if (currentPage < maxPage) {
        currentPage++;
        renderBook(currentRenderedEntries, false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

document.getElementById('btn-goto')?.addEventListener('click', () => {
    const input = document.getElementById('goto-input');
    const val = parseInt(input.value);
    const maxPage = Math.ceil(currentRenderedEntries.length / PAGE_SIZE);

    if (val >= 1 && val <= maxPage) {
        currentPage = val;
        renderBook(currentRenderedEntries, false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        alert(`Please enter a page between 1 and ${maxPage}`);
    }
});

// Locations Button
if (document.getElementById('btn-locations')) {
    document.getElementById('btn-locations').addEventListener('click', () => {
        openLocationManager();
    });
}
// Back from Locations
if (document.getElementById('btn-back-loc')) {
    document.getElementById('btn-back-loc').addEventListener('click', () => {
        switchView('book');
    });
}
// Back from Archives (FIX)
if (document.getElementById('btn-back-arch')) {
    document.getElementById('btn-back-arch').addEventListener('click', () => {
        switchView('book');
    });
}

// Global Delegation for Edit Buttons
if (bookContent) {
    bookContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            const lat = parseFloat(e.target.dataset.lat);
            const lng = parseFloat(e.target.dataset.lng);
            const name = e.target.dataset.name;

            if (isNaN(lat) || isNaN(lng)) {
                alert("Cannot edit this location because it has no GPS data (Red Pencil).\n\nLocomotion Diary needs coordinates to save a 'Known Place'.");
            } else {
                promptSavePlace(lat, lng, name);
            }
        } else if (e.target.classList.contains('debug-btn') || e.target.closest('.debug-btn')) {
            const btn = e.target.classList.contains('debug-btn') ? e.target : e.target.closest('.debug-btn');
            const ts = btn.dataset.ts;
            if (window.debugEntries && window.debugEntries[ts]) {
                alert('Raw JSON Data:\n' + JSON.stringify(window.debugEntries[ts], null, 2));
            } else {
                alert('Debug data not found for timestamp: ' + ts);
            }
        }
    });
}

// Table Delegation
const locTableBody = document.getElementById('locations-table-body');
if (locTableBody) {
    locTableBody.addEventListener('click', (e) => {
        // Handle Button or Icon inside button
        const btn = e.target.closest('.action-btn');
        if (btn) {
            const lat = parseFloat(btn.dataset.lat);
            const lng = parseFloat(btn.dataset.lng);
            const name = btn.dataset.name;
            promptSavePlace(lat, lng, name);
        }
    });
}

// --- Manual Entry Logic ---
const btnAddEntry = document.getElementById('btn-add-entry');
const manualModal = document.getElementById('manual-entry-modal');
const btnCancelEntry = document.getElementById('btn-cancel-entry');
const manualForm = document.getElementById('manual-entry-form');

if (btnAddEntry && manualModal) {
    // Open Modal
    btnAddEntry.addEventListener('click', () => {
        manualModal.style.display = 'flex';
        // Set default date to today or currently viewed year context?
        // Set Default Date Logic
        // 1. Try to get date from the top visible entry
        /*
           We interpret 'top visible' as the first entry in the current page view.
           Since pagination slices `currentRenderedEntries` by `PAGE_SIZE` and `currentPage`.
        */
        let defaultDate = new Date().toISOString().split('T')[0];

        if (window.currentRenderedEntries && window.currentRenderedEntries.length > 0) {
            const startIndex = (currentPage - 1) * PAGE_SIZE;
            /* 
               With Descending Sort (Newest First), the first item is the LATEST date. 
               Use that.
            */
            if (window.currentRenderedEntries[startIndex]) {
                try {
                    defaultDate = new Date(window.currentRenderedEntries[startIndex].startTime).toISOString().split('T')[0];
                } catch (e) { console.error("Error setting default date", e); }
            }
        }

        document.getElementById('entry-date').value = defaultDate;
    });

    // Close Modal
    if (btnCancelEntry) {
        btnCancelEntry.addEventListener('click', () => {
            manualModal.style.display = 'none';
            manualForm.reset();
            // Clear Datasets
            ['entry-loc-name', 'entry-start-loc', 'entry-end-loc'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { delete el.dataset.lat; delete el.dataset.lng; }
            });
        });
    }

    // Tab Switching
    const tabs = manualModal.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // UI Toggle
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const type = tab.dataset.tab;
            document.getElementById('entry-type').value = type;

            // Field Toggle
            if (type === 'stationary') {
                document.getElementById('fields-stationary').style.display = 'block';
                document.getElementById('fields-moving').style.display = 'none';
            } else {
                document.getElementById('fields-stationary').style.display = 'none';
                document.getElementById('fields-moving').style.display = 'block';
            }
        });
    });

    // Form Submit
    if (manualForm) {
        manualForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Gather Data
            const formData = {
                type: document.getElementById('entry-type').value,
                date: document.getElementById('entry-date').value,
                startTime: document.getElementById('entry-start-time').value,
                endTime: document.getElementById('entry-end-time').value,

                // Stationary
                locationName: document.getElementById('entry-loc-name').value,
                lat: document.getElementById('entry-lat').value || 0, // Default 0 if no picker used (TODO: Map Picker)
                lng: document.getElementById('entry-lng').value || 0,

                // Moving
                startLocName: document.getElementById('entry-start-loc').value,
                endLocName: document.getElementById('entry-end-loc').value,
                activityType: document.getElementById('entry-activity').value,
                // Moving Coords (Read from dataset if available)
                startLat: document.getElementById('entry-start-loc').dataset.lat || 0,
                startLng: document.getElementById('entry-start-loc').dataset.lng || 0,
                endLat: document.getElementById('entry-end-loc').dataset.lat || 0,
                endLng: document.getElementById('entry-end-loc').dataset.lng || 0,

                description: document.getElementById('entry-desc').value
            };

            try {
                // Create Event Object
                const newEvent = ManualEntry.create(formData);
                console.log("New Manual Entry:", newEvent);

                // Save to DB
                if (window.DiaryStore) {
                    await window.DiaryStore.addEvents([newEvent]);

                    // Refresh View
                    alert("Entry Saved!");
                    manualModal.style.display = 'none';
                    manualForm.reset();
                    // Clear Datasets
                    ['entry-loc-name', 'entry-start-loc', 'entry-end-loc'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) { delete el.dataset.lat; delete el.dataset.lng; }
                    });

                    // Reload current year
                    const year = new Date(formData.date).getFullYear();
                    // Just reload the view safely
                    if (typeof loadYear === 'function') loadYear(year.toString());

                } else {
                    alert("Database Error: DiaryStore not available.");
                }

            } catch (err) {
                alert("Error creating entry: " + err.message);
                console.error(err);
            }
        });
    }

    // Map Picker Logic
    let pickerMap = null;
    let pickerMarker = null;
    let pickerCallback = null;
    let pickerCloseCallback = null;

    const pickerModal = document.getElementById('location-picker-modal');

    // --- SERVICE WORKER UPDATE NOTIFICATION LOGIC ---
    let newWorker;
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.addEventListener('updatefound', () => {
                newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New Update Available
                        showUpdateNotification();
                    }
                });
            });
        });

        // Also check if controller changes (immediate reload from Claim)
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }

    function showUpdateNotification() {
        const notif = document.getElementById('update-notification');
        if (notif) notif.style.display = 'flex';

        const btnRefresh = document.getElementById('btn-refresh-app');
        if (btnRefresh) {
            btnRefresh.onclick = () => {
                if (newWorker) {
                    newWorker.postMessage({ action: 'skipWaiting' });
                }
                window.location.reload();
            };
        }

        const btnDismiss = document.getElementById('btn-dismiss-update');
        if (btnDismiss) {
            btnDismiss.onclick = () => {
                notif.style.display = 'none';
            };
        }
    }
    const btnPickerConfirm = document.getElementById('btn-picker-confirm');
    const btnPickerCancel = document.getElementById('btn-picker-cancel');

    // Initialize Map on first use
    function initPickerMap() {
        if (pickerMap) return; // Already init
        if (typeof L === 'undefined') {
            alert("Leaflet Map Library not loaded.");
            return;
        }

        // Default view: World or current user location if known?
        // Let's start at Null Island or last known entry location?
        // Default: 0, 0 zoom 2
        pickerMap = L.map('picker-map').setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(pickerMap);

        pickerMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            setPickerMarker(lat, lng);
        });
    }

    function setPickerMarker(lat, lng) {
        if (!pickerMap) return;
        if (pickerMarker) {
            pickerMarker.setLatLng([lat, lng]);
        } else {
            pickerMarker = L.marker([lat, lng]).addTo(pickerMap);
        }
        pickerMap.setView([lat, lng], pickerMap.getZoom()); // Center but keep zoom
    }

    function openLocationPicker(onSelect) {
        pickerModal.style.display = 'flex';
        pickerModal.style.zIndex = '10010'; // Ensure above Manual Entry
        pickerCallback = onSelect;

        // Init map if needed
        setTimeout(() => {
            initPickerMap();
            pickerMap.invalidateSize(); // Fix gray map issue

            // Try to find a good starting point?
            // If they are editing, maybe pass current coords?
            // For now, if we have entries, center on the last entry?
            if (window.currentEntries && window.currentEntries.length > 0) {
                const last = window.currentEntries[window.currentEntries.length - 1];
                const lat = last.lat || last.endLat;
                const lng = last.lng || last.endLng;
                if (lat && lng) pickerMap.setView([lat, lng], 10);
            }
        }, 100);
    }

    if (pickerModal) {
        btnPickerConfirm.addEventListener('click', () => {
            if (pickerMarker && pickerCallback) {
                const { lat, lng } = pickerMarker.getLatLng();
                // Reverse Geocode? (Feature Creep) - Just use Lat/Lng for now
                // Or "Selected Location (Lat, Lng)"
                const name = `Selected Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
                pickerCallback(lat, lng, name);
            }
            pickerModal.style.display = 'none';
        });

        btnPickerCancel.addEventListener('click', () => {
            pickerModal.style.display = 'none';
        });
    }

    // Wire Buttons
    // Stationary Location
    const btnPickLoc = document.getElementById('btn-pick-loc');
    if (btnPickLoc) {
        btnPickLoc.addEventListener('click', () => {
            openLocationPicker((lat, lng, name) => {
                document.getElementById('entry-lat').value = lat;
                document.getElementById('entry-lng').value = lng;
                const nameInput = document.getElementById('entry-loc-name');
                if (!nameInput.value) nameInput.value = name;
            });
        });
    }

    // Moving Start
    const btnPickStart = document.getElementById('btn-pick-start');
    if (btnPickStart) {
        btnPickStart.addEventListener('click', () => {
            openLocationPicker((lat, lng, name) => {
                // We don't have hidden lat/lng inputs for Moving start/end in the HTML yet!
                // We need to add them or just store them in dataset or create hidden inputs.
                // The logical existing logic uses 'startLat', 'startLng' in formData.

                // Let's create hidden inputs locally if they don't exist?
                // OR better: add them to HTML. 
                // But for now, let's just stick them on the Name Input as dataset
                // AND update ManualEntry.create to read them.

                // WAIT: The ManualEntry.create reads 'startLat', 'startLng' from formData, 
                // but currently defaults them to 0. 
                // We need HIDDEN INPUTS in the form.

                const input = document.getElementById('entry-start-loc');
                input.value = name;
                input.dataset.lat = lat;
                input.dataset.lng = lng;
            });
        });
    }

    // Moving End
    const btnPickEnd = document.getElementById('btn-pick-end');
    if (btnPickEnd) {
        btnPickEnd.addEventListener('click', () => {
            openLocationPicker((lat, lng, name) => {
                const input = document.getElementById('entry-end-loc');
                input.value = name;
                input.dataset.lat = lat;
                input.dataset.lng = lng;
            });
        });
    }
}

// --- App Logic ---

// --- App Logic ---

// Note: handleFile logic was moved/redefined below. 
// Use the new handleFile function for imports.


// Modified Handle File: Parse -> Show Modal -> Import
let pendingImportData = null; // Staging area

async function handleFile(file) {
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
        alert("Please select a JSON file.");
        return;
    }

    // Show Parsing...
    // TODO: Better UI feedback
    console.log("Reading file...");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const entries = await parseTimeline(text); // Global function
            console.log(`Parsed ${entries.length} entries.`);

            if (entries.length === 0) {
                alert("No valid entries found in file.");
                return;
            }

            // Staging
            pendingImportData = entries;

            // Show Import Modal
            const summary = `Found ${entries.length} events. Range: ${new Date(entries[0].startTime).toLocaleDateString()} to ${new Date(entries[entries.length - 1].startTime).toLocaleDateString()}`;
            document.getElementById('import-summary').innerText = summary;
            document.getElementById('import-modal').style.display = 'flex';

        } catch (err) {
            console.error("Parse Error", err);
            alert("Error parsing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

function resetDropZone() {
    dropZone.innerHTML = '<div class="icon">📂</div><p>Drag & Drop <strong>Records.json</strong> here</p><p class="small">or click to select file</p><input type="file" id="file-input" accept=".json" hidden>';
}

function openImportModal(entries) {
    const modal = document.getElementById('import-modal');
    const summary = document.getElementById('import-summary');
    const fromInput = document.getElementById('import-date-from');
    const toInput = document.getElementById('import-date-to');

    if (!modal) return;

    const startDate = new Date(entries[0].startTime);
    const endDate = new Date(entries[entries.length - 1].startTime);

    summary.innerHTML = `Found <strong>${entries.length}</strong> events.<br>Date Range: <strong>${startDate.toLocaleDateString()}</strong> to <strong>${endDate.toLocaleDateString()}</strong>`;

    // Pre-fill Date Inputs (ISO format YYYY-MM-DD)
    if (fromInput) fromInput.value = startDate.toISOString().split('T')[0];
    if (toInput) toInput.value = endDate.toISOString().split('T')[0];

    modal.style.display = 'flex';
}

// Logic to Confirm Import
// Import Modal Listeners
document.getElementById('btn-import-cancel').addEventListener('click', () => {
    document.getElementById('import-modal').style.display = 'none';
    resetDropZone();
    pendingImportData = null;
});

document.getElementById('btn-import-confirm').addEventListener('click', async () => {
    if (!pendingImportData) return;

    const modal = document.getElementById('import-modal');
    const modeBtn = document.querySelector('input[name="import-mode"]:checked');
    const mode = modeBtn ? modeBtn.value : 'merge'; // 'merge' or 'replace'

    // Date Filtering
    const fromVal = document.getElementById('import-date-from')?.value;
    const toVal = document.getElementById('import-date-to')?.value;

    let finalData = pendingImportData;

    if (fromVal || toVal) {
        const fromDate = fromVal ? new Date(fromVal) : new Date(0); // Epoch
        const toDate = toVal ? new Date(toVal) : new Date(8640000000000000); // Max Date
        // Set to end of day for 'to'
        toDate.setHours(23, 59, 59, 999);
        // Set to start of day for 'from'
        fromDate.setHours(0, 0, 0, 0);

        finalData = pendingImportData.filter(e => {
            const t = new Date(e.startTime);
            return t >= fromDate && t <= toDate;
        });
    }

    if (finalData.length === 0) {
        alert("No events match the selected date range.");
        return;
    }

    modal.style.display = 'none';
    dropZone.innerHTML = `<div class="icon">💾</div><p>Saving ${finalData.length} events...</p>`;

    try {
        if (mode === 'replace') {
            await DiaryStore.clearAllEvents();
        }

        // Logic for 'merge' is default (put overwrites IDs, but if IDs are time-based, duplicates overwrite)
        // Since we re-parse, parsed IDs are deterministic.
        // If we want to PRESERVE user notes, we need `mergeEvents`?
        // Let's use `mergeEvents` for both (if replace, we cleared already).

        await DiaryStore.mergeEvents(finalData);

        alert(`Successfully imported ${finalData.length} events.`);
        document.getElementById('import-modal').style.display = 'none';

        // Reload
        location.reload();

    } catch (e) {
        console.error("Import Failed", e);
        alert("Import Failed: " + e.message);
    } finally {
        resetDropZone();
        pendingImportData = null;
    }
});

// Global hook for the button (since we need access to 'entries')

document.getElementById('btn-enhance')?.addEventListener('click', () => {
    enhanceData(currentEntries);
});



// --- Enhancement Logic ---

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";
let isEnhancing = false;
let isPaused = false;
let shouldStop = false;

async function enhanceData(entries) {
    if (isEnhancing) return;
    isEnhancing = true;
    isPaused = false;
    shouldStop = false;

    const btnEnhance = document.getElementById('btn-enhance');
    const controls = document.getElementById('enhance-controls');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const progressBar = document.getElementById('enhance-progress');
    const progressFill = progressBar.querySelector('.fill');
    const progressText = progressBar.querySelector('.text');

    btnEnhance.classList.add('disabled');
    btnEnhance.style.display = 'none'; // Hide main button
    controls.style.display = 'inline-block'; // Show controls
    progressBar.style.display = 'inline-block';

    btnPause.replaceWith(btnPause.cloneNode(true)); // remove old listeners
    document.getElementById('btn-pause').addEventListener('click', () => {
        isPaused = !isPaused;
        document.getElementById('btn-pause').textContent = isPaused ? "▶ Resume" : "⏸ Pause";
    });

    btnStop.replaceWith(btnStop.cloneNode(true));
    document.getElementById('btn-stop').addEventListener('click', () => {
        if (confirm("Stop enhancement process?")) {
            shouldStop = true;
            isPaused = false; // Break out of pause loop if stopped
        }
    });


    // Find candidates for enhancement
    const candidates = [];

    entries.forEach(e => {
        if (e.type === 'stationary' && isGenericLocation(e.location.name) && e.lat && e.lng) {
            candidates.push({ entry: e, type: 'stationary' });
        }
        if (e.type === 'moving') {
            if (isGenericLocation(e.startLocation.name)) {
                const rawStart = e.details.startLocation;
                if (rawStart && rawStart.latitudeE7) {
                    candidates.push({
                        entry: e,
                        type: 'moving_start',
                        lat: rawStart.latitudeE7 / 1e7,
                        lng: rawStart.longitudeE7 / 1e7
                    });
                }
            }
            if (isGenericLocation(e.endLocation.name)) {
                const rawEnd = e.details.endLocation;
                if (rawEnd && rawEnd.latitudeE7) {
                    candidates.push({
                        entry: e,
                        type: 'moving_end',
                        lat: rawEnd.latitudeE7 / 1e7,
                        lng: rawEnd.longitudeE7 / 1e7
                    });
                }
            }
        }
    });

    console.log(`Found ${candidates.length} locations to enhance.`);

    if (candidates.length === 0) {
        alert("No entries require enhancement.");
        // Reset UI just in case
        isEnhancing = false;
        controls.style.display = 'none';
        progressBar.style.display = 'none';
        btnEnhance.style.display = 'inline-block';
        btnEnhance.classList.remove('disabled');
        return;
    }

    if (!confirm(`Found ${candidates.length} locations to enhance. Start process?`)) {
        // User saw progress bar setup, so we must reset it if they cancel
        isEnhancing = false;
        controls.style.display = 'none';
        progressBar.style.display = 'none';
        btnEnhance.style.display = 'inline-block';
        btnEnhance.classList.remove('disabled');
        return;
    }

    let processed = 0;
    for (const cand of candidates) {
        if (shouldStop) break;

        // Pause loop
        while (isPaused) {
            if (shouldStop) break;
            await new Promise(r => setTimeout(r, 500));
        }

        processed++;
        const pct = Math.round((processed / candidates.length) * 100);
        progressFill.style.width = `${pct}%`;
        progressText.textContent = `${processed}/${candidates.length}`;

        let lat, lng;
        if (cand.type === 'stationary') {
            lat = cand.entry.lat;
            lng = cand.entry.lng;
        } else {
            lat = cand.lat;
            lng = cand.lng;
        }

        if (!lat || !lng) continue;

        try {
            const data = await fetchLocationDetails(lat, lng);
            if (data && (data.name || data.address)) {
                let niceName = data.name;
                const addr = data.address || {};

                const poi = addr.amenity || addr.shop || addr.tourism || addr.office || addr.leisure || addr.building;
                if (!niceName && poi) niceName = poi;

                if (!niceName || !isNaN(parseInt(niceName))) {
                    const road = addr.road || addr.pedestrian || addr.highway || addr.street;
                    const area = addr.neighbourhood || addr.suburb || addr.village || addr.hamlet || addr.town || addr.city;

                    if (road && area) niceName = `${road}, ${area}`;
                    else if (area) niceName = area;
                    else if (road) niceName = road;
                    else if (data.display_name) niceName = data.display_name.split(',')[0];
                    else niceName = "Unknown Location";
                }

                if (cand.type === 'stationary') {
                    cand.entry.location.name = niceName;
                    cand.entry.location.address = data.display_name;
                    cand.entry.location.enriched = true;
                } else if (cand.type === 'moving_start') {
                    cand.entry.startLocation.name = niceName;
                } else if (cand.type === 'moving_end') {
                    cand.entry.endLocation.name = niceName;
                }
            }
        } catch (err) {
            console.warn("Enhance failed request", err);
        }

        await new Promise(r => setTimeout(r, 1200));
    }

    isEnhancing = false;
    isPaused = false;

    controls.style.display = 'none';
    progressBar.style.display = 'none';
    btnEnhance.style.display = 'inline-block';
    btnEnhance.classList.remove('disabled');

    if (shouldStop) {
        btnEnhance.textContent = "Enhance Stopped (Resume?)";
    } else {
        btnEnhance.textContent = "Enhancement Complete!";
        setTimeout(() => {
        }, 3000);
    }

    // Re-run enrichment and render
    entries = enrichNarratives(entries);
    renderBook(entries);
}

async function exportData(optionalData) {
    let dataToExport = [];
    let isPartial = false;

    if (optionalData && Array.isArray(optionalData) && optionalData.length > 0) {
        // Partial Export (e.g. Single Month from Archives)
        dataToExport = optionalData;
        isPartial = true;
        if (!confirm(`⚠️ EXPORT WARNING ⚠️\n\nThis will export ${dataToExport.length} entries as a JSON file.\nThe file will be UNENCRYPTED (Plain Text).\n\nDo you want to proceed?`)) return;
    } else {
        // Full Export
        if (!confirm("⚠️ FULL BACKUP WARNING ⚠️\n\nThis process will decrypt ALL your diary entries.\nIt may take some time.\n\nThe resulting JSON file is NOT ENCRYPTED.\nKeep it safe!\n\nProceed with full export?")) return;

        try {
            console.log("Starting full DB export...");
            const allYears = await DiaryStore.getAllYears();
            for (const y of allYears) {
                const yrEvents = await DiaryStore.getEventsByYear(y);
                dataToExport = dataToExport.concat(yrEvents);
            }

            if (dataToExport.length === 0) {
                alert("Database is empty. Nothing to export.");
                return;
            }
        } catch (e) {
            console.error("Export failed:", e);
            alert("Failed to fetch data from database: " + e.message);
            return;
        }
    }

    try {
        // Sort by time
        dataToExport.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        // Generate Filename from Range
        const getISODate = (d) => {
            try { return new Date(d).toISOString().split('T')[0]; } catch (e) { return 'unknown_date'; }
        };
        const start = getISODate(dataToExport[0].startTime);
        const end = getISODate(dataToExport[dataToExport.length - 1].startTime);

        let filename;
        if (isPartial) {
            filename = `diary_export_${start}_to_${end}.json`;
        } else {
            filename = `diary_complete_backup_${start}_to_${end}.json`;
        }

        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`Exported ${dataToExport.length} entries. (Partial: ${isPartial})`);
    } catch (e) {
        console.error("Export file generation failed", e);
        alert("Export failed during file generation: " + e.message);
    }
}

async function fetchLocationDetails(lat, lng) {
    // Cache check? (Simple in-memory for this session)
    // For now, direct call
    const url = `${NOMINATIM_BASE}?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'LocomotionDiary/1.0 (Local Personal Tool)'
        }
    });
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
}

function enrichNarratives(entries) {
    const radius = getMatchRadius(); // Use user-defined radius

    // First pass: Link generic locations to nearby known locations (Chaining)
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (entry.type === 'moving') {
            // 1. Check Previous (Start Location)
            if (i > 0) {
                const prev = entries[i - 1];
                let prevLat, prevLng, prevName, prevLink;

                if (prev.type === 'stationary') {
                    prevLat = prev.lat;
                    prevLng = prev.lng;
                    prevName = prev.location.name;
                    prevLink = prev.location.mapsLink;
                } else if (prev.type === 'moving') {
                    // Start of this = End of previous moving? (Rare but possible in raw data)
                    if (prev.details.endLocation && prev.details.endLocation.latitudeE7) {
                        prevLat = prev.details.endLocation.latitudeE7 / 1e7;
                        prevLng = prev.details.endLocation.longitudeE7 / 1e7;
                        prevName = prev.endLocation.name;
                        prevLink = prev.endLocation.mapsLink;
                    }
                }

                // Get Current Start Coords
                let curStartLat, curStartLng;
                if (entry.details.startLocation && entry.details.startLocation.latitudeE7) {
                    curStartLat = entry.details.startLocation.latitudeE7 / 1e7;
                    curStartLng = entry.details.startLocation.longitudeE7 / 1e7;
                }

                // Compare
                if (prevLat && prevLng && curStartLat && curStartLng) {
                    const dist = getDistanceFromLatLonInKm(prevLat, prevLng, curStartLat, curStartLng) * 1000;
                    if (dist <= radius && !isGenericLocation(prevName)) {
                        // Carry forward the name
                        entry.startLocation.name = prevName;
                        entry.startLocation.mapsLink = prevLink;
                    }
                }
                // Fallback: If no coords but strictly adjacent stationary
                else if (prev.type === 'stationary' && isGenericLocation(entry.startLocation.name)) {
                    entry.startLocation.name = prev.location.name;
                    entry.startLocation.mapsLink = prev.location.mapsLink;
                }
            }

            // 2. Check Next (End Location)
            if (i < entries.length - 1) {
                const next = entries[i + 1];
                let nextLat, nextLng, nextName, nextLink;

                if (next.type === 'stationary') {
                    nextLat = next.lat;
                    nextLng = next.lng;
                    nextName = next.location.name;
                    nextLink = next.location.mapsLink;
                }

                // Get Current End Coords
                let curEndLat, curEndLng;
                if (entry.details.endLocation && entry.details.endLocation.latitudeE7) {
                    curEndLat = entry.details.endLocation.latitudeE7 / 1e7;
                    curEndLng = entry.details.endLocation.longitudeE7 / 1e7;
                }

                // Compare
                if (nextLat && nextLng && curEndLat && curEndLng) {
                    const dist = getDistanceFromLatLonInKm(nextLat, nextLng, curEndLat, curEndLng) * 1000;
                    if (dist <= radius && !isGenericLocation(nextName)) {
                        // Carry backward the name
                        entry.endLocation.name = nextName;
                        entry.endLocation.mapsLink = nextLink;
                    }
                }
                // Fallback
                else if (next.type === 'stationary' && isGenericLocation(entry.endLocation.name)) {
                    entry.endLocation.name = next.location.name;
                    entry.endLocation.mapsLink = next.location.mapsLink;
                }
            }

            // 3. Fallback: Relative Distance Naming for Unknown End
            if (isGenericLocation(entry.endLocation.name)) {
                let sLat, sLng, eLat, eLng;
                if (entry.details.startLocation && entry.details.startLocation.latitudeE7) {
                    sLat = entry.details.startLocation.latitudeE7 / 1e7;
                    sLng = entry.details.startLocation.longitudeE7 / 1e7;
                }
                if (entry.details.endLocation && entry.details.endLocation.latitudeE7) {
                    eLat = entry.details.endLocation.latitudeE7 / 1e7;
                    eLng = entry.details.endLocation.longitudeE7 / 1e7;
                }

                if (sLat && sLng && eLat && eLng) {
                    const distKm = getDistanceFromLatLonInKm(sLat, sLng, eLat, eLng);
                    const distM = Math.round(distKm * 1000);

                    if (distM < 1000) {
                        entry.endLocation.name = `a location ${distM}m away (air distance)`;
                    } else {
                        entry.endLocation.name = `a location ${distKm.toFixed(1)}km away (air distance)`;
                    }
                }
            }
        }
    }

    // Second pass: Generate text
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        // Helpers for time/duration
        const timeStr = new Date(entry.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        // Narrative Logic
        if (entry.type === 'stationary') {
            const placeName = entry.location.name;
            const durStr = formatDuration(entry.startTime, entry.endTime);

            // "Arrived at [Place] at [Time]. Stayed for [Duration]."
            let placeDisplay = `<strong>${placeName}</strong>`;

            if (entry.location.mapsLink && entry.location.mapsLink !== '#') {
                placeDisplay = `<strong><a href="${entry.location.mapsLink}" target="_blank" style="color: inherit; text-decoration: underline;">${placeName}</a></strong>`;
            }

            // Save Button
            if (entry.lat && entry.lng) {
                placeDisplay += ` <span style="cursor:pointer; opacity:0.6; font-size:0.8em;" onclick="promptSavePlace(${entry.lat}, ${entry.lng}, '${placeName.replace(/'/g, "\\'")}')" title="Save this place">💾</span>`;
            }

            let text = `Arrived at ${placeDisplay} at ${timeStr}.`;

            // If duration is substantial
            if (durStr) {
                text += ` Stayed here for ${durStr}.`;
            }

            // Add context if available
            if (entry.location.address && entry.location.enriched) {
                text += ` <br><span style="font-size:0.9em; color:#666;">(${entry.location.address})</span>`;
            }

            entry.narrative = text;
        }
        else if (entry.type === 'moving') {
            const mode = (entry.activityType || 'MOVING').replace('IN_', '').replace('_', ' ').toLowerCase();
            const startName = entry.startLocation.name;
            const endName = entry.endLocation.name;
            const dist = entry.distance;

            let distText = "";
            if (dist > 1000) distText = `${(dist / 1000).toFixed(1)} km`;
            else if (dist > 0) distText = `${Math.round(dist)} m`;

            // Format Names with Links
            let startDisplay = `<strong>${startName}</strong>`;
            if (entry.startLocation.mapsLink && entry.startLocation.mapsLink !== "#") {
                startDisplay = `<strong><a href="${entry.startLocation.mapsLink}" target="_blank" style="color: inherit; text-decoration: underline;">${startName}</a></strong>`;
            }

            let endDisplay = `<strong>${endName}</strong>`;
            if (entry.endLocation.mapsLink && entry.endLocation.mapsLink !== "#") {
                endDisplay = `<strong><a href="${entry.endLocation.mapsLink}" target="_blank" style="color: inherit; text-decoration: underline;">${endName}</a></strong>`;
            }

            // "Left [Start] at [Time], traveling [Dist] by [Mode] to [End]."
            let text = `Left ${startDisplay} at ${timeStr}.`;
            if (distText) {
                text += ` Traveled ${distText} by <strong>${mode}</strong>`;
            } else {
                text += ` Traveled by <strong>${mode}</strong>`;
            }
            text += ` to ${endDisplay}.`;

            entry.narrative = text;
        }
    }
    return entries;
}

function formatDuration(start, end) {
    const diffMs = end - start;
    if (diffMs < 60000) return "a moment";
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;

    if (hrs > 0) return `${hrs} hr ${m} min`;
    return `${m} min`;
}

function isGenericLocation(name) {
    if (!name || name.trim() === '') return true;
    const n = name.toLowerCase();
    return n.includes('gps coordinates') || n.includes('unknown') || n.includes('°') || n.includes('click for map');
}

// Helper to switch views
// Helper to switch views (Dynamic & Robust)
// Helper to switch views (Dynamic & Robust)
function switchView(viewName) {
    console.log("Switching to view:", viewName);

    // 1. Hide all sections
    document.querySelectorAll('section').forEach(el => {
        el.classList.remove('active');
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.display = 'none'; // FORCE HIDE
    });

    // 2. Show target
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block'; // FORCE SHOW
        window.scrollTo(0, 0); // Ensure we start at the top
        // Small delay to allow display:block to apply before opacity transition if needed
        setTimeout(() => {
            target.style.opacity = '1';
        }, 10);
        target.style.pointerEvents = 'auto';

        // Special: Onboarding Logic
        if (viewName === 'onboarding') {
            // Back Button Visibility - ALWAYS SHOW (User might want to cancel import)
            const backBtnContainer = document.getElementById('import-actions');
            if (backBtnContainer) backBtnContainer.style.display = 'block';

            // Ensure Drop Zone Click works
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');


        }

        // Special: Stats Logic
        // Special: Analytics Logic
        if (viewName === 'analytics') {
            console.log("Switching to Analytics.");

            // 1. Verify Structure & Layout
            if (!document.getElementById('stat-cards')) {
                console.error("CRITICAL: Dashboard DOM structure missing!");
                const c = document.getElementById('analytics-content');
                if (c) c.innerHTML = "<p class='error' style='padding:2rem;color:red;'>Error: Dashboard structure missing. Please reloading the page (Ctrl+R).</p>";
                return;
            }

            if (typeof DiaryStats !== 'undefined' && currentEntries) {
                try {
                    const stats = DiaryStats.generate(currentEntries);
                    DiaryStats.render(stats, currentEntries); // Pass ENTRIES to render
                    console.log("Stats Rendered.");
                } catch (e) {
                    console.error("Stats Rendering Failed:", e);
                    const el = document.getElementById('analytics-content');
                    // Don't overwrite if partial render happened, but here we likely failed totally
                    if (el) el.innerHTML += `<p class="error">Render Error: ${e.message}</p>`;
                }
            } else {
                console.warn("Skipping stats: Missing module or data");
            }
        }
    } else {
        console.error("View not found:", viewName);
    }
}

// Global Listener for Back Button
document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
    switchView('book');
});

function renderBook(entries, resetPage = true) {
    // 1. Update State
    if (resetPage) {
        currentPage = 1;
        currentRenderedEntries = entries;
    }

    // 2. Update Count & Pagination UI
    const countEl = document.getElementById('event-count');
    if (countEl) countEl.innerText = `${entries.length} events found`;

    const totalPages = Math.ceil(entries.length / PAGE_SIZE);
    const pagControls = document.getElementById('pagination-controls');

    if (totalPages <= 1) {
        if (pagControls) pagControls.style.display = 'none';
    } else {
        if (pagControls) pagControls.style.display = 'flex';
        document.getElementById('page-info').innerText = `Page ${currentPage} of ${totalPages}`;
        document.getElementById('btn-prev-page').disabled = currentPage === 1;
        document.getElementById('btn-next-page').disabled = currentPage === totalPages;
    }

    // 3. Slice Data
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pageEntries = entries.slice(startIndex, endIndex);

    bookContent.innerHTML = '';

    // Group by Date
    const grouped = {};
    pageEntries.forEach(entry => {
        let dateKey = "Unknown Date";
        try {
            dateKey = new Date(entry.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) { console.error("Date error", e); }

        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
    });

    let lastRenderedMonth = null;

    for (const [date, dayEntries] of Object.entries(grouped)) {
        const daySection = document.createElement('div');
        daySection.className = 'diary-entry';

        // TOC Anchor / Month Header
        const d = new Date(dayEntries[0].startTime);
        const currentMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        const monthLabel = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

        if (currentMonthKey !== lastRenderedMonth) {
            const monthHeader = document.createElement('h2');
            monthHeader.className = 'month-separator-header';
            monthHeader.style.marginTop = '2rem';
            monthHeader.style.marginBottom = '1rem';
            monthHeader.style.borderBottom = '2px solid #ccc';
            monthHeader.style.color = '#444';

            // Legacy Anchor for PDF (Empty named anchor)
            const legacyAnchor = document.createElement('a');
            legacyAnchor.name = `month-${currentMonthKey}`;
            legacyAnchor.id = `month-${currentMonthKey}`;
            monthHeader.appendChild(legacyAnchor);

            const labelSpan = document.createElement('span');
            labelSpan.textContent = monthLabel;
            monthHeader.appendChild(labelSpan);

            bookContent.appendChild(monthHeader);

            lastRenderedMonth = currentMonthKey;
        }

        const dateHeader = document.createElement('h3');
        dateHeader.className = 'diary-date';
        dateHeader.style.display = 'flex';
        dateHeader.style.alignItems = 'center';
        dateHeader.style.flexWrap = 'wrap';

        // Weather Display
        let weatherHtml = '';
        const dayWeather = dayEntries.find(e => e.weather);
        if (dayWeather && dayWeather.weather) {
            weatherHtml = `<span style="font-size:0.8em; font-weight:normal; margin-left:10px;" title="Max: ${dayWeather.weather.tempMax}°C, Prcp: ${dayWeather.weather.precip}mm">${dayWeather.weather.icon} ${dayWeather.weather.tempMax}°C</span>`;
        }

        dateHeader.innerHTML = `${date} ${weatherHtml}`;

        // Photos Smart Link
        try {
            const d = new Date(dayEntries[0].startTime);
            const queryDate = String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
            const photoLinkHtml = `<a href="https://photos.google.com/search/${queryDate}" target="_blank" style="text-decoration:none; margin-left:10px; font-size: 0.8em;" title="View Photos from ${queryDate}">🖼️ Photos</a>`;
            dateHeader.innerHTML += ` ${photoLinkHtml}`;
        } catch (e) { }

        daySection.appendChild(dateHeader);

        // Day Route Button
        if (dayEntries.length > 0 && window.MapManager) {
            const btnRoute = document.createElement('button');
            btnRoute.className = 'nav-btn small';
            btnRoute.innerHTML = '🗺️ Route';
            btnRoute.style.fontSize = '0.8rem';
            btnRoute.style.marginLeft = '10px';
            btnRoute.onclick = () => MapManager.renderDailyRoute(dayEntries, date);
            dateHeader.appendChild(btnRoute);
        }

        // --- AI SUMMARY BUTTON ---
        const summaryBtn = document.createElement('button');
        summaryBtn.className = 'btn-summary';
        summaryBtn.innerHTML = '✨ Summarize Day';
        summaryBtn.style.fontSize = '0.8rem';
        summaryBtn.style.marginLeft = '10px';
        summaryBtn.style.border = '1px solid #ddd';
        summaryBtn.style.background = 'transparent';
        summaryBtn.style.cursor = 'pointer';
        summaryBtn.style.borderRadius = '12px';
        summaryBtn.style.padding = '2px 8px';

        const summaryBox = document.createElement('div');
        summaryBox.className = 'summary-box';
        summaryBox.style.display = 'none';
        summaryBox.style.background = 'var(--bg-paper-dark)'; // distinct background
        summaryBox.style.padding = '10px 15px';
        summaryBox.style.margin = '10px 0 20px 0';
        summaryBox.style.borderRadius = '8px';
        summaryBox.style.fontStyle = 'italic';
        summaryBox.style.borderLeft = '3px solid var(--accent-gold)';
        summaryBox.style.fontSize = '0.95rem';

        summaryBtn.onclick = async () => {
            if (window.DiaryAI) {
                const originalText = summaryBtn.innerHTML;
                summaryBtn.innerHTML = '✨ Thinking...';
                summaryBtn.disabled = true;

                try {
                    const text = await DiaryAI.summarizeDay(dayEntries);
                    summaryBox.innerText = text;
                    summaryBox.style.display = 'block';
                    summaryBtn.style.display = 'none'; // Hide button after success
                } catch (err) {
                    console.error("AI Summary Failed:", err);
                    summaryBtn.innerHTML = '⚠️ Error. Try Again?';
                    summaryBtn.disabled = false;
                }
            } else {
                alert("AI Module not loaded.");
            }
        };

        dateHeader.appendChild(summaryBtn);
        daySection.appendChild(summaryBox);
        // -------------------------

        // --- EMBEDDED PHOTOS (Async) ---
        if (window.PhotoManager && window.PhotoManager.dirHandle) {
            const photoGallery = document.createElement('div');
            photoGallery.className = 'photo-gallery-container';
            photoGallery.style.display = 'flex';
            photoGallery.style.gap = '8px';
            photoGallery.style.overflowX = 'auto';
            photoGallery.style.marginBottom = '1.5rem';
            photoGallery.style.marginTop = '-0.5rem';
            photoGallery.style.paddingBottom = '5px';
            daySection.appendChild(photoGallery);

            // Async Fetch (YYYY-MM-DD)
            const isoDate = new Date(dayEntries[0].startTime).toISOString().split('T')[0];

            PhotoManager.findPhotosByDate(isoDate).then(photos => {
                if (photos.length > 0) {
                    photos.forEach(p => {
                        const img = document.createElement('img');
                        img.src = p.url;
                        img.title = p.name;
                        img.style.height = '120px'; // Thumbnail height
                        img.style.borderRadius = '6px';
                        img.style.cursor = 'pointer';
                        img.style.objectFit = 'cover';
                        img.style.border = '1px solid #ddd';

                        // Click to view full (naive modal)
                        img.onclick = () => window.open(p.url, '_blank');

                        photoGallery.appendChild(img);
                    });
                } else {
                    photoGallery.remove(); // Remove if empty
                }
            });
        }
        // -------------------------------

        dayEntries.forEach(item => {
            const div = document.createElement('div');
            div.className = `diary-item ${item.type}`; // type is 'moving' or 'stationary'

            const timeSpan = document.createElement('span');
            timeSpan.className = 'time';
            try {
                const timeStr = new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                timeSpan.textContent = timeStr;
            } catch (e) { }

            const p = document.createElement('p');
            p.className = 'narrative';

            // Helper: Delete Button
            const getDeleteBtn = (id) => ` <button class="btn-delete-entry" data-id="${id}" title="Delete this entry">🗑️</button>`;

            // --- NOTE UI ---
            if (item.userNote) {
                const noteDiv = document.createElement('div');
                noteDiv.className = 'user-note';
                noteDiv.style.margin = '5px 0 10px 0';
                noteDiv.style.padding = '8px 12px';
                noteDiv.style.backgroundColor = '#fff9c4'; // Post-it yellow
                noteDiv.style.borderLeft = '4px solid #fbc02d';
                noteDiv.style.borderRadius = '4px';
                noteDiv.style.fontFamily = '"Comic Sans MS", cursive, sans-serif'; // "Handwritten" feel
                noteDiv.style.fontSize = '0.95em';
                noteDiv.style.color = '#333';
                noteDiv.innerHTML = `<strong>📝 Note:</strong> ${item.userNote.replace(/\n/g, '<br>')}`;

                // Click to edit
                noteDiv.title = "Click to edit note";
                noteDiv.style.cursor = "pointer";
                noteDiv.onclick = () => window.promptAddNote(item.id);

                div.appendChild(noteDiv);
            }

            // Helper to get Note Button HTML
            const getNoteBtn = (evtId) => {
                return ` <span class="note-btn" onclick="window.promptAddNote('${evtId}')" title="Add/Edit Note" style="cursor:pointer; font-size:1em; margin-left:5px;">📝</span>`;
            };

            // STATIONARY
            if (item.type === 'stationary') {
                const placeName = item.location.name;
                let placeDisplay = `<strong>${placeName}</strong>`;
                if (item.location.mapsLink && item.location.mapsLink !== '#') {
                    placeDisplay = `<strong><a href="${item.location.mapsLink}" target="_blank" style="color: inherit; text-decoration: underline;">${placeName}</a></strong>`;
                }
                // Edit/Save Button
                if (item.lat && item.lng) {
                    placeDisplay += ` <span class="edit-btn" data-lat="${item.lat}" data-lng="${item.lng}" data-name="${placeName.replace(/"/g, '&quot;')}" title="Correct/Save this name">✎</span>`;
                }
                // Add Note Button
                if (item.id) placeDisplay += getNoteBtn(item.id);
                // Delete Button
                if (item.id) placeDisplay += getDeleteBtn(item.id);

                const timeStr = new Date(item.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const durStr = formatDuration(item.startTime, item.endTime);
                let text = `Arrived at ${placeDisplay} at ${timeStr}.`;
                if (durStr) text += ` Stayed here for ${durStr}.`;
                if (item.location.address && item.location.enriched) text += ` <br><span style="font-size:0.9em; color:#666;">(${item.location.address})</span>`;

                p.innerHTML = text;
            }
            // MOVING
            else if (item.type === 'moving') {
                const timeStr = new Date(item.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const mode = (item.activityType || 'MOVING').replace('IN_', '').replace('_', ' ').toLowerCase();
                let startName = item.startLocation.name;
                let endName = item.endLocation.name;

                // Hide raw coordinates in display name
                if (isGenericLocation(startName) || startName.match(/-?\d+\.\d+,\s*-?\d+\.\d+/)) startName = "Unknown Location";
                if (isGenericLocation(endName) || endName.match(/-?\d+\.\d+,\s*-?\d+\.\d+/)) endName = "Unknown Location";

                const dist = item.distance;
                let distText = "";
                if (dist > 1000) distText = `${(dist / 1000).toFixed(1)} km`;
                else if (dist > 0) distText = `${Math.round(dist)} m`;

                // START
                let sLat, sLng;
                if (item.details.startLocation && item.details.startLocation.latitudeE7) {
                    sLat = item.details.startLocation.latitudeE7 / 1e7; sLng = item.details.startLocation.longitudeE7 / 1e7;
                } else if (item.startLat && item.startLng) {
                    sLat = item.startLat; sLng = item.startLng;
                }

                let startLink = item.startLocation.mapsLink;
                if ((!startLink || startLink === "#") && sLat && sLng) {
                    startLink = `https://www.google.com/maps/search/?api=1&query=${sLat},${sLng}`;
                }

                let startDisplay = `<strong>${startName}</strong>`;
                if (startLink && startLink !== "#") {
                    startDisplay = `<strong><a href="${startLink}" target="_blank" style="color: inherit; text-decoration: underline;">${startName}</a></strong>`;
                }
                if (sLat && sLng) {
                    startDisplay += ` <span class="edit-btn" data-lat="${sLat}" data-lng="${sLng}" data-name="${startName.replace(/"/g, '&quot;')}" title="Correct start location">✎</span>`;
                }

                // END
                let eLat, eLng;
                if (item.details.endLocation && item.details.endLocation.latitudeE7) {
                    eLat = item.details.endLocation.latitudeE7 / 1e7; eLng = item.details.endLocation.longitudeE7 / 1e7;
                } else if (item.endLat && item.endLng) {
                    eLat = item.endLat; eLng = item.endLng;
                }

                let endLink = item.endLocation.mapsLink;
                if ((!endLink || endLink === "#") && eLat && eLng) {
                    endLink = `https://www.google.com/maps/search/?api=1&query=${eLat},${eLng}`;
                }

                let endDisplay = `<strong>${endName}</strong>`;
                if (endLink && endLink !== "#") {
                    endDisplay = `<strong><a href="${endLink}" target="_blank" style="color: inherit; text-decoration: underline;">${endName}</a></strong>`;
                }

                const latVal = eLat || '';
                const lngVal = eLng || '';
                const btnColor = (eLat && eLng) ? '' : 'color:red; opacity:0.7;';
                const btnTitle = (eLat && eLng) ? 'Correct destination' : 'No GPS Data available for this location';
                endDisplay += ` <span class="edit-btn" data-lat="${latVal}" data-lng="${lngVal}" data-name="${endName.replace(/"/g, '&quot;')}" title="${btnTitle}" style="${btnColor}">✎</span>`;

                // Add Note Button
                if (item.id) endDisplay += getNoteBtn(item.id);
                // Add Delete Button
                if (item.id) endDisplay += getDeleteBtn(item.id);

                let text = `Left ${startDisplay} at ${timeStr}.`;
                if (distText) text += ` Traveled ${distText} by <strong>${mode}</strong>`;
                else text += ` Traveled by <strong>${mode}</strong>`;
                text += ` to ${endDisplay}.`;

                // Render Sub-Stops
                if (item.subStops && item.subStops.length > 0) {
                    const stopsStr = item.subStops.map(s => {
                        const m = Math.round(s.durationMs / 60000);
                        const t = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return `${m}m stop at ${t}`;
                    }).join(', ');
                    text += ` <span style="display:block; font-size:0.9em; color:#555; margin-top:4px;">🛑 Includes: ${stopsStr}.</span>`;
                }

                // Render Parking
                if (item.parking && item.parking.time) {
                    const pTime = new Date(item.parking.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    text += ` <span style="display:block; font-size:0.9em; color:#2e7d32; margin-top:4px;">🅿️ Maneuved to park at ${pTime}.</span>`;
                }

                p.innerHTML = text;

                // Map Button
                if (item.path && item.path.length > 0) {
                    const mapBtn = document.createElement('span');
                    mapBtn.className = 'map-btn';
                    mapBtn.innerHTML = '🗺️';
                    mapBtn.title = 'View Route on Map';
                    mapBtn.onclick = (e) => {
                        e.stopPropagation();
                        openMap(item.path, `Journey to ${item.endLocation.name || 'End'}`, item.activityType);
                    };
                    p.appendChild(document.createTextNode(' '));
                    p.appendChild(mapBtn);
                }
            } else {
                p.innerHTML = item.narrative;
            }

            div.appendChild(timeSpan);
            div.appendChild(p);
            daySection.appendChild(div);
        });

        bookContent.appendChild(daySection);
    }
}

// --- HELPER FUNCTIONS FOR HTML HANDLERS ---
function definedPromptSavePlace(lat, lng, name) {
    // Forward to internal function
    promptSavePlace(lat, lng, name);
}

function definedOpenMap(path, title) {
    // Legacy placeholder removed
}

// Global openMap implementation
window.openMap = function (path, title, type) {
    if (window.MapManager) {
        // We create a fake event object to reuse renderDailyRoute logic
        // renderDailyRoute expects an array of events
        const scale = type === "STATIONARY" ? 'stationary' : 'moving';
        const fakeEvent = {
            type: scale,
            path: path,
            activityType: type || 'MOVING', // Label
            distance: 0, // Not critical for viz
            startTime: new Date().toISOString(), // Mock
            location: { name: title }, // Stationary mock
            endLocation: { name: title.replace('Journey to ', '') } // Moving mock
        };
        // Reuse the modal map logic
        MapManager.renderDailyRoute([fakeEvent], title);
    } else {
        alert("Map Module not loaded.");
    }
};

// Add Note Logic
window.promptAddNote = async function (id) {
    // Find event
    // We need to look up in currentEntries
    // Since we don't have a map of ID -> Entry easily, we iterate or use DB.
    // But for UI responsiveness, update object in memory THEN save to DB.

    let entry = null;
    let entryIndex = -1;

    // Finding entry by ID or timestamp approximation?
    // Our DB ID is generated. Do our in-memory entries have IDs?
    // db.js generates them on save. 
    // When we loadYear, we get objects WITH IDs.

    entry = currentEntries.find(e => e.id === id);

    if (!entry) {
        alert("Error: Event not found for editing.");
        return;
    }

    const existing = entry.userNote || "";
    const input = prompt("Enter your memory/note for this moment:", existing);

    if (input !== null) {
        // Save to Memory
        entry.userNote = input;

        // Save to DB
        await DiaryStore.saveNote(id, input);

        // Render
        renderBook(currentEntries, false); // Don't reset page
    }
};

// Update Render Logic to show Notes
// We need to inject the Note UI into the render loop.
// Since 'renderBook' is a large function, I should have included it in the replace block
// or I can inject a helper?
// Replace 'div.appendChild(p);' with note logic?
// Better: Override 'renderBook' sections via Replace. 
// See next block.

// --- Personal Places Manager ---

// const PLACE_MATCH_RADIUS_M = 150; // Old hardcoded value

function getMatchRadius() {
    try {
        const val = localStorage.getItem('locomotion_radius');
        return val ? parseInt(val) : 150; // Default 150m
    } catch { return 150; }
}

function setMatchRadius() {
    const current = getMatchRadius();
    const input = prompt(`Enter proximity radius in meters:\n(Locations within this distance will be grouped as one)`, current);
    if (input !== null) {
        const val = parseInt(input);
        if (!isNaN(val) && val > 0) {
            localStorage.setItem('locomotion_radius', val);
            alert(`Radius set to ${val} meters.\nReloading to apply changes...`);

            // Re-run check if we have data
            if (currentEntries) {
                checkForKnownPlaces(currentEntries);
                renderBook(currentEntries);
            }
        } else {
            alert("Invalid number.");
        }
    }
}

// Settings Listener
// Settings Listener - OLD PROMPT REMOVED
// document.getElementById('btn-settings')?.addEventListener('click', setMatchRadius);

function getSavedPlaces() {
    try {
        const str = localStorage.getItem('locomotion_places');
        return str ? JSON.parse(str) : [];
    } catch (e) { return []; }
}

function savePlace(name, lat, lng) {
    let places = getSavedPlaces();
    const radius = getMatchRadius();

    // Remove any existing saved places that are "covered" by this new one
    // to ensure the new name takes precedence for this location.
    places = places.filter(p => {
        const dist = getDistanceFromLatLonInKm(lat, lng, p.lat, p.lng) * 1000;
        // If an existing place is deeply potentially conflicting (within radius), remove it.
        // We use the same radius logic as matching to ensures we "overwrite" the previous match.
        return dist > radius;
    });

    places.push({
        id: Date.now().toString(),
        name: name,
        lat: lat,
        lng: lng,
        created: Date.now()
    });
    localStorage.setItem('locomotion_places', JSON.stringify(places));
    alert(`Saved "${name}"! It will be used for future entries near here.`);

    // Refresh view
    if (currentEntries) {
        checkForKnownPlaces(currentEntries);

        // Refresh Search Options (in case name changed)
        if (typeof populateSearchFilters === 'function') {
            populateSearchFilters(currentEntries);
        } else if (typeof populateLocationFilter === 'function') {
            populateLocationFilter(currentEntries);
        }

        // Refresh Book if active
        if (viewBook.classList.contains('active')) {
            // Re-apply filters if any are valid, else render all
            applyFilters();
        }
        // Refresh Table if active
        if (document.getElementById('view-locations') && document.getElementById('view-locations').classList.contains('active')) {
            openLocationManager(); // Re-cluster and render
        }
    }
}

function findKnownPlace(lat, lng) {
    if (!lat || !lng) return null;

    // Unified Logic: Delegate to PlacesManager
    if (window.PlacesManager) {
        const radius = getMatchRadius();
        return PlacesManager.findNearest(lat, lng, radius);
    }

    // Fallback (Should not happen if initialized)
    const places = getSavedPlaces();
    const radius = getMatchRadius();

    for (const p of places) {
        const dist = getDistanceFromLatLonInKm(lat, lng, p.lat, p.lng) * 1000;
        if (dist <= radius) {
            return p.name;
        }
    }
    return null;
}

function checkForKnownPlaces(entries) {
    entries.forEach(e => {
        // Stationary
        if (e.type === 'stationary' && e.lat && e.lng) {
            const known = findKnownPlace(e.lat, e.lng);
            if (known) {
                e.location.name = known;
                e.location.enriched = true;
            }
        }
        // Moving Start & End
        if (e.type === 'moving') {
            // --- START ---
            let sLat, sLng;
            // 1. Details E7
            if (e.details.startLocation && e.details.startLocation.latitudeE7) {
                sLat = e.details.startLocation.latitudeE7 / 1e7;
                sLng = e.details.startLocation.longitudeE7 / 1e7;
            }
            // 2. Details LatLng String
            else if (e.details.startLocation && e.details.startLocation.latLng) {
                try {
                    const parts = e.details.startLocation.latLng.split(',');
                    if (parts.length === 2) {
                        sLat = parseFloat(parts[0].replace('°', '').trim());
                        sLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            }
            // 3. Name is Coords
            else if (e.startLocation.name && (e.startLocation.name.includes(',') || e.startLocation.name.includes('°'))) {
                try {
                    const parts = e.startLocation.name.split(',');
                    if (parts.length === 2) {
                        sLat = parseFloat(parts[0].replace('°', '').trim());
                        sLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            }
            // 4. Fallback Parsed
            else if (e.startLat && e.startLng) {
                sLat = e.startLat;
                sLng = e.startLng;
            }

            if (sLat && sLng) {
                const known = findKnownPlace(sLat, sLng);
                if (known) e.startLocation.name = known;
            }

            // --- END ---
            let eLat, eLng;
            if (e.details.endLocation && e.details.endLocation.latitudeE7) {
                eLat = e.details.endLocation.latitudeE7 / 1e7;
                eLng = e.details.endLocation.longitudeE7 / 1e7;
            } else if (e.details.endLocation && e.details.endLocation.latLng) {
                try {
                    const parts = e.details.endLocation.latLng.split(',');
                    if (parts.length === 2) {
                        eLat = parseFloat(parts[0].replace('°', '').trim());
                        eLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            } else if (e.endLocation.name && (e.endLocation.name.includes(',') || e.endLocation.name.includes('°'))) {
                try {
                    const parts = e.endLocation.name.split(',');
                    if (parts.length === 2) {
                        eLat = parseFloat(parts[0].replace('°', '').trim());
                        eLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            } else if (e.endLat && e.endLng) {
                eLat = e.endLat;
                eLng = e.endLng;
            }

            if (eLat && eLng) {
                const known = findKnownPlace(eLat, eLng);
                if (known) e.endLocation.name = known;
            }
        }
    });

    // Restore UI Logic (Count Unknowns by ENTRY)
    let unknownCount = 0;
    entries.forEach(e => {
        let isUnknown = false;
        if (e.type === 'stationary') {
            if (isGenericLocation(e.location.name) && e.lat && e.lng && !e.location.enriched) isUnknown = true;
        } else if (e.type === 'moving') {
            if (e.startLat && e.startLng && isGenericLocation(e.startLocation?.name)) isUnknown = true;
            if (e.endLat && e.endLng && isGenericLocation(e.endLocation?.name)) isUnknown = true;
        }
        if (isUnknown) unknownCount++;
    });

    const btn = document.getElementById('btn-enhance');
    if (btn) {
        btn.style.display = 'inline-block'; // Always show for debug
        if (unknownCount > 0) {
            btn.textContent = `✨ Enhance (${unknownCount})`;
            btn.disabled = false;
        } else {
            btn.textContent = `✅ All Clear`;
            btn.disabled = true;
            btn.style.opacity = '0.5';
        }
    }
}

// Enhance Button Listener
if (document.getElementById('btn-enhance')) {
    document.getElementById('btn-enhance').addEventListener('click', enhanceDetails);
}

async function enhanceDetails() {
    const progress = document.getElementById('enhance-progress');
    const btn = document.getElementById('btn-enhance');
    const fill = progress ? progress.querySelector('.fill') : null;
    const text = progress ? progress.querySelector('.text') : null;

    if (progress) {
        progress.style.display = 'inline-block'; // Match CSS
        if (fill) {
            fill.style.width = '0%';
        }
        if (text) text.textContent = 'Starting scan...';
    }
    if (btn) btn.disabled = true;

    try {
        if (!currentEntries) return;

        // Filter Target Entries (Only Unknowns WITH Coordinates)
        let targetEntries = [];
        currentEntries.forEach(e => {
            let isUnknown = false;
            // Strict check: Must be generic AND have coordinates to be valid for enhancement
            if (e.type === 'stationary') {
                if (isGenericLocation(e.location.name) && e.lat && e.lng && !e.location.enriched) isUnknown = true;
            } else if (e.type === 'moving') {
                if (e.startLat && e.startLng && isGenericLocation(e.startLocation?.name)) isUnknown = true;
                if (e.endLat && e.endLng && isGenericLocation(e.endLocation?.name)) isUnknown = true;
            }
            if (isUnknown) targetEntries.push(e);
        });

        const total = targetEntries.length;
        const chunkSize = 5;

        if (total === 0) {
            alert("No enhanceable entries found (must have coordinates).");
            return;
        }

        // Process only the targeted entries
        for (let i = 0; i < total; i += chunkSize) {
            const limit = Math.min(i + chunkSize, total);
            for (let j = i; j < limit; j++) {
                const e = targetEntries[j];
                processEntryForKnownPlaces(e);
            }

            const pct = Math.round((limit / total) * 100);
            if (fill) fill.style.width = `${pct}%`;
            if (text) text.textContent = `Scanning: ${limit} / ${total}`;

            await new Promise(r => setTimeout(r, 10)); // Yield to UI
        }

        // Update Button State manually
        const btnState = document.getElementById('btn-enhance');
        let newUnknownCount = 0;

        if (btnState) {
            currentEntries.forEach(e => {
                let isUnknown = false;
                if (e.type === 'stationary') {
                    if (isGenericLocation(e.location.name) && e.lat && e.lng && !e.location.enriched) isUnknown = true;
                } else if (e.type === 'moving') {
                    if (e.startLat && e.startLng && isGenericLocation(e.startLocation?.name)) isUnknown = true;
                    if (e.endLat && e.endLng && isGenericLocation(e.endLocation?.name)) isUnknown = true;
                }
                if (isUnknown) newUnknownCount++;
            });

            if (newUnknownCount > 0) {
                btnState.textContent = `✨ Enhance (${newUnknownCount})`;
                btnState.disabled = false;
            } else {
                btnState.textContent = `✅ All Clear`;
                btnState.style.opacity = '0.5';
                btnState.disabled = true;
            }
        }

        // Refresh View
        renderBook(currentRenderedEntries || currentEntries);

        // Feedback Logic
        if (newUnknownCount === total && total > 0) {
            alert(`Scan Complete! (Scanned ${total} entries)\n\nResult: No known places matched.\n\nTip: You need to manually Edit (✎) location names first to "teach" the app.`);
        } else {
            alert("Enhancement Scan Complete! \nRefined known locations based on your saved places.");
        }

    } catch (err) {
        console.error("Enhance Error:", err);
        alert("An error occurred during enhancement.");
    } finally {
        if (progress) {
            setTimeout(() => {
                progress.style.display = 'none';
            }, 500);
        }
        if (btn) {
            btn.disabled = false;
            if (btn.textContent.includes('All Clear')) btn.disabled = true;
        }
    }
}

// Extracted Helper (Single Entry Logic)
function processEntryForKnownPlaces(e) {
    if (e.type === 'stationary') {
        if (e.lat && e.lng) {
            const known = findKnownPlace(e.lat, e.lng);
            if (known) { e.location.name = known; e.location.enriched = true; }
        }
    } else if (e.type === 'moving') {
        let sLat, sLng;
        // Simplified Start Check
        if (e.startLocation.latitudeE7) { sLat = e.startLocation.latitudeE7 / 1e7; sLng = e.startLocation.longitudeE7 / 1e7; }
        else if (e.startLat) { sLat = e.startLat; sLng = e.startLng; }

        if (sLat && sLng) {
            const known = findKnownPlace(sLat, sLng);
            if (known) e.startLocation.name = known;
        }

        let eLat, eLng;
        // Simplified End Check
        if (e.endLocation.latitudeE7) { eLat = e.endLocation.latitudeE7 / 1e7; eLng = e.endLocation.longitudeE7 / 1e7; }
        else if (e.endLat) { eLat = e.endLat; eLng = e.endLng; }

        if (eLat && eLng) {
            const known = findKnownPlace(eLat, eLng);
            if (known) e.endLocation.name = known;
        }
    }
}


function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

function promptSavePlace(lat, lng, currentName) {
    if (!lat || !lng) return;

    // Legacy Prompt (replaced)
    // const name = prompt(`Name this location?\n(Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)})`, currentName !== "Unknown Place" ? currentName : "");
    // if (name) savePlace(name, lat, lng);

    openLocationModal(lat, lng, currentName);
}



// --- Data Management Logic ---

const btnManageData = document.getElementById('btn-manage-data'); // In Header?
const manageModal = document.getElementById('data-management-modal');
const btnCloseManage = document.getElementById('btn-close-manage');
const btnDeleteRange = document.getElementById('btn-delete-range');
const btnNukeAll = document.getElementById('btn-nuke-all');

// Header Button Listener (Need to add this button to HTML header if not done)
// I added it in HTML update.
if (document.getElementById('btn-manage-data')) {
    document.getElementById('btn-manage-data').addEventListener('click', () => {
        manageModal.style.display = 'flex';
        // Pre-fill dates?
        document.getElementById('manage-date-from').valueAsDate = new Date();
        document.getElementById('manage-date-to').valueAsDate = new Date();
    });
}

if (btnCloseManage) {
    btnCloseManage.addEventListener('click', () => {
        manageModal.style.display = 'none';
    });
}

// Helper: Double Confirmation
function confirmDestructiveAction(message, action) {
    if (confirm(message)) {
        if (confirm("⚠️ DOUBLE CHECK: This action cannot be undone. Are you absolutely sure?")) {
            action();
        }
    }
}

if (btnDeleteRange) {
    btnDeleteRange.addEventListener('click', () => {
        const dFrom = document.getElementById('manage-date-from').value;
        const dTo = document.getElementById('manage-date-to').value;

        if (!dFrom || !dTo) {
            alert("Please select a date range.");
            return;
        }

        confirmDestructiveAction(
            `Delete all events from ${dFrom} to ${dTo}?`,
            async () => {
                // Safety: Stop any running weather scan
                shouldStopWeather = true;
                try {
                    // Convert to Date Objects (Midnight to End of Day)
                    const rangeStart = new Date(dFrom);
                    rangeStart.setHours(0, 0, 0, 0);
                    const rangeEnd = new Date(dTo);
                    rangeEnd.setHours(23, 59, 59, 999);

                    await DiaryStore.deleteEventsByRange(rangeStart, rangeEnd);
                    alert("Range deleted.");
                    manageModal.style.display = 'none';
                    // Reload current year
                    const currentY = document.getElementById('year-switcher').value;
                    loadYear(currentY);
                } catch (e) {
                    alert("Error deleting range: " + e.message);
                }
            }
        );
    });
}

if (btnNukeAll) {
    btnNukeAll.addEventListener('click', () => {
        confirmDestructiveAction(
            "🛑 WARNING: This will delete the ENTIRE DIARY database! All events, all years. This is irreversible.",
            async () => {
                // Safety: Stop any running weather scan
                shouldStopWeather = true;
                try {
                    await DiaryStore.clearAllEvents();
                    alert("App Reset. Database cleared.");
                    location.reload(); // Hard reset
                } catch (e) {
                    alert("Error clearing database: " + e.message);
                }
            }
        );
    });
}

// --- Entry Deletion Logic (Delegated) ---

// We listen on 'bookContent' which handles clicks for the whole book
if (bookContent) {
    // Add to existing listener?
    // The existing listener handles 'edit-btn'. Let's add 'btn-delete-entry'.
    // NOTE: We cannot add a second 'click' listener easily if we want to stop propagation? 
    // Actually we can add multiple listeners.

    bookContent.addEventListener('click', async (e) => {
        // Check for delete button
        if (e.target.classList.contains('btn-delete-entry') || e.target.parentElement.classList.contains('btn-delete-entry')) {
            const btn = e.target.classList.contains('btn-delete-entry') ? e.target : e.target.parentElement;
            const id = btn.dataset.id;

            if (confirm("Delete this entry?")) {
                // Single confirmation for single item is usually enough, but user asked for "Double warn for any kind of deletion".
                // Okay, complying with user rule.
                if (confirm("Are you sure you want to remove this memory?")) {
                    // Safety: Stop any running weather scan
                    shouldStopWeather = true;
                    try {
                        await DiaryStore.deleteEvent(id);
                        // Remove from UI immediately for responsiveness
                        // Find the parent .diary-item and remove it
                        const itemDiv = btn.closest('.diary-item');
                        if (itemDiv) {
                            itemDiv.style.opacity = '0';
                            setTimeout(() => itemDiv.remove(), 300);
                            // If it was the last item in a day, we might want to remove the day header... 
                            // But full reload is safer for index/map consistency.
                            // Let's reload silently or just rely on manual refresh?
                            // Better: Reload current view (preserve page)
                            // await loadYear(...); // heavy
                            // Let's just remove logic for now.
                        }
                    } catch (err) {
                        alert("Failed to delete.");
                    }
                }
            }
        }
    });
}

// --- Modal Logic ---

const modalOverlay = document.getElementById('location-modal');
const modalInput = document.getElementById('location-input');
const modalSaveBtn = document.getElementById('btn-modal-save');
const modalCancelBtn = document.getElementById('btn-modal-cancel');
const modalSuggestions = document.getElementById('location-suggestions');

let activeEdit = null; // { lat, lng }

function openLocationModal(lat, lng, currentName) {
    if (!modalOverlay) return;

    activeEdit = { lat, lng };

    // Reset Input
    modalInput.value = (currentName && !isGenericLocation(currentName)) ? currentName : "";

    // Populate Suggestions
    populateSuggestions(lat, lng);

    // Show Modal
    modalOverlay.style.display = 'flex';
    modalInput.focus();
}

function closeLocationModal() {
    if (modalOverlay) modalOverlay.style.display = 'none';
    activeEdit = null;
}

function populateSuggestions(targetLat, targetLng) {
    if (!modalSuggestions) return;
    modalSuggestions.innerHTML = '';

    const nearbyThreshold = 2000; // 2km
    const seenNames = new Set();
    const suggestions = [];

    // 1. Add Saved Places first (High priority)
    const saved = PlacesManager.getAll();
    saved.forEach(p => {
        if (!p.lat || !p.lng) return;
        const dist = getDistanceFromLatLonInKm(targetLat, targetLng, p.lat, p.lng) * 1000;

        if (dist <= nearbyThreshold && !seenNames.has(p.name)) {
            seenNames.add(p.name);
            suggestions.push({
                name: p.name,
                dist: dist,
                source: 'saved'
            });
        }
    });

    // 2. Scan currentEntries for other names used at this location
    if (currentEntries) {
        currentEntries.forEach(e => {
            const checkLoc = (lat, lng, name) => {
                if (!lat || !lng || !name || isGenericLocation(name)) return;
                const dist = getDistanceFromLatLonInKm(targetLat, targetLng, lat, lng) * 1000;
                if (dist <= nearbyThreshold && !seenNames.has(name)) {
                    seenNames.add(name);
                    suggestions.push({
                        name: name,
                        dist: dist,
                        source: 'file'
                    });
                }
            };

            if (e.type === 'stationary') {
                checkLoc(e.lat, e.lng, e.location.name);
            } else if (e.type === 'moving') {
                // Check Start
                let sLat, sLng;
                if (e.startLat && e.startLng) {
                    sLat = e.startLat; sLng = e.startLng;
                }
                checkLoc(sLat, sLng, e.startLocation.name);

                // Check End
                let eLat, eLng;
                if (e.endLat && e.endLng) {
                    eLat = e.endLat; eLng = e.endLng;
                }
                checkLoc(eLat, eLng, e.endLocation.name);
            }
        });
    }

    // 3. Sort
    // Priority: Saved < File. Then by Distance.
    suggestions.sort((a, b) => {
        if (a.source !== b.source) {
            return a.source === 'saved' ? -1 : 1; // Saved first
        }
        return a.dist - b.dist; // Then closer ones
    });

    // 4. Render
    suggestions.forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;

        let label = s.name;
        if (s.source === 'saved') label += " (Saved)";
        if (s.dist > 0) label += ` (${Math.round(s.dist)}m)`;

        // option.label = label; // Firefox/Chrome display varies, but value is key
        modalSuggestions.appendChild(option);
    });
}

// Listeners
if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', () => {
        if (!activeEdit) return;

        const name = modalInput.value.trim();
        if (name) {
            // Robust Fix: Parse floats explicitly
            const lat = parseFloat(activeEdit.lat);
            const lng = parseFloat(activeEdit.lng);

            PlacesManager.addPlace(name, lat, lng);
            closeLocationModal();

            // 1. Update In-Memory Data (so Diary View gets updated too)
            if (currentEntries) {
                checkForKnownPlaces(currentEntries);
                // 2. Refresh Search Filters (so new name appears in dropdown)
                if (typeof populateSearchFilters === 'function') {
                    populateSearchFilters(currentEntries);
                }
            }

            // 3. Refresh Location Manager List
            openLocationManager();
        } else {
            alert("Please enter a name.");
        }
    });
}

// Separate Listener Block for Auto-Detect to avoid nesting issues or if previously missed
const btnAutoDetect = document.getElementById('btn-auto-detect');
if (btnAutoDetect) {
    btnAutoDetect.addEventListener('click', async () => {
        if (!activeEdit || !activeEdit.lat || !activeEdit.lng) {
            alert("No coordinates available for this location.");
            return;
        }

        const originalText = btnAutoDetect.textContent;
        btnAutoDetect.textContent = "⏳ Fetching...";
        btnAutoDetect.disabled = true;

        try {
            // OpenStreetMap Nominatim API
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${activeEdit.lat}&lon=${activeEdit.lng}&zoom=18&addressdetails=1`;

            const resp = await fetch(url, {
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            if (!resp.ok) throw new Error("Network response was not ok");

            const data = await resp.json();

            if (data && (data.display_name || data.address)) {
                let name = "";

                // Smart formatting
                const addr = data.address || {};
                const amenity = addr.amenity || addr.building || addr.shop || addr.leisure || addr.tourism;
                const road = addr.road || addr.pedestrian || addr.street;
                const city = addr.city || addr.town || addr.village || addr.suburb;

                if (amenity) {
                    name = amenity;
                    if (city) name += `, ${city}`;
                } else if (road) {
                    name = road;
                    if (addr.house_number) name = `${addr.house_number} ${name}`;
                    if (city) name += `, ${city}`;
                } else {
                    // Fallback
                    name = data.display_name.split(',').slice(0, 3).join(',');
                }

                if (modalInput) modalInput.value = name;
            } else {
                alert("No address details found.");
            }

        } catch (e) {
            console.warn(e);
            alert("Could not fetch address from Map. Check internet connection.");
        } finally {
            btnAutoDetect.textContent = originalText;
            btnAutoDetect.disabled = false;
        }
    });

}

if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', closeLocationModal);
}

// Close on outside click
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeLocationModal();
    });
}

// Enter key to save
if (modalInput) {
    modalInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') modalSaveBtn.click();
        if (e.key === 'Escape') closeLocationModal();
    });
}

// --- Location Manager Logic ---

// Wire up Export/Import Buttons (Delegated or Direct)

// We need to attach listeners once. Since openLocationManager might be called repeatedly,
// we should attach listeners outside or check existence.
// Ideally we attach them in initApp or outside functions.

// Let's add them to the global listener block or here with a check.
const btnExpP = document.getElementById('btn-export-places');
const btnImpP = document.getElementById('btn-import-places');
const fileImpP = document.getElementById('places-file-input');

if (btnExpP) {
    // Remove old listener hack? No, just overwrite onclick or addEventListener with check?
    // Let's use onclick for simplicity to avoid dupes if re-run, 
    // OR better: Move this to the main Event Listener block at top of file. 
    // BUT we are editing this file in chunks. 
    // Let's just set onclick here.
    btnExpP.onclick = () => PlacesManager.exportPlaces();
}

if (btnImpP && fileImpP) {
    btnImpP.onclick = () => fileImpP.click();
    fileImpP.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                const res = PlacesManager.importPlaces(data);
                alert(`Imported Places:\nAdded: ${res.added}\nUpdated: ${res.updated}`);
                // Refresh view
                openLocationManager();
            } catch (err) {
                alert("Failed to import places: " + err.message);
            }
            fileImpP.value = ''; // Reset
        };
        reader.readAsText(file);
    };
}

function openLocationManager() {
    if (!currentEntries || currentEntries.length === 0) {
        alert("No data loaded.");
        return;
    }

    const clusters = extractLocationClusters(currentEntries);
    renderLocationTable(clusters);
    switchView('locations');
}

function extractLocationClusters(entries) {
    const rawPoints = [];
    const radius = getMatchRadius();

    // 1. Collect all points with valid coords
    entries.forEach(e => {
        if (e.type === 'stationary' && e.lat && e.lng) {
            rawPoints.push({ lat: e.lat, lng: e.lng, name: e.location.name });
        }
        if (e.type === 'moving') {
            // START
            let sLat, sLng;
            if (e.details.startLocation && e.details.startLocation.latitudeE7) {
                sLat = e.details.startLocation.latitudeE7 / 1e7;
                sLng = e.details.startLocation.longitudeE7 / 1e7;
            } else if (e.details.startLocation && e.details.startLocation.latLng) {
                try {
                    const parts = e.details.startLocation.latLng.split(',');
                    if (parts.length === 2) {
                        sLat = parseFloat(parts[0].replace('°', '').trim());
                        sLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            } else if (e.startLocation.name && (e.startLocation.name.includes(',') || e.startLocation.name.includes('°'))) {
                try {
                    const parts = e.startLocation.name.split(',');
                    if (parts.length === 2) {
                        sLat = parseFloat(parts[0].replace('°', '').trim());
                        sLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            } else if (e.startLat && e.startLng) {
                sLat = e.startLat;
                sLng = e.startLng;
            }
            if (sLat && sLng) rawPoints.push({ lat: sLat, lng: sLng, name: e.startLocation.name });

            // END
            let eLat, eLng;
            if (e.details.endLocation && e.details.endLocation.latitudeE7) {
                eLat = e.details.endLocation.latitudeE7 / 1e7;
                eLng = e.details.endLocation.longitudeE7 / 1e7;
            } else if (e.details.endLocation && e.details.endLocation.latLng) {
                try {
                    const parts = e.details.endLocation.latLng.split(',');
                    if (parts.length === 2) {
                        eLat = parseFloat(parts[0].replace('°', '').trim());
                        eLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            } else if (e.endLocation.name && (e.endLocation.name.includes(',') || e.endLocation.name.includes('°'))) {
                try {
                    const parts = e.endLocation.name.split(',');
                    if (parts.length === 2) {
                        eLat = parseFloat(parts[0].replace('°', '').trim());
                        eLng = parseFloat(parts[1].replace('°', '').trim());
                    }
                } catch (err) { }
            } else if (e.endLat && e.endLng) {
                eLat = e.endLat;
                eLng = e.endLng;
            }
            if (eLat && eLng) rawPoints.push({ lat: eLat, lng: eLng, name: e.endLocation.name });
        }
    });

    // 2. Simple Clustering (Greedy)
    const clusters = [];

    // Helper to find if point belongs to existing cluster
    const findCluster = (lat, lng) => {
        for (const c of clusters) {
            const dist = getDistanceFromLatLonInKm(lat, lng, c.lat, c.lng) * 1000;
            if (dist <= radius) return c;
        }
        return null;
    };

    rawPoints.forEach(p => {
        const cluster = findCluster(p.lat, p.lng);
        if (cluster) {
            cluster.count++;
            // Update name stats
            if (!cluster.names[p.name]) cluster.names[p.name] = 0;
            cluster.names[p.name]++;
        } else {
            clusters.push({
                lat: p.lat,
                lng: p.lng,
                count: 1,
                names: { [p.name]: 1 }
            });
        }
    });

    // 3. Refine Clusters
    return clusters.map(c => {
        // Find most frequent name (App Suggested)
        let topName = "Unknown";
        let maxCount = -1;
        for (const [name, count] of Object.entries(c.names)) {
            // Prefer not "Unknown" or "GPS" if possible, unless it's dominant
            const isGen = isGenericLocation(name);
            const score = count * (isGen ? 0.5 : 1.5); // Boost non-generic

            if (score > maxCount) {
                maxCount = score;
                topName = name;
            }
        }

        // Check for Saved Name Override
        const savedName = PlacesManager.getPlace(c.lat, c.lng);

        return {
            lat: c.lat,
            lng: c.lng,
            visits: c.count,
            suggestedName: topName,
            currentName: savedName || topName
        };
    }).sort((a, b) => b.visits - a.visits); // Sort by popularity
}

function renderLocationTable(clusters) {
    const tbody = document.getElementById('locations-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    clusters.forEach((c, index) => {
        const tr = document.createElement('tr');

        // 1. Serial
        const tdIdx = document.createElement('td');
        tdIdx.setAttribute('data-label', '#');
        tdIdx.textContent = index + 1;
        tr.appendChild(tdIdx);

        // 2. Coords Link
        const tdMap = document.createElement('td');
        tdMap.setAttribute('data-label', 'Coords');
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
        tdMap.innerHTML = `<a href="${mapLink}" target="_blank" class="compact-link">${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</a>`;
        tr.appendChild(tdMap);

        // 3. Suggested Name
        const tdSugg = document.createElement('td');
        tdSugg.setAttribute('data-label', 'Suggested');
        tdSugg.textContent = c.suggestedName;
        tdSugg.style.color = '#888';
        tr.appendChild(tdSugg);

        // 4. Current Name
        const tdCurr = document.createElement('td');
        tdCurr.setAttribute('data-label', 'Current Name');
        tdCurr.innerHTML = `<strong>${c.currentName}</strong>`;
        if (c.currentName !== c.suggestedName && !isGenericLocation(c.currentName)) {
            tdCurr.innerHTML += ` <span style="font-size:0.8em; color:green;">(Saved)</span>`;
        }
        tr.appendChild(tdCurr);

        // 5. Action
        const tdAct = document.createElement('td');
        tdAct.setAttribute('data-label', 'Action');
        tdAct.innerHTML = `<button class="action-btn" data-lat="${c.lat}" data-lng="${c.lng}" data-name="${c.currentName.replace(/"/g, '&quot;')}">Edit</button>`;
        tr.appendChild(tdAct);

        tbody.appendChild(tr);
    });
}

// --- Search / Filter Logic ---

function populateSearchFilters(entries) {
    const locSelect = document.getElementById('search-location');
    const actSelect = document.getElementById('search-activity');

    if (!locSelect || !actSelect) return;

    // Keep current selections
    const currentLoc = locSelect.value;
    const currentAct = actSelect.value;

    // 1. Gather Unique Names & Activities
    const names = new Set();
    const activities = new Set();

    entries.forEach(e => {
        // Activities
        if (e.activityType) {
            activities.add(e.activityType);
        }

        // Locations
        if (e.type === 'stationary') {
            if (e.location.name) names.add(e.location.name);
        } else if (e.type === 'moving') {
            if (e.startLocation.name) names.add(e.startLocation.name);
            if (e.endLocation.name) names.add(e.endLocation.name);
        }
    });

    // 2. Sort
    const sortedNames = Array.from(names).sort((a, b) => a.localeCompare(b));
    const sortedActs = Array.from(activities).sort((a, b) => a.localeCompare(b));

    // 3. Populate Locations
    locSelect.innerHTML = '<option value="">All Locations</option>';
    sortedNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        locSelect.appendChild(opt);
    });
    locSelect.value = currentLoc;

    // 4. Populate Activities
    actSelect.innerHTML = '<option value="">All Activities</option>';
    sortedActs.forEach(act => {
        const opt = document.createElement('option');
        opt.value = act;
        // Make readable (e.g., IN_PASSENGER_VEHICLE -> In Passenger Vehicle)
        // But entries usually have "FLYING" or "Walk" from parser.
        // Let's title case loosely
        let label = act.replace(/_/g, ' ').toLowerCase();
        label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        opt.textContent = label; // Display pretty
        opt.value = act;         // Value matches DB
        actSelect.appendChild(opt);
    });
    actSelect.value = currentAct;
}

function applyFilters() {
    if (!currentEntries) return;

    const fromDateVal = document.getElementById('search-date-from').value;
    const toDateVal = document.getElementById('search-date-to').value;
    const locVal = document.getElementById('search-location').value;

    let filtered = currentEntries;

    // Date Filter
    const getLocalMidnight = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    const getLocalEndOfDay = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d, 23, 59, 59, 999);
    };

    if (fromDateVal) {
        const fromDate = getLocalMidnight(fromDateVal);
        filtered = filtered.filter(e => e.startTime >= fromDate);
    }

    if (toDateVal) {
        const toDate = getLocalEndOfDay(toDateVal);
        filtered = filtered.filter(e => e.endTime <= toDate);
    }

    // Location Filter
    if (locVal) {
        filtered = filtered.filter(e => {
            if (e.type === 'stationary') return e.location.name === locVal;
            if (e.type === 'moving') return e.startLocation.name === locVal || e.endLocation.name === locVal;
            return false;
        });
    }

    // Activity Filter
    const actVal = document.getElementById('search-activity').value;
    if (actVal) {
        filtered = filtered.filter(e => {
            if (e.type === 'stationary') return false;
            if (e.type === 'moving' && e.activityType === actVal) return true;
            return false;
        });
    }

    // Text Search
    const textVal = document.getElementById('search-text')?.value.toLowerCase();
    if (textVal) {
        filtered = filtered.filter(e => {
            // Narrative
            if (e.narrative && e.narrative.toLowerCase().includes(textVal)) return true;

            // Location Name/Address
            if (e.type === 'stationary') {
                if (e.location.name && e.location.name.toLowerCase().includes(textVal)) return true;
                if (e.location.address && e.location.address.toLowerCase().includes(textVal)) return true;
            } else if (e.type === 'moving') {
                if (e.startLocation.name && e.startLocation.name.toLowerCase().includes(textVal)) return true;
                if (e.endLocation.name && e.endLocation.name.toLowerCase().includes(textVal)) return true;
            }
            return false;
        });
    }

    // Apply Sort before Render
    sortEntries(filtered);

    renderBook(filtered, true);
}



// --- Export Logic (Smart) ---

async function handlePrintExport() {
    const dataToExport = currentRenderedEntries || currentEntries;
    if (!dataToExport || dataToExport.length === 0) {
        alert("No events to export!");
        return;
    }

    // 1. Generate Stats
    const stats = DiaryStats.generate(dataToExport);

    // 2. Build DOM Container
    let printContainer = document.getElementById('print-export-container');
    if (printContainer) printContainer.remove();

    printContainer = document.createElement('div');
    printContainer.id = 'print-export-container';
    printContainer.style.display = 'none'; // Hide in main app
    document.body.appendChild(printContainer);

    // 3. PREMIUM COVER PAGE
    const dateRangeStr = `${stats.timeRange.start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} - ${stats.timeRange.end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;

    const coverPage = document.createElement('div');
    coverPage.className = 'print-cover-page';
    coverPage.innerHTML = `
        <div style="border: 4px double #000; padding: 3rem; margin: 2rem;">
            <h1 class="print-cover-title">My Locomotion Diary</h1>
            <p class="print-cover-subtitle" style="font-size: 2rem; margin: 2rem 0;">${dateRangeStr}</p>
            <div style="margin: 4rem 0; font-size: 5rem;">🗺️</div>
            <p style="margin-top: 1rem; color: #777;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
    `;
    printContainer.appendChild(coverPage);

    // 4. VISUAL ANALYTICS PAGE
    const statsPage = document.createElement('div');
    statsPage.className = 'print-stats-page';

    // Snapshot Charts (Robust Fallback)
    let chartImg = '';
    const sourceCanvas = document.getElementById('modeChart');

    // Check if chart is drawn
    let isChartReady = sourceCanvas && sourceCanvas.width > 0 && window.myModeChart;

    if (isChartReady) {
        chartImg = `<img src="${sourceCanvas.toDataURL()}" style="max-width:100%; height:auto; display:block; margin: 2rem auto;">`;
    } else if (typeof Chart !== 'undefined') {
        // Force Render on Temp Canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 400;

        // Prepare Data
        const labels = Object.keys(stats.activityTypeCounts).map(l => l.replace(/_/g, ' '));
        const data = Object.values(stats.activityTypeCounts);

        // Render
        new Chart(tempCanvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
                }]
            },
            options: {
                responsive: false,
                animation: false, // Instant render
                plugins: { legend: { position: 'right' } }
            }
        });

        chartImg = `<img src="${tempCanvas.toDataURL()}" style="max-width:100%; height:auto; display:block; margin: 2rem auto;">`;
    }

    // Clone Heatmap
    let heatmapHTML = '';
    const sourceHeatmap = document.getElementById('activity-heatmap');
    if (sourceHeatmap && sourceHeatmap.children.length > 0) {
        heatmapHTML = sourceHeatmap.outerHTML;
    } else if (stats) {
        // Fallback: Generate Heatmap HTML manually if missing
        // (Simplified text version or just message, as full HTML heatmap generation is complex to duplicate here)
        // We will try to rely on the app logic, but if not, user accepts it.
    }

    statsPage.innerHTML = `
        <h2 style="text-align: center; margin-bottom: 2rem; font-family: 'Merriweather', serif;">Year at a Glance</h2>
        <div class="print-stats-grid">
            <div class="print-stat-item">
                <h4>Total Distance</h4>
                <div class="print-stat-val">${stats.totalDistanceKm.toLocaleString()} km</div>
            </div>
            <div class="print-stat-item">
                <h4>Total Events</h4>
                <div class="print-stat-val">${stats.totalEvents.toLocaleString()}</div>
            </div>
        </div>
        
        <div style="margin-top: 3rem; text-align: center;">
            <h3 style="font-family: 'Merriweather', serif;">Modes of Transport</h3>
            ${chartImg || '<p>Chart not available</p>'}
        </div>

        <div style="margin-top: 3rem;">
            <h3 style="text-align: center; font-family: 'Merriweather', serif; margin-bottom: 1rem;">Activity Heatmap</h3>
            <div style="transform: scale(0.8); transform-origin: top center;">
                ${heatmapHTML || '<p>Heatmap not available (Please view Analytics tab to generate)</p>'}
            </div>
        </div>
    `;
    printContainer.appendChild(statsPage);

    // 5. SMART CHAPTERS (Content Page)
    const contentPage = document.createElement('div');
    contentPage.className = 'print-content-page';

    // RE-RENDER Logic: We must iterate ALL dataToExport (ignoring pagination)
    let currentMonth = '';

    // Group events by day to match book format
    const eventsByDay = {};
    dataToExport.forEach(e => {
        const dKey = new Date(e.startTime).toLocaleDateString(undefined, { year: 'numeric', month: 'long', weekday: 'short', day: 'numeric' });
        if (!eventsByDay[dKey]) eventsByDay[dKey] = [];
        eventsByDay[dKey].push(e);
    });

    Object.entries(eventsByDay).forEach(([dateStr, dayEvents]) => {
        const d = new Date(dayEvents[0].startTime);
        const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // --- CHAPTER BREAK (New Month) ---
        if (monthYear !== currentMonth) {
            currentMonth = monthYear;

            // Stats for this month
            const monthEvents = dataToExport.filter(e => {
                const ed = new Date(e.startTime);
                return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
            });
            const mStats = DiaryStats.generate(monthEvents);

            // Top Places
            const mTopPlaces = Object.entries(mStats.topLocations)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, count]) => `<li>${name} (${count})</li>`)
                .join('');

            // Activity Bar
            const totalActs = Object.values(mStats.activityTypeCounts).reduce((a, b) => a + b, 0);
            const actBar = Object.entries(mStats.activityTypeCounts).map(([type, count]) => {
                const pct = (count / totalActs) * 100;
                let col = '#ddd';
                if (type.includes('WALK') || type.includes('RUN')) col = '#4CAF50';
                else if (type.includes('VEHICLE') || type.includes('DRIV')) col = '#2196F3';
                else if (type.includes('CYC')) col = '#9C27B0';
                else if (type.includes('FLY')) col = '#F44336';
                return `<div style="width:${pct}%; background:${col}; height:10px;" title="${type}"></div>`;
            }).join('');

            const breakDiv = document.createElement('div');
            breakDiv.className = 'print-chapter-break';
            breakDiv.innerHTML = `
                <h2 class="print-chapter-title">${currentMonth}</h2>
                <div class="print-stats-grid" style="margin-top: 2rem; transform: scale(0.9);">
                    <div class="print-stat-item">
                        <h4>Distance</h4>
                        <div class="print-stat-val" style="font-size: 1.5rem;">${Math.round(mStats.totalDistanceKm)} km</div>
                    </div>
                    <div class="print-stat-item">
                        <h4>Events</h4>
                        <div class="print-stat-val" style="font-size: 1.5rem;">${mStats.totalEvents}</div>
                    </div>
                    <div class="print-stat-item" style="grid-column: span 2;">
                        <h4>Top Places</h4>
                        <ul style="font-size: 0.9rem;">${mTopPlaces || '<li>No significant places</li>'}</ul>
                    </div>
                </div>
                <div style="width: 80%; margin-top: 2rem;">
                     <div style="display:flex; width: 100%; border-radius: 5px; overflow: hidden; background: #eee;">${actBar}</div>
                     <p style="text-align: center; font-size: 0.8rem; color: #777; margin-top: 5px;">Activity Distribution</p>
                </div>
            `;
            contentPage.appendChild(breakDiv);
        }

        // --- RENDER DAY ---
        const dayDiv = document.createElement('div');
        dayDiv.className = 'diary-entry';

        // Date Header
        const h3 = document.createElement('h3');
        h3.className = 'diary-date';
        h3.style.display = 'flex';
        h3.style.justifyContent = 'space-between';
        h3.style.alignItems = 'center';

        const dateSpan = document.createElement('span');
        dateSpan.textContent = dateStr;
        h3.appendChild(dateSpan);

        // Day Route Button
        if (dayEvents.length > 0 && window.MapManager) {
            const btnRoute = document.createElement('button');
            btnRoute.className = 'nav-btn small';
            btnRoute.innerHTML = '🗺️ Route';
            btnRoute.style.fontSize = '0.8rem';
            btnRoute.onclick = () => MapManager.renderDailyRoute(dayEvents, dateStr);
            h3.appendChild(btnRoute);
        }

        dayDiv.appendChild(h3);

        // Entries
        dayEvents.forEach(item => {
            const row = document.createElement('div');
            row.className = `diary-item ${item.type}`;
            row.style.marginBottom = '0'; // Handled by padding-bottom in CSS

            const timeStr = new Date(item.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            let htmlContent = '';
            let icon = '📍'; // Default pin

            // Build text purely (no edit buttons)
            if (item.type === 'stationary') {
                const name = item.location.name || 'Unknown Place';
                const dur = formatDuration(item.startTime, item.endTime);
                htmlContent = `Arrived at <strong>${name}</strong>.`;
                if (dur) htmlContent += ` Stayed for ${dur}.`;
                if (item.location.address && item.location.enriched) htmlContent += `<br><span style="font-size:0.85em; color:#555;">${item.location.address}</span>`;
            } else {
                const sName = item.startLocation.name || 'Unknown';
                const eName = item.endLocation.name || 'Unknown';
                const rawMode = (item.activityType || 'MOVING');
                const mode = rawMode.replace('IN_', '').replace('_', ' ').toLowerCase();
                const dist = item.distance > 1000 ? (item.distance / 1000).toFixed(1) + ' km' : item.distance + ' m';

                // Icon Mapping
                if (rawMode.includes('WALK')) icon = '🚶';
                else if (rawMode.includes('RUN')) icon = '🏃';
                else if (rawMode.includes('BICYCLE') || rawMode.includes('CYC')) icon = '🚲';
                else if (rawMode.includes('VEHICLE') || rawMode.includes('DRIV')) icon = '🚗';
                else if (rawMode.includes('BUS')) icon = '🚌';
                else if (rawMode.includes('TRAIN') || rawMode.includes('SUBWAY')) icon = '🚆';
                else if (rawMode.includes('FLY')) icon = '✈️';
                else if (rawMode.includes('FERRY')) icon = '⛴️';
                else icon = '🚀'; // Moving generic

                htmlContent = `Traveled ${dist} by <strong>${mode}</strong> from <strong>${sName}</strong> to <strong>${eName}</strong>.`;
            }

            if (item.userNote) {
                htmlContent += `<div style="background:#fff9c4; font-family:'Comic Sans MS'; padding:5px; margin-top:4px; font-size:0.9em;">📝 ${item.userNote}</div>`;
            }

            // Actions Container (Map | Edit)
            const actionsDiv = document.createElement('div');
            actionsDiv.style.marginTop = '6px';
            actionsDiv.style.display = 'flex';
            actionsDiv.style.gap = '10px';
            actionsDiv.style.fontSize = '0.85em';

            // Map Toggle
            const hasCoords = (item.type === 'stationary' && item.lat) || (item.type === 'moving' && item.startLat);
            if (hasCoords && window.MapManager) {
                const mapBtn = document.createElement('button');
                mapBtn.innerHTML = '🗺️ Show Map';
                mapBtn.style.border = '1px solid #ddd';
                mapBtn.style.borderRadius = '12px';
                mapBtn.style.background = '#fff';
                mapBtn.style.padding = '2px 8px';
                mapBtn.style.cursor = 'pointer';
                const mapContainerId = `map-${item.startTime.getTime()}`;

                mapBtn.onclick = (e) => {
                    e.stopPropagation();
                    let mapDiv = document.getElementById(mapContainerId);
                    if (!mapDiv) {
                        mapDiv = document.createElement('div');
                        mapDiv.id = mapContainerId;
                        mapDiv.style.height = '200px';
                        mapDiv.style.width = '100%';
                        mapDiv.style.marginTop = '10px';
                        mapDiv.style.borderRadius = '8px';
                        row.appendChild(mapDiv);
                        mapBtn.innerHTML = '🗺️ Hide Map';
                        if (item.type === 'stationary') MapManager.initEntryMap(mapContainerId, item.lat, item.lng, `<b>${item.location.name}</b>`);
                        else if (item.startLat) MapManager.initEntryMap(mapContainerId, item.startLat, item.startLng, `Start: ${item.startLocation.name}`);
                    } else {
                        if (mapDiv.style.display === 'none') {
                            mapDiv.style.display = 'block';
                            mapBtn.innerHTML = '🗺️ Hide Map';
                        } else {
                            mapDiv.style.display = 'none';
                            mapBtn.innerHTML = '🗺️ Show Map';
                        }
                    }
                };
                actionsDiv.appendChild(mapBtn);
            }

            // Edit Button (Re-added)
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✎ Edit';
            editBtn.style.background = 'none';
            editBtn.style.border = 'none';
            editBtn.style.cursor = 'pointer';
            editBtn.style.color = '#777';
            editBtn.onclick = () => {
                if (item.type === 'stationary') openEditModal(item.lat, item.lng, item.location.name);
                else alert("Edit moving locations via 'Personal Places' for now.");
            };
            actionsDiv.appendChild(editBtn);

            row.innerHTML = `<span class="time" style="font-weight:bold; color:#555;">${timeStr} ${icon}</span> <span class="narrative">${htmlContent}</span>`;
            row.appendChild(actionsDiv);

            dayDiv.appendChild(row);
        });

        contentPage.appendChild(dayDiv);
    });

    printContainer.appendChild(contentPage);

    // 6. ANNEXURE
    const annexPage = document.createElement('div');
    annexPage.className = 'print-annex-page';
    if (typeof generateLocationAnnexure === 'function') {
        annexPage.innerHTML = generateLocationAnnexure(dataToExport);
        annexPage.style.breakBefore = 'page';
        annexPage.style.pageBreakBefore = 'always';
        printContainer.appendChild(annexPage);
    }

    // 7. PRINT (IFRAME ISOLATION)
    setTimeout(() => {
        // Create Iframe
        let iframe = document.getElementById('print-iframe');
        if (iframe) iframe.remove();
        iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '-9999px';
        iframe.title = 'Print Preview';
        document.body.appendChild(iframe);

        // Copy Content
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<!DOCTYPE html><html><head><title>Diary Export</title></head><body></body></html>');
        doc.close();

        // Inject Styles
        const style = doc.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Roboto:wght@300;400;500&display=swap');
            @media print {
                @page { margin: 1cm; size: A4; }
                body { font-family: 'Merriweather', serif; font-size: 11pt; color: #000; background: #fff; }
                h1, h2, h3 { color: #000; break-after: avoid; }
                .diary-entry { break-inside: avoid; page-break-inside: avoid; margin-bottom: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 1rem; }
                .print-cover-page { break-after: page; height: 90vh; display: flex; flex-direction: column; justify-content: center; text-align: center; }
                .print-stats-page { break-after: page; }
                .print-chapter-break { break-before: page; margin-bottom: 2rem; border-bottom: 2px solid #333; padding-bottom: 1rem; }
                .toc-container { break-after: page; }
                .toc-table { width: 100%; border-collapse: collapse; }
                .toc-table td { padding: 5px; border-bottom: 1px solid #eee; }
            }
        `;
        doc.head.appendChild(style);

        // Safe Link to Main Styles
        const mainStyle = doc.createElement('link');
        mainStyle.rel = 'stylesheet';
        mainStyle.href = 'css/style.css';
        doc.head.appendChild(mainStyle);

        // Move Content to Iframe and Show
        const clone = printContainer.cloneNode(true);
        clone.style.display = 'block'; // Make visible in Iframe
        doc.body.appendChild(clone);

        // Clean up main doc
        printContainer.remove();

        // Print
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 500);

    }, 500);
}

// Attach Listener
const btnExport = document.getElementById('btn-export');
if (btnExport) {
    // Remove old listeners? Hard to do without reference.
    // Clone and replace to strip old listener
    const newBtn = btnExport.cloneNode(true);
    btnExport.parentNode.replaceChild(newBtn, btnExport);
    newBtn.addEventListener('click', handlePrintExport);
}

// --- Archives Logic ---

function openArchives() {
    if (!currentEntries || currentEntries.length === 0) {
        alert("No data loaded.");
        return;
    }
    renderArchives();
    switchView('archives');
}

function renderArchives() {
    const grid = document.getElementById('archives-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Group by Month (YYYY-MM)
    const months = {};

    currentEntries.forEach(e => {
        const d = new Date(e.startTime);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

        if (!months[key]) {
            months[key] = { label: label, count: 0, entries: [] };
        }
        months[key].count++;
        months[key].entries.push(e);
    });

    // Sort Keys Descending (Newest First)
    const sortedKeys = Object.keys(months).sort().reverse();

    sortedKeys.forEach(key => {
        const m = months[key];

        const card = document.createElement('div');
        card.className = 'archive-card';

        card.innerHTML = `
            <div class="archive-header">
                <h3 class="archive-title">${m.label}</h3>
                <div class="archive-stats">${m.count} Events</div>
            </div>
            <div class="archive-actions">
                <button class="btn-view-month">View</button>
                <button class="btn-download-month">Download JSON</button>
            </div>
        `;

        // Listeners
        const btnView = card.querySelector('.btn-view-month');
        btnView.addEventListener('click', () => {
            // Set Filters to this month
            const [y, mm] = key.split('-');
            const lastDay = new Date(y, mm, 0).getDate();

            document.getElementById('search-date-from').value = `${key}-01`;
            document.getElementById('search-date-to').value = `${key}-${lastDay}`;
            document.getElementById('search-location').value = ""; // Clear location

            applyFilters();
            switchView('book');
        });

        const btnDown = card.querySelector('.btn-download-month');
        btnDown.addEventListener('click', () => {
            exportData(m.entries);
        });

        grid.appendChild(card);
    });
}

// Extra Listeners
if (document.getElementById('btn-view-archives')) {
    document.getElementById('btn-view-archives').addEventListener('click', openArchives);
}
// --- Weather Logic (App Side) ---

let isWeatherScanning = false;
let isWeatherPaused = false;
let shouldStopWeather = false;

async function fetchWeatherForCurrentView() {
    if (isWeatherScanning) {
        if (confirm("Scan is stuck. Reset and try again?")) {
            isWeatherScanning = false;
            if (document.getElementById('weather-progress')) {
                document.getElementById('weather-progress').style.display = 'none';
            }
            if (document.getElementById('btn-weather')) document.getElementById('btn-weather').style.display = 'inline-block';
            if (document.getElementById('btn-enhance')) document.getElementById('btn-enhance').style.display = 'inline-block';
        }
        return;
    }

    if (!currentEntries || currentEntries.length === 0) {
        alert("No diary entries loaded to fetch weather for.");
        return;
    }

    // Dynamic Element Lookup (Robustness fix)
    const progress = document.getElementById('weather-progress');
    const btnPause = document.getElementById('btn-weather-pause');
    const btnStop = document.getElementById('btn-weather-stop');

    // Restore UI references
    const fill = progress ? progress.querySelector('.fill') : null;
    const text = progress ? progress.querySelector('.text') : null;

    if (!progress || !btnPause || !btnStop) {
        alert("Error: Weather UI missing. Please refresh.");
        return;
    }

    // Initialize DOM State
    btnPause.dataset.paused = "false";
    btnStop.dataset.stop = "false";
    btnPause.textContent = "⏸";

    // Setup Listeners (Once)
    btnPause.onclick = (e) => {
        e.stopPropagation();
        const isPaused = btnPause.dataset.paused === "true";
        const newState = !isPaused;
        btnPause.dataset.paused = newState.toString();
        btnPause.textContent = newState ? "▶ Resume" : "⏸";
        // DEBUG FEEDBACK
        if (text) text.textContent = newState ? "PAUSED" : "Resuming...";
    };

    btnStop.onclick = (e) => {
        e.stopPropagation();
        btnStop.dataset.stop = "true";
        btnPause.dataset.paused = "false";
        if (text) text.textContent = "STOPPING...";
    };

    // Reset Visuals
    isWeatherScanning = true;

    // Show Progress (Force Inline + Class)
    const btnWeather = document.getElementById('btn-weather');
    const btnEnhance = document.getElementById('btn-enhance');

    if (btnWeather) btnWeather.style.display = 'none';
    if (btnEnhance) btnEnhance.style.display = 'none';

    progress.classList.add('active');

    // ROBUST VISIBILITY (Standard styling, forced visible)
    progress.style.removeProperty('display');
    progress.style.display = 'inline-flex';
    progress.style.visibility = 'visible';
    progress.style.opacity = '1';
    progress.style.zIndex = '2147483647';
    progress.style.position = 'fixed';
    progress.style.bottom = '20px';
    progress.style.right = '20px';
    progress.style.background = '#ffffff';
    progress.style.border = '1px solid #90caf9';

    if (text) text.textContent = "Initializing...";

    // Prepare Queue
    const days = {};
    try {
        currentEntries.forEach(e => {
            const d = new Date(e.startTime);
            const key = d.toISOString().split('T')[0];
            if (!days[key]) days[key] = [];
            days[key].push(e);
        });
    } catch (err) {
        alert("CRITICAL ERROR PROCESSING DATA: " + err.message);
        console.error(err);
        isWeatherScanning = false;
        return;
    }

    const dates = Object.keys(days).sort();
    const total = dates.length;
    let index = 0;

    console.log(`Starting Weather Scan: ${total} days`);
    // alert("DEBUG: Loop Starting. Total days: " + total);

    // Recursive Processor
    const processNext = async () => {
        // alert("DEBUG: processing index " + index);

        // Read State from DOM
        const stopRequested = btnStop.dataset.stop === "true";
        const pauseRequested = btnPause.dataset.paused === "true";

        // 1. Cleanup Check
        if (index >= total || stopRequested) {
            progress.classList.remove('active'); // Hide overlay
            progress.style.display = 'none'; // Force hide
            if (btnWeather) btnWeather.style.display = 'inline-block';
            if (btnEnhance) btnEnhance.style.display = 'inline-block';
            renderBook(currentEntries);

            isWeatherScanning = false; // Release Lock

            // Allow paint before alert
            setTimeout(() => {
                alert(stopRequested ? "Weather scan stopped." : "Weather scan complete.");
            }, 50);
            return;
        }

        // 2. Pause Check
        if (pauseRequested) {
            setTimeout(processNext, 500); // Check again in 500ms
            return;
        }

        // 3. Process Day
        const dateStr = dates[index];
        const dayEvents = days[dateStr];

        // Date Format: Local (User Settings)
        const [y, m, d] = dateStr.split('-').map(Number);
        const localDate = new Date(y, m - 1, d);
        text.textContent = `Scanning: ${localDate.toLocaleDateString()}`;

        const pct = Math.round(((index + 1) / total) * 100);
        fill.style.width = `${pct}%`;

        // Logic
        const hasWeather = dayEvents.some(e => e.weather);
        if (!hasWeather) {
            // Find Location
            const refEvent = dayEvents.find(e => e.type === 'stationary' && e.lat && e.lng)
                || dayEvents.find(e => e.type === 'moving' && e.startLat && e.startLng)
                || dayEvents[0];

            let lat, lng;
            if (refEvent) {
                if (refEvent.type === 'stationary') { lat = refEvent.lat; lng = refEvent.lng; }
                else if (refEvent.type === 'moving') { lat = refEvent.startLat || refEvent.startLatitudeE7 / 1e7; lng = refEvent.startLng || refEvent.startLongitudeE7 / 1e7; }
            }

            if (lat && lng) {
                try {
                    const w = await WeatherService.getDailyWeather(lat, lng, dateStr);
                    if (w) {
                        dayEvents[0].weather = w;
                        await DiaryStore.addEvents([dayEvents[0]]);
                    }
                } catch (e) { console.error(e); }

                // Delay for API limits
                setTimeout(() => {
                    index++;
                    processNext();
                }, 200);
            } else {
                // No loc, skip fast
                index++;
                setTimeout(processNext, 5);
            }
        } else {
            // Exists, skip fast
            index++;
            setTimeout(processNext, 5);
        }
    };

    // Kickoff with visual safeguard
    progress.style.zIndex = "2147483647";
    try {
        processNext().catch(err => {
            console.error("Weather Scan Error:", err);
            isWeatherScanning = false;
            progress.style.display = 'none';
            if (btnWeather) btnWeather.style.display = 'inline-block';
            alert("Weather scan failed to start.");
        });
    } catch (e) {
        isWeatherScanning = false;
        console.error(e);
    }
}

// --- TOC Generator ---
function generateTOC(entries) {
    if (!entries || entries.length === 0) return '';

    const months = {};
    entries.forEach(e => {
        const d = new Date(e.startTime);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

        if (!months[key]) months[key] = { label: label, count: 0 };
        months[key].count++;
    });

    // Chronological Sort (Oldest first)
    const sortedKeys = Object.keys(months).sort();

    let html = `
        <div class="toc-container">
            <h1>Index</h1>
            <table class="toc-table">
                <thead>
                    <tr>
                        <th>Month</th>
                        <th style="width: 150px; text-align: right;">Events</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedKeys.forEach(key => {
        const m = months[key];

        html += `
            <tr>
                <td><strong>${m.label}</strong></td>
                <td style="text-align: right;">${m.count} entries</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <div style="page-break-after: always;"></div>
    `;

    return html;
}
// --- Location Annexure Generator ---
function generateLocationAnnexure(entries) {
    if (!entries || entries.length === 0) return '';

    const locationCounts = {};

    entries.forEach(e => {
        // stationary
        if (e.type === 'stationary') {
            const name = e.location.name;
            if (name && !isGenericLocation(name)) {
                locationCounts[name] = (locationCounts[name] || 0) + 1;
            }
        }
        // moving
        else if (e.type === 'moving') {
            const sName = e.startLocation.name;
            if (sName && !isGenericLocation(sName)) {
                locationCounts[sName] = (locationCounts[sName] || 0) + 1;
            }
            const eName = e.endLocation.name;
            if (eName && !isGenericLocation(eName)) {
                locationCounts[eName] = (locationCounts[eName] || 0) + 1;
            }
        }
    });

    // Convert to array and sort A-Z
    const sortedLocs = Object.keys(locationCounts).map(name => ({
        name: name,
        count: locationCounts[name]
    })).sort((a, b) => a.name.localeCompare(b.name));

    if (sortedLocs.length === 0) return '';

    let html = `
        <div style="page-break-before: always;"></div>
            <div class="toc-container">
                <h1>Annexure: Locations Visited</h1>
                <table class="toc-table">
                    <thead>
                        <tr>
                            <th>Location Name</th>
                            <th style="width: 100px; text-align: center;">Visits</th>
                        </tr>
                    </thead>
                    <tbody>
                        `;

    sortedLocs.forEach(loc => {
        html += `
            <tr>
                <td>${loc.name}</td>
                <td style="text-align: center;">${loc.count}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
    `;

    return html;
}

// --- Map Integration ---
let mapInstance = null;

const ACTIVITY_COLORS = {
    'IN_PASSENGER_VEHICLE': '#2196F3', // Blue
    'IN_VEHICLE': '#2196F3',
    'DRIVING': '#1976D2', // Darker Blue
    'MOTORCYCLING': '#5E35B1', // Deep Purple
    'WALKING': '#4CAF50', // Green
    'RUNNING': '#2E7D32', // Dark Green
    'ON_BICYCLE': '#9C27B0', // Purple
    'FLYING': '#F44336', // Red
    'IN_FERRY': '#00BCD4', // Cyan
    'IN_TRAM': '#00ACC1',
    'IN_SUBWAY': '#006064',
    'IN_BUS': '#039BE5',
    'IN_TRAIN': '#FF9800', // Orange
    'STILL': '#9E9E9E', // Gray
    'UNKNOWN': '#757575'
};

function openMap(pathData, title, activityType = 'UNKNOWN') {
    if (!pathData || pathData.length === 0) return;

    const modal = document.getElementById('map-modal');
    modal.style.display = 'flex';

    // Update Title if modal has one? (Optional enhancement)

    // Initialize Map if needed
    if (!mapInstance) {
        mapInstance = L.map('map-container');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance);
    } else {
        // Clear previous layers
        mapInstance.eachLayer((layer) => {
            if (!layer._url) mapInstance.removeLayer(layer); // Keep tiles, remove others
        });
    }

    // Prepare LatLngs
    const latLngs = pathData.map(p => [p.lat, p.lng]);

    // Determine Color
    let color = '#757575'; // Default Gray
    if (activityType) {
        // Normalize type (handle raw Google types like "IN_PASSENGER_VEHICLE")
        const typeKey = activityType.toUpperCase();
        if (ACTIVITY_COLORS[typeKey]) color = ACTIVITY_COLORS[typeKey];
        // Handle partial matches if needed, or fallback
    }

    // Draw Polyline
    const polyline = L.polyline(latLngs, { color: color, weight: 5, opacity: 0.8 }).addTo(mapInstance);

    // Add Markers (Start & End)
    if (latLngs.length > 0) {
        L.circleMarker(latLngs[0], { color: 'green', radius: 6, fillOpacity: 1 }).addTo(mapInstance).bindPopup("Start");
        L.circleMarker(latLngs[latLngs.length - 1], { color: 'red', radius: 6, fillOpacity: 1 }).addTo(mapInstance).bindPopup("End");
    }

    // Fit Bounds
    setTimeout(() => {
        mapInstance.invalidateSize();
        mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }, 100);
}

// Close Map Modal Logic
// Close Map Modal Logic
document.querySelectorAll('#map-modal .close-btn, #map-modal').forEach(el => {
    el.addEventListener('click', (e) => {
        if (e.target === el) {
            document.getElementById('map-modal').style.display = 'none';
        }
    });
});



// --- Force Reload (Nuclear Option) ---
if (document.getElementById('btn-force-reload')) {
    document.getElementById('btn-force-reload').addEventListener('click', async () => {
        if (!confirm("This will clear all cached app data (updates) and reload. Your diary entries are safe. Continue?")) return;

        const btn = document.getElementById('btn-force-reload');
        btn.disabled = true;
        btn.textContent = "Cleaning...";

        // 1. Unregister Service Workers (Best Effort)
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log("SW Unregistered");
            }
        } catch (e) { console.warn("SW Cleanup Skipped:", e); }

        // 2. Clear Cache Storage (Best Effort)
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                for (const key of keys) {
                    await caches.delete(key);
                }
                console.log("Caches Cleared");
            }
        } catch (e) { console.warn("Cache Cleanup Skipped:", e); }

        // 3. Force Reload
        console.log("Reloading...");
        window.location.reload(true);
    });
}

// --- Restored Navigation Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const bindNav = (id, view, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => {
            if (typeof switchView === 'function') switchView(view);
            if (callback) callback();
        });
    };

    bindNav('btn-binder', 'binder');
    bindNav('btn-archives', 'archives', () => window.renderArchives && window.renderArchives());
    bindNav('btn-locations', 'locations', () => window.renderLocationsTable && window.renderLocationsTable());
    bindNav('btn-stats', 'analytics');
    bindNav('btn-import', 'onboarding');
});
