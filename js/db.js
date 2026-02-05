/**
 * Locomotion Diary - Database Layer (Encrypted)
 * Wraps IndexedDB for persistent storage of diary events.
 * Supports AES-GCM Encryption for event data while keeping metadata indexable.
 */

const DB_NAME = 'LocomotionDiaryDB';
const DB_VERSION = 1;
const STORE_EVENTS = 'events';

// Make global for non-module support
window.DiaryStore = {
    db: null,
    sessionKey: null, // If set, encryption is active

    /**
     * Enable encryption with a derived session key.
     * @param {CryptoKey} key 
     */
    enableEncryption(key) {
        this.sessionKey = key;
        // Verify it's a CryptoKey (for V2) or String (Legacy fallback, though we shouldn't use it anymore)
        if (key.algorithm) {
            console.log("DiaryStore: Encryption Enabled (V2 Fast Mode).");
        } else {
            console.warn("DiaryStore: Encryption Enabled (Legacy Text Mode). Performance will be degraded.");
        }
    },

    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_EVENTS)) {
                    // Key path is id
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
     * ID format: "TYPE_STARTTIMEMS"
     */
    generateId(event) {
        if (event.id) return event.id;
        const type = event.type || 'unknown';
        const time = event.startTime instanceof Date ? event.startTime.getTime() : new Date(event.startTime).getTime();
        return `${type}_${time}`;
    },

    // --- Encryption Helpers ---

    async encryptNode(event) {
        if (!this.sessionKey || !window.CryptoHelper) return event; // Pass through if no key

        try {
            let encryptedBlob;

            // Check if V2 (CryptoKey) or V1 (Password String)
            if (this.sessionKey.algorithm) {
                // V2: FAST
                encryptedBlob = await window.CryptoHelper.encryptWithKey(event, this.sessionKey);
            } else {
                // V1: SLOW (Legacy Fallback)
                encryptedBlob = await window.CryptoHelper.encrypt(event, this.sessionKey);
            }

            return {
                id: this.generateId(event),
                startTime: event.startTime, // Keep plain for Indexing
                year: new Date(event.startTime).getFullYear(), // Keep plain for Indexing
                type: event.type, // Keep plain for ID generation/debugging
                _encrypted: true,
                data: encryptedBlob // The secure payload
            };
        } catch (e) {
            console.error("Encryption failed for event:", event, e);
            throw e;
        }
    },

    async decryptNode(storedEvent) {
        if (!storedEvent._encrypted) return storedEvent; // Already plain
        if (!this.sessionKey) {
            console.warn("Attempting to decrypt without sessionKey!", storedEvent);
            return { ...storedEvent, description: "[LOCKED CONTENT]" }; // Fallback
        }

        try {
            // Check payload type
            if (storedEvent.data.algo === 'AES-GCM-KEYS') {
                // V2 Payload
                if (!this.sessionKey.algorithm) throw new Error("Need V2 Key for V2 Data");
                const decrypted = await window.CryptoHelper.decryptWithKey(storedEvent.data, this.sessionKey);
                // Restoration
                if (decrypted.startTime) decrypted.startTime = new Date(decrypted.startTime);
                if (decrypted.endTime) decrypted.endTime = new Date(decrypted.endTime);
                return decrypted;
            } else {
                // V1 Legacy Payload (Standard AES-GCM with salt)
                // We typically need the PASSWORD string for this.
                // If this.sessionKey is a CryptoKey, WE CANNOT DECRYPT V1 DATA!
                // ERROR: We need the password to decrypt V1 data.
                // But we only have the derived key.
                // FIX: We must pass the PASSWORD to DiaryStore for Legacy Decrypt?
                // OR: We store the password temporarily? No, insecure.
                // RE-THINK:
                // We MUST re-encrypt V1 data.
                // BUT to re-encrypt, we need to decrypt.
                // So at the moment of Migration (Unlock), we need the Password.
                // SO: DiaryStore needs `legacyPassword` property?
                throw new Error("Legacy Data found but only V2 Key available. Migration needed.");
            }
        } catch (e) {
            // Only log actual errors, not expected legacy fallbacks
            if (!this.legacyPassword || storedEvent.data.algo === 'AES-GCM-KEYS') {
                console.error("Decryption failed:", e);
            }

            // Temporary Fallback if we have the password attached (hacky but needed for migration transition)
            if (this.legacyPassword && storedEvent.data.algo !== 'AES-GCM-KEYS') {
                try {
                    const decrypted = await window.CryptoHelper.decrypt(storedEvent.data, this.legacyPassword);
                    if (decrypted.startTime) decrypted.startTime = new Date(decrypted.startTime);
                    if (decrypted.endTime) decrypted.endTime = new Date(decrypted.endTime);
                    return decrypted;
                } catch (retryErr) {
                    console.error("Retry Legacy Failed", retryErr);
                }
            }

            return { ...storedEvent, description: "[DECRYPTION ERROR]" };
        }
    },

    // Set legacy password for migration purposes
    setLegacyPassword(pwd) {
        this.legacyPassword = pwd;
    },

    // --- CRUD Operations ---

    async addEvents(events) {
        await this.open();

        // Prepare events (Encrypt if needed)
        const readyEvents = [];
        for (const evt of events) {
            const processed = await this.encryptNode(evt);
            // Ensure ID and Year are set on the object passed to DB
            if (!processed.id) processed.id = this.generateId(evt);
            if (!processed.year) processed.year = new Date(evt.startTime).getFullYear();
            readyEvents.push(processed);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = transaction.objectStore(STORE_EVENTS);

            readyEvents.forEach(evt => store.put(evt));

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => {
                console.error("Tx Error", e);
                reject(e);
            };
        });
    },

    async mergeEvents(newEvents) {
        await this.open();
        // Since encryption makes "partial updates" (like preserving notes) harder without reading,
        // we implement a read-modify-write pattern. Do not blind overwrite.

        // 1. Prepare Map of New Events
        // We need to keep them in memory to compare.
        // If enc enabled, we encrypt AFTER merge logic.

        const transaction = this.db.transaction([STORE_EVENTS], 'readwrite');
        const store = transaction.objectStore(STORE_EVENTS);

        return new Promise((resolve, reject) => {
            let processed = 0;
            const total = newEvents.length;
            if (total === 0) { resolve(); return; }

            // Using simple Loop
            newEvents.forEach(evt => {
                const id = this.generateId(evt);
                const req = store.get(id);
                req.onsuccess = async (r) => {
                    const existing = r.target.result;
                    let final = evt;
                    if (existing) {
                        const plain = await this.decryptNode(existing);
                        if (plain.userNote) final.userNote = plain.userNote;
                    }
                    const ready = await this.encryptNode(final);
                    ready.id = id;
                    ready.year = new Date(final.startTime).getFullYear();
                    store.put(ready);
                };
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e);
        });
    },

    async saveNote(eventId, noteText) {
        await this.open();
        // Read -> Decrypt -> Update -> Encrypt -> Write
        const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
        const store = tx.objectStore(STORE_EVENTS);

        return new Promise((resolve, reject) => {
            const req = store.get(eventId);
            req.onsuccess = async (e) => {
                const stored = e.target.result;
                if (stored) {
                    const plain = await this.decryptNode(stored);
                    plain.userNote = noteText;

                    const encrypted = await this.encryptNode(plain);
                    // Retain Index keys just in case
                    encrypted.id = stored.id;
                    encrypted.startTime = stored.startTime;
                    encrypted.year = stored.year;

                    store.put(encrypted);
                }
                // We resolve when tx completes
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

            request.onsuccess = async (e) => {
                const rawResults = e.target.result;

                // Decrypt All
                // Trigger Optimization if needed? (Lazy Migration)
                // If we detect legacy data, we should probably trigger a background optimize

                const decryptedEvents = await Promise.all(
                    rawResults.map(evt => this.decryptNode(evt))
                );

                // Sort Descending
                decryptedEvents.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                resolve(decryptedEvents);
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
                    resolve(years.sort((a, b) => b - a));
                }
            };
            request.onerror = reject;
        });
    },

    // --- Migration & Optimization ---

    /**
     * Optimizes encryption by converting checks if events are using Legacy Encryption
     * and upgrades them to Session Key Encryption (V2).
     * Returns count of upgraded items.
     */
    async optimizeEncryption() {
        if (!this.sessionKey || !this.sessionKey.algorithm) {
            console.error("Optimization requires a V2 Session Key.");
            return 0;
        }

        console.log("Starting Encryption Optimization...");
        await this.open();

        // 1. Scan for Legacy Items
        const legacyItems = [];
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readonly');
            const req = tx.objectStore(STORE_EVENTS).openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const val = cursor.value;
                    // Check if Encrypted AND Legacy (missing algo or not KEYS)
                    if (val._encrypted && val.data && val.data.algo !== 'AES-GCM-KEYS') {
                        legacyItems.push(val);
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            req.onerror = reject;
        });

        if (legacyItems.length === 0) {
            console.log("Optimization: All items are already V2.");
            return 0;
        }

        console.log(`Optimization: Found ${legacyItems.length} legacy items.`);

        // 2. Process Batch
        // We need legacyPassword to decrypt them first!
        if (!this.legacyPassword) {
            console.error("Optimization Aborted: No Legacy Password available.");
            return -1; // Error code
        }

        const upgradedBatch = [];
        for (const item of legacyItems) {
            try {
                // Decrypt with Password (Slow)
                // Note: decryptNode handles fallback if legacyPassword is set
                const plain = await this.decryptNode(item);

                // CRITICAL CHECK: Did decryption actually work?
                // Depending on decryptNode implementation, it might return an error object
                if (!plain || (plain.description && plain.description.startsWith("[DECRYPTION ERROR"))) {
                    console.warn(`Skipping optimization for item ${item.id}: Decryption failed.`);
                    continue;
                }

                // Encrypt with SessionKey (Fast)
                const upgraded = await this.encryptNode(plain);

                // Preserve keys
                upgraded.id = item.id;
                upgraded.startTime = item.startTime;
                upgraded.year = item.year;

                upgradedBatch.push(upgraded);
            } catch (err) {
                console.error("Optimization failed for item", item.id, err);
            }
        }

        // 3. Save
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = tx.objectStore(STORE_EVENTS);
            upgradedBatch.forEach(ev => store.put(ev));
            tx.oncomplete = () => {
                console.log("Optimization Complete.");
                resolve(upgradedBatch.length);
            };
            tx.onerror = reject;
        });
    },

    /**
     * Migrates all plain text events in the DB to encrypted format using the current sessionKey.
     * REFACTOR: Uses a "Load -> Encrypt -> Save" strategy.
     */
    async migrateToEncrypted() {
        if (!this.sessionKey) {
            console.error("Cannot migrate: No session key set.");
            return;
        }

        // STEP 1: READ ALL PLAIN EVENTS (Plain Transaction)
        await this.open();
        const plainEvents = [];

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readonly');
            const store = tx.objectStore(STORE_EVENTS);
            const req = store.openCursor();

            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const val = cursor.value;
                    if (!val._encrypted) {
                        plainEvents.push(val);
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            req.onerror = (e) => reject(e);
        });

        if (plainEvents.length === 0) {
            console.log("Migration: No plain events found.");
            // Trigger Optimization here? If we have mixed data?
            // If plain is 0, we might still have legacy encrypted.
            return this.optimizeEncryption();
        }

        console.log(`Migration: Found ${plainEvents.length} plain events. Encrypting in memory...`);

        // STEP 2: ENCRYPT IN MEMORY (No Transaction Active)
        // This allows WebCrypto to take as long as it needs without killing the DB connection.
        const encryptedBatch = [];
        for (const plain of plainEvents) {
            try {
                const encrypted = await this.encryptNode(plain);
                // Preserve Index Keys to ensure object matches DB schema expectations
                encrypted.id = plain.id;
                encrypted.startTime = plain.startTime;
                encrypted.year = plain.year || new Date(plain.startTime).getFullYear();

                encryptedBatch.push(encrypted);
            } catch (err) {
                console.error("Migration Encryption Failed for ID:", plain.id, err);
            }
        }

        // STEP 3: BULK SAVE (New ReadWrite Transaction)
        console.log(`Migration: Saving ${encryptedBatch.length} encrypted events...`);
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            const store = tx.objectStore(STORE_EVENTS);

            encryptedBatch.forEach(evt => {
                store.put(evt);
            });

            tx.oncomplete = () => {
                console.log("Migration: Bulk Save Complete.");
                // After Plain->Encrypted, run Legacy->Optimized check?
                this.optimizeEncryption().then((res) => {
                    resolve(encryptedBatch.length + (res > 0 ? res : 0));
                });
            };
            tx.onerror = (e) => reject(e);
        });
    },

    // --- Standard Delete/Clear ---

    async deleteEvent(id) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            tx.objectStore(STORE_EVENTS).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = reject;
        });
    },

    async clearAllEvents() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EVENTS], 'readwrite');
            tx.objectStore(STORE_EVENTS).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = reject;
        });
    }
};
