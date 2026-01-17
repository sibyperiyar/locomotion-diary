/**
 * Locomotion Diary - Database Layer
 * Wraps IndexedDB for persistent storage of diary events.
 */

const DB_NAME = 'LocomotionDiaryDB';
const DB_VERSION = 1;
const STORE_EVENTS = 'events';

// Make global for non-module support
window.DiaryStore = {
    db: null,

    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_EVENTS)) {
                    // Key path is startTime (unique per event usually, but we might have collisions so we'll use a composite or just simple key)
                    // Let's use 'id' if we generate one, or composite. 
                    // To keep it simple and allow deduplication, we'll generate a unique ID based on StartTime + Type.
                    const store = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
                    store.createIndex('startTime', 'startTime', { unique: false });
                    store.createIndex('year', 'year', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            request.onerror = (e) => {
                console.error("DB Open Error:", e);
                reject(e);
            };
        });
    },

    /**
     * Generates a unique ID for an event to aid in deduplication.
     * ID format: "TYPE_STARTTIMEMS" (e.g., "stationary_1700000000000")
     */
    generateId(event) {
        if (event.id) return event.id;
        return `${event.type}_${event.startTime.getTime()}`;
    },

    /**
     * Adds or Updates events in the database.
     * @param {Array} events - List of event objects
     */
    async addEvents(events) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = transaction.objectStore(STORE_EVENTS);

            events.forEach(event => {
                // Ensure ID
                event.id = this.generateId(event);

                // Ensure Year index field
                const d = new Date(event.startTime);
                event.year = d.getFullYear();

                // We use put() to overwrite/update counterparts
                // NOTE: If we want to preserve 'userNote' when re-importing, 
                // we technically need to read first check if note exists, then merge.
                // But for bulk imports this is slow. 
                // Optimized approach: put() replaces. 
                // TODO: For "Smart Merge", we might need a more complex logic later.
                // For now, let's assume 'put' is fine, or we handle merge logic *before* calling this.
                store.put(event);
            });

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (e) => {
                console.error("Tx Error", e);
                reject(e);
            };
        });
    },

    /**
     * Smartly merges new events, preserving existing user amendments (like Notes).
     */
    async mergeEvents(newEvents) {
        await this.open();

        // 1. Get IDs of new events to check against DB
        // Optimization: Checking them one by one is slow.
        // Better: We just blindly save them EXCEPT if they have a note/manual edit in DB?
        // Let's try to do a bulk read? No, too big.

        // Strategy: 
        // 1. We overwrite "Narrative", "Location", "Coords" from the File (Source of Truth for raw data)
        // 2. BUT we want to keep "UserNote" if it exists in DB.

        // Since IndexedDB doesn't update partial fields easily without reading,
        // we will implement a "Read-Modify-Write" loop for safety, but maybe only for events that collide.

        // For Phase 1 performance: Let's assume we *prefer* the file data, 
        // but if we implement Notes, we MUST preserve them.

        // Let's use a Cursor to iterate? Or just `put` if we assume file is master?
        // User Requirement: "Enrichable JSON... Adding by merging".

        const transaction = this.db.transaction([STORE_EVENTS], 'readwrite');
        const store = transaction.objectStore(STORE_EVENTS);

        return new Promise((resolve, reject) => {
            let completed = 0;
            const total = newEvents.length;

            if (total === 0) {
                resolve();
                return;
            }

            // Helper to process one item
            const processItem = (event) => {
                event.id = this.generateId(event);
                event.year = new Date(event.startTime).getFullYear();

                // Check existence
                const request = store.get(event.id);
                request.onsuccess = (e) => {
                    const existing = e.target.result;
                    if (existing) {
                        // MERGE STRATEGY:
                        // 1. Preserve User Note
                        if (existing.userNote) {
                            event.userNote = existing.userNote;
                        }
                        // 2. Preserve Manual Location Edits? 
                        // If user edited location using our App, 'enriched' is true/custom?
                        // If file is raw, we might want to keep DB version?
                        // Let's assume File is "Fresh Import" and might have better data, 
                        // UNLESS we explicitly flagged a manual edit. 
                        // In app.js `savePlace` updates `locomotion_places` (localStorage), 
                        // so location names are re-generated on render anyway!
                        // SO: We mostly care about `userNote`.
                    }
                    store.put(event); // Save merged/new
                };
            };

            // Loop
            newEvents.forEach(evt => processItem(evt));

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e);
        });
    },

    async saveNote(eventId, noteText) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = tx.objectStore(STORE_EVENTS);
            const req = store.get(eventId);

            req.onsuccess = (e) => {
                const data = e.target.result;
                if (data) {
                    data.userNote = noteText;
                    store.put(data);
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject();
        });
    },

    async getEventsByYear(year) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_EVENTS], 'readonly');
            const store = transaction.objectStore(STORE_EVENTS);
            const index = store.index('year');
            const request = index.getAll(IDBKeyRange.only(parseInt(year)));

            request.onsuccess = (e) => {
                // Return sorted by start time
                const res = e.target.result;
                res.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
                resolve(res);
            };
            request.onerror = reject;
        });
    },

    async getAllYears() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_EVENTS], 'readonly');
            const store = transaction.objectStore(STORE_EVENTS);
            const index = store.index('year');
            const request = index.openKeyCursor(null, "nextunique");

            const years = [];
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    years.push(cursor.key);
                    cursor.continue();
                } else {
                    resolve(years.sort((a, b) => b - a)); // Descending
                }
            };
            request.onerror = reject;
        });
    },

    async count() {
        await this.open();
        return new Promise((resolve) => {
            const req = this.db.transaction([STORE_EVENTS], 'readonly').objectStore(STORE_EVENTS).count();
            req.onsuccess = () => resolve(req.result);
        });
    },

    /**
     * Deletes a single event by ID.
     */
    async deleteEvent(id) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = tx.objectStore(STORE_EVENTS);
            const req = store.delete(id);

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    },

    /**
     * Deletes events within a specific time range.
     */
    async deleteEventsByRange(dateFrom, dateTo) {
        await this.open();
        return new Promise((resolve, reject) => {
            // We need to iterate and delete because the index is on 'startTime' but delete works on key.
            // Or use a cursor.
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = tx.objectStore(STORE_EVENTS);
            const index = store.index('startTime');
            const range = IDBKeyRange.bound(dateFrom, dateTo);

            const req = index.openCursor(range);

            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    },

    /**
     * Clears ALL events from the database.
     */
    async clearAllEvents() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = tx.objectStore(STORE_EVENTS);
            const req = store.clear();

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    }
};
