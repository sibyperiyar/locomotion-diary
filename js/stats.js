/**
 * stats.js - Analytics Module for Locomotion Diary
 * Calculates and visualizes "Life Statistics" from the diary entries.
 */

// Global Stats Object
const DiaryStats = {

    generate(entries, allYearsCount = null) {
        if (!entries || entries.length === 0) return null;

        const stats = {
            totalEvents: entries.length,
            totalDistanceKm: 0,
            timeRange: { start: null, end: null },
            activityTypeCounts: {},
            topLocations: {},
            activeYearsCount: allYearsCount || 0,
            tripsByYear: {}
        };

        // Date Range
        entries.sort((a, b) => a.startTime - b.startTime);
        stats.timeRange.start = new Date(entries[0].startTime);
        stats.timeRange.end = new Date(entries[entries.length - 1].startTime);

        entries.forEach(e => {
            const year = new Date(e.startTime).getFullYear();
            if (!stats.tripsByYear[year]) stats.tripsByYear[year] = 0;
            stats.tripsByYear[year]++;

            // Moving: Distance & Type
            if (e.type === 'moving') {
                const d = Number(e.distance); // Ensure number
                if (!isNaN(d)) {
                    stats.totalDistanceKm += (d / 1000); // meters to km
                }

                // Activity Type
                let activity = e.activityType || "UNKNOWN";
                stats.activityTypeCounts[activity] = (stats.activityTypeCounts[activity] || 0) + 1;
            }

            // Stationary: Locations
            if (e.type === 'stationary') {
                const name = e.location.name;
                // 1. Always track raw count for fallback
                stats.topLocations[name] = (stats.topLocations[name] || 0) + 1;
            }
        });

        // Refine Top Locations
        // Filter out generic ones, BUT if that leaves us with nothing, keep the raw list
        const entriesArr = Object.entries(stats.topLocations);
        const filtered = entriesArr.filter(([name, val]) => !isGenericLocation(name));

        if (filtered.length > 0) {
            // Reconstruct object from filtered
            stats.topLocations = Object.fromEntries(filtered);
        } else {
            // Keep raw, but maybe remove the absolute worst offenders if possible, 
            // or just leave it so the user sees *something* (e.g. addresses)
            // Let's just remove "Unknown Location" specifically
            const partlyClean = entriesArr.filter(([n]) => !n.toLowerCase().includes('unknown'));
            if (partlyClean.length > 0) stats.topLocations = Object.fromEntries(partlyClean);
        }

        // If no global count passed, use local calculation
        if (!stats.activeYearsCount) {
            stats.activeYearsCount = Object.keys(stats.tripsByYear).length;
        }

        stats.totalDistanceKm = Math.round(stats.totalDistanceKm);
        return stats;
    },

    render(stats, entries) {
        console.log("Stats.render called with:", stats ? "Valid Stats" : "Null");

        // Force Visibility Check
        const mainContainer = document.getElementById('analytics-content');
        if (mainContainer) {
            mainContainer.style.display = 'block';
            mainContainer.style.opacity = '1';
        }

        // 1. Stat Cards
        const cardContainer = document.getElementById('stat-cards');
        console.log("Card Container Found:", !!cardContainer);

        if (cardContainer) {
            const startStr = stats.timeRange.start ? stats.timeRange.start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '-';
            const endStr = stats.timeRange.end ? stats.timeRange.end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '-';

            const html = `
                <div class="stat-card hero">
                    <h3>Total Distance</h3>
                    <div class="big-number">${stats.totalDistanceKm.toLocaleString()} <span class="unit">km</span></div>
                    <p>Moving across the world</p>
                </div>
                
                <div class="stat-card">
                    <h3>Entries</h3>
                    <div class="big-number">${stats.totalEvents.toLocaleString()}</div>
                    <p>Moments recorded</p>
                </div>

                <div class="stat-card">
                    <h3>Active Years</h3>
                    <div class="big-number">${stats.activeYearsCount}</div>
                    <p>${startStr} - ${endStr}<br><span style="font-size:0.7em">(In View)</span></p>
                </div>
            `;
            cardContainer.innerHTML = html;
            console.log("Card HTML injected. Length:", html.length);
        } else {
            console.error("Missing ID: stat-cards");
        }

        // 2. Transport Mode Chart (Pie)
        const ctx = document.getElementById('modeChart');
        if (ctx) {
            // Destroy old if exists
            if (window.myModeChart instanceof Chart) {
                window.myModeChart.destroy();
            }

            const labels = Object.keys(stats.activityTypeCounts);
            const data = Object.values(stats.activityTypeCounts);

            // Check if Chart is loaded
            if (typeof Chart !== 'undefined') {
                // Vibrant Colors
                const colors = [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', '#71B37C'
                ];

                window.myModeChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels.map(l => l.replace(/_/g, ' ')), // Clean labels
                        datasets: [{
                            data: data,
                            backgroundColor: [
                                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right' }
                        }
                    }
                });
            } else {
                // Fallback if offline / blocked
                ctx.parentElement.innerHTML = `
                    <p style="text-align:center; padding: 2rem; color: #888;">
                        Chart not available (Internet required or blocked locally).<br>
                        <strong>Top Activity:</strong> ${labels[0] || 'None'}
                    </p>`;
            }
        }

        // 3. Activity Heatmap
        this.renderHeatmap(stats, entries); // Pass Scope Entries
    },

    renderHeatmap(stats, entries) {
        const hContainer = document.getElementById('activity-heatmap');
        if (!hContainer) return;

        hContainer.innerHTML = ''; // basic clear

        // Data Scan
        events = entries || []; // Use passed entries
        console.log("Heatmap Processing Events:", events.length);

        const dateMap = {}; // "YYYY-MM-DD" -> count

        events.forEach(e => {
            let dObj = new Date(e.startTime); // Start Time is robust
            const dateKey = dObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
            dateMap[dateKey] = (dateMap[dateKey] || 0) + 1;
        });

        // Loop day by day for the Range
        if (!stats.timeRange.start) return;

        const start = new Date(stats.timeRange.start);
        const end = new Date(stats.timeRange.end);

        // Safety: Limit check (max 3 years to prevent crash if range is huge)
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 1200) {
            // Cap at 1 year from start if too big
            end.setTime(start.getTime() + (365 * 24 * 60 * 60 * 1000));
        }

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toLocaleDateString('en-CA');
            const count = dateMap[dateStr] || 0;

            const cell = document.createElement('div');
            cell.className = 'heat-cell';
            const niceDate = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            cell.title = `${niceDate}: ${count} events`;

            // Color scale
            // Color scale (Lowered thresholds for visibility)
            let level = 0;
            if (count > 0) level = 1;
            if (count > 2) level = 2; // Was 2
            if (count > 4) level = 3; // Was 5
            if (count > 8) level = 4; // Was 10

            cell.setAttribute('data-level', level);
            hContainer.appendChild(cell);
        }

        // Ensure Grid Styling
        hContainer.classList.add('heatmap-grid');
    }
};

// Use window globality
window.DiaryStats = DiaryStats;
