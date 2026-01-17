// --- Global Drop Protection ---
// Prevents the browser from opening files dropped outside the drop zone
window.addEventListener('dragover', function (e) {
    e.preventDefault();
}, false);

window.addEventListener('drop', function (e) {
    e.preventDefault();
}, false);

// --- Parser Logic (Inlined) ---
async function parseTimeline(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const data = JSON.parse(text);
                const events = [];

                let rawObjects = [];

                if (data.timelineObjects) {
                    rawObjects = data.timelineObjects;
                } else if (Array.isArray(data)) {
                    rawObjects = data;
                } else if (data.locations) {
                    console.warn("Raw 'locations' array found. This might be raw GPS data.");
                    // Attempt to parse anyway if possible, but usually this format is just lat/lngs.
                    // For now, let's treat it as empty or warn.
                }

                rawObjects.forEach(obj => {
                    if (obj.activitySegment) {
                        events.push(parseActivity(obj.activitySegment));
                    } else if (obj.placeVisit) {
                        events.push(parseVisit(obj.placeVisit));
                    }
                });

                resolve(events);

            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function parseActivity(segment) {
    const start = new Date(parseInt(segment.duration.startTimestampMs));
    const end = new Date(parseInt(segment.duration.endTimestampMs));
    const type = segment.activityType || 'MOVING';
    const cleanType = type.replace('IN_', '').replace('_', ' ').toLowerCase();

    let startLoc = segment.startLocation && segment.startLocation.name ? segment.startLocation.name : 'Unknown location';
    let endLoc = segment.endLocation && segment.endLocation.name ? segment.endLocation.name : 'Unknown destination';

    const narrative = `Started from ${startLoc}. Traveled by ${cleanType} to ${endLoc}.`;

    return {
        type: 'moving',
        startTime: start,
        endTime: end,
        narrative: narrative,
        details: segment
    };
}

function parseVisit(visit) {
    const start = new Date(parseInt(visit.duration.startTimestampMs));
    const end = new Date(parseInt(visit.duration.endTimestampMs));
    const placeName = visit.location.name || visit.location.address || "Unsaved Place";

    const diffMs = end - start;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    let durStr = "";
    if (diffHrs > 0) durStr += `${diffHrs} hr `;
    durStr += `${diffMins} min`;

    const narrative = `Reached ${placeName}. Spent ${durStr} here.`;

    return {
        type: 'stationary',
        startTime: start,
        endTime: end,
        narrative: narrative,
        details: visit
    };
}

// --- App Logic ---
console.log('Locomotion Diary App Initializing...');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const viewOnboarding = document.getElementById('view-onboarding');
const viewBook = document.getElementById('view-book');
const bookContent = document.getElementById('book-content');

// Events
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

document.getElementById('btn-back').addEventListener('click', () => {
    switchView('onboarding');
});

function handleFile(file) {
    if (!file) return;

    dropZone.innerHTML = '<div class="icon">⏳</div><p>Processing...</p>';

    console.log('Handling file:', file.name);

    parseTimeline(file).then(entries => {
        console.log('Parsed entries:', entries.length);
        if (entries.length === 0) {
            alert('No timeline events found. Please make sure you uploaded a Semantic Location History JSON (e.g., "2023_JANUARY.json").');
            dropZone.innerHTML = '<div class="icon">⚠️</div><p>No events found.<br>Try another file.</p>';
            return;
        }
        renderBook(entries);
        switchView('book');
    }).catch(error => {
        console.error('Error parsing file:', error);
        alert('Error parsing file: ' + error.message);
        dropZone.innerHTML = '<div class="icon">❌</div><p>Error processing file.</p>';
    });
}

function switchView(viewName) {
    if (viewName === 'book') {
        viewOnboarding.classList.remove('active');
        viewBook.classList.add('active');
    } else {
        viewBook.classList.remove('active');
        viewOnboarding.classList.add('active');
        // Reset drop zone
        dropZone.innerHTML = '<div class="icon">📂</div><p>Drag & Drop <strong>Records.json</strong> here</p><p class="small">or click to select file</p><input type="file" id="file-input" accept=".json" hidden>';
    }
}

function renderBook(entries) {
    bookContent.innerHTML = '';

    const grouped = {};
    entries.forEach(entry => {
        const dateKey = new Date(entry.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
    });

    for (const [date, dayEntries] of Object.entries(grouped)) {
        const daySection = document.createElement('div');
        daySection.className = 'diary-entry';

        const dateHeader = document.createElement('h3');
        dateHeader.className = 'diary-date';
        dateHeader.textContent = date;
        daySection.appendChild(dateHeader);

        dayEntries.forEach(item => {
            const div = document.createElement('div');
            div.className = `diary-item ${item.type}`;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'time';
            const timeStr = new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeSpan.textContent = timeStr;

            const p = document.createElement('p');
            p.className = 'narrative';
            p.textContent = item.narrative;

            div.appendChild(timeSpan);
            div.appendChild(p);
            daySection.appendChild(div);
        });

        bookContent.appendChild(daySection);
    }
}
