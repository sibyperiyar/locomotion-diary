/**
 * BinderManager (Async / Native Crypto Version)
 * Core logic for the Legacy Binder & Financial Planner module.
 * Handles data persistence, CRUD operations, and schema management.
 * 
 * SECURITY UPGRADE: Uses window.crypto.subtle (AES-GCM-256) for zero-dependency encryption.
 */

// --- Crypto Helpers (Native Web Crypto) ---
// --- Crypto Helpers (Native Web Crypto) ---
// MOVED TO: js/crypto-helper.js
// Using window.CryptoHelper


const BinderManager = {
    STORAGE_KEY: 'locomotion_binder',
    DEFAULT_MEMBER_ID: 'self',

    // Encryption State
    isLocked: false,
    sessionKey: null, // Password (temporary memory only)
    encryptedData: null, // Raw encrypted payload

    // In-memory state (Decrypted)
    data: {
        meta: { version: 1, created: Date.now() },
        members: [],
        content: {}
    },

    // Async Init
    async init() {
        await this.load();

        // If locked, we stop here and wait for UI to call unlock()
        if (this.isLocked) {
            console.log("BinderManager: Encrypted Data Found. Application Locked.");
            return;
        }

        // ... Normal Init Logic ...
        this.repairData();
    },

    repairData() {
        // Self-Repair: Ensure all nodes have IDs
        let repairNeeded = false;
        const repairRecursive = (nodes) => {
            nodes.forEach(n => {
                if (!n.id) {
                    n.id = 'node_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    repairNeeded = true;
                }
                if (n.children) repairRecursive(n.children);
            });
        };

        if (this.data.members) {
            this.data.members.forEach(m => {
                const root = this.data.content[m.id];
                if (root) repairRecursive(root);
            });
        }

        if (repairNeeded) {
            console.log("BinderManager: Repaired missing IDs in data.");
            this.save();
        }

        if (this.data.members.length === 0) {
            // Seed initial self member if empty
            const id = this.addMember('Self', 'Primary');
            // Auto-load template per user request
            this.loadIndianMasterList(id);
        }
    },

    async load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                // Check if encrypted
                try {
                    const parsed = JSON.parse(raw);
                    // Check for encryption flag
                    if (parsed.encrypted && parsed.ciphertext) {
                        this.isLocked = true;
                        this.encryptedData = parsed;
                        this.data = null; // Clear plain data
                        return;
                    }
                    this.data = parsed; // Legacy Plaintext
                } catch (e) {
                    console.error("JSON Parse Error:", e);
                }
            } else {
                console.log("BinderManager: No existing data, starting fresh.");
            }
        } catch (e) {
            console.error("BinderManager Load Error:", e);
            alert("Error loading Binder data. Backup recommended.");
        }
    },

    async save() {
        try {
            if (this.sessionKey) {
                // ENCRYPTED SAVE
                const payload = await CryptoHelper.encrypt(this.data, this.sessionKey);
                payload.encrypted = true;
                payload.meta = { version: 1, updated: Date.now() };

                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
            } else {
                // PLAIN TEXT SAVE (Legacy/Unsecured)
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            }
            // Trigger an event for UI updates
            window.dispatchEvent(new CustomEvent('binder-updated'));
        } catch (e) {
            console.error("BinderManager Save Error:", e);
            alert("Failed to save Binder data! Storage might be full.");
        }
    },

    /**
     * Set up encryption for the first time.
     */
    async setupEncryption(password) {
        if (!password) return false;
        try {
            this.sessionKey = password;
            this.isLocked = false;
            await this.save(); // Encrypts and saves immediately
            return true;
        } catch (e) {
            console.error("Setup Encryption Failed", e);
            throw e;
        }
    },

    /**
     * Unlock the binder with password.
     */
    async unlock(password) {
        if (!this.encryptedData) return false;

        // Decrypt
        try {
            const data = await CryptoHelper.decrypt(this.encryptedData, password);
            if (!data) return false;

            this.data = data;
            this.sessionKey = password; // Keep key for future saves
            this.isLocked = false;

            // Repair loaded data just in case
            this.repairData();

            window.dispatchEvent(new CustomEvent('binder-updated'));
            return true;
        } catch (e) {
            console.error("Decryption Failed (Wrong Password?)", e);
            return false;
        }
    },

    /**
     * Locks the binder (Clear memory)
     */
    lock() {
        this.isLocked = true;
        this.sessionKey = null;
        this.data = null; // Wipe memory
        window.location.reload(); // Hardest Reload for safety
    },

    // --- Member Management ---

    addMember(name, relation) {
        const id = 'mem_' + Date.now() + Math.floor(Math.random() * 1000);
        this.data.members.push({
            id: id,
            name: name,
            relation: relation || 'Family'
        });

        // Initialize content structure for member
        this.data.content[id] = [];

        this.save();
        return id;
    },

    getMembers() {
        if (!this.data) return [];
        return this.data.members;
    },

    getMember(id) {
        if (!this.data) return null;
        return this.data.members.find(m => m.id === id);
    },

    deleteMember(id) {
        this.data.members = this.data.members.filter(m => m.id !== id);
        delete this.data.content[id];
        this.save();
    },

    updateMember(id, updates) {
        const member = this.getMember(id);
        if (member) {
            Object.assign(member, updates);
            this.save();
        }
    },

    // --- Content Management (Tree) ---
    // Content is stored in data.content[memberId] as an Array of Root Nodes

    getTree(memberId) {
        if (!this.data) return [];
        return this.data.content[memberId] || [];
    },

    // Alias for UI compatibility
    getContent(memberId) {
        return this.getTree(memberId);
    },

    addSection(memberId, title, parentId = null) {
        const newNode = {
            id: 'sec_' + this.uuid(),
            type: 'section',
            title: title,
            children: []
        };

        if (!parentId) {
            // Add to root
            this.data.content[memberId].push(newNode);
        } else {
            // Find parent
            const parent = this.findNode(this.data.content[memberId], parentId);
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(newNode);
            }
        }

        this.save();
        return newNode.id;
    },

    updateNodeTitle(memberId, nodeId, newTitle) {
        const node = this.findNode(this.data.content[memberId], nodeId);
        if (node) {
            node.title = newTitle;
            this.save();
        }
    },

    deleteNode(memberId, nodeId) {
        const root = this.data.content[memberId];

        // Helper to remove from list
        const remove = (list) => {
            const idx = list.findIndex(n => n.id === nodeId);
            if (idx !== -1) {
                list.splice(idx, 1);
                return true;
            }
            for (const item of list) {
                if (item.children) {
                    if (remove(item.children)) return true;
                }
            }
            return false;
        };

        if (remove(root)) this.save();
    },

    // --- Data Fields ---

    addField(memberId, parentId, fieldType, label, value) {
        const newNode = {
            id: 'field_' + this.uuid(),
            type: 'field',
            fieldType: fieldType, // 'text', 'date', 'file', 'currency', 'asset', 'liability'
            title: label,
            value: value
        };

        const parent = this.findNode(this.data.content[memberId], parentId);
        if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(newNode);
            this.save();
        }
        return newNode.id;
    },

    updateFieldValue(memberId, fieldId, newValue) {
        const node = this.findNode(this.data.content[memberId], fieldId);
        if (node) {
            node.value = newValue;
            this.save();
        }
    },

    // --- Generic Node Operations (UI Helpers) ---
    addNode(memberId, parentId, nodeData) {
        if (nodeData.type === 'section') {
            return this.addSection(memberId, nodeData.title, parentId);
        } else if (nodeData.type === 'field') {
            return this.addField(memberId, parentId, nodeData.fieldType, nodeData.title, nodeData.value);
        }
    },

    updateNode(memberId, nodeId, updates) {
        const root = this.data.content[memberId];
        const node = this.findNode(root, nodeId);
        if (node) {
            if (updates.title !== undefined) node.title = updates.title;
            if (updates.value !== undefined) node.value = updates.value;
            if (updates.fieldType !== undefined) node.fieldType = updates.fieldType;
            this.save();
        }
    },

    // --- Financial Logic ---

    calculateAssetSummary(memberId) {
        if (!this.data || !this.data.content) return { assets: 0, liabilities: 0, netWorth: 0 };
        const root = this.data.content[memberId] || [];
        let assets = 0;
        let liabilities = 0;

        const traverse = (nodes) => {
            nodes.forEach(node => {
                if (node.type === 'field') {
                    const val = parseFloat(node.value) || 0;
                    if (node.fieldType === 'asset') assets += val;
                    if (node.fieldType === 'liability') liabilities += val;
                }
                if (node.children) traverse(node.children);
            });
        };

        traverse(root);
        return { assets, liabilities, netWorth: assets - liabilities };
    },

    // --- Move Logic (Drag & Drop) ---

    moveNode(memberId, nodeId, newParentId) {
        const root = this.data.content[memberId];
        let nodeToMove = null;

        // 1. Remove from old location
        const remove = (list) => {
            const idx = list.findIndex(n => n.id === nodeId);
            if (idx !== -1) {
                nodeToMove = list[idx];
                list.splice(idx, 1);
                return true;
            }
            for (const item of list) {
                if (item.children) {
                    if (remove(item.children)) return true;
                }
            }
            return false;
        };

        if (!remove(root)) return; // Node not found

        // 2. Add to new location
        if (!newParentId) {
            // Move to Root
            root.push(nodeToMove);
        } else {
            const newParent = this.findNode(root, newParentId);
            if (newParent) {
                if (!newParent.children) newParent.children = [];
                newParent.children.push(nodeToMove);
            } else {
                // Fallback: Restore to root if parent lost
                root.push(nodeToMove);
            }
        }

        this.save();
        // Optional: Trigger event?
        // window.dispatchEvent(new CustomEvent('binder-updated')); // handleDrop calls renderTree anyway
    },

    // --- Helpers ---

    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    findNode(list, id) {
        for (const node of list) {
            if (node.id === id) return node;
            if (node.children) {
                const found = this.findNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    },

    /**
     * Duplicates a node and all its children.
     * @param {string} memberId 
     * @param {string} nodeId 
     */
    duplicateNode(memberId, nodeId) {
        const root = this.data.content[memberId];
        let parentArray = null;
        let index = -1;
        let nodeToClone = null;

        // 1. Find the node and its parent array
        const findParent = (list) => {
            const idx = list.findIndex(n => n.id === nodeId);
            if (idx !== -1) {
                parentArray = list;
                index = idx;
                nodeToClone = list[idx];
                return true;
            }
            for (const item of list) {
                if (item.children) {
                    if (findParent(item.children)) return true;
                }
            }
            return false;
        };

        if (!findParent(root)) {
            console.error("Node not found to duplicate:", nodeId);
            return null;
        }

        // 2. Recursive Clone Helper (Generates New IDs)
        const deepClone = (node) => {
            const newNode = { ...node }; // Shallow copy props
            newNode.id = this.uuid(); // NEW ID
            if (newNode.title && node === nodeToClone) {
                newNode.title = `${node.title} (Copy)`;
            }

            if (node.children) {
                newNode.children = node.children.map(child => deepClone(child));
            }
            return newNode;
        };

        // 3. Clone and Insert
        const clonedNode = deepClone(nodeToClone);
        parentArray.splice(index + 1, 0, clonedNode); // Insert after original

        this.save();
        return clonedNode.id;
    },

    // --- Search & Dashboard Helpers ---

    /**
     * Searches all fields for a text match
     */
    searchGlobal(query) {
        if (this.isLocked || !this.data) return [];
        // Simple Recursive Search Implementation
        const q = query.toLowerCase();
        const hits = [];

        Object.keys(this.data.content).forEach(memberId => {
            const member = this.getMember(memberId);
            const root = this.data.content[memberId];

            const traverse = (nodes, path = []) => {
                nodes.forEach(n => {
                    const currentPath = [...path, n.title];
                    // Check Node Title
                    if (n.title && n.title.toLowerCase().includes(q)) {
                        hits.push({ node: n, member: member, path: path, matchType: 'title' });
                    }
                    // Check Value
                    if (n.value && String(n.value).toLowerCase().includes(q)) {
                        hits.push({ node: n, member: member, path: currentPath, matchType: 'value' });
                    }
                    if (n.children) traverse(n.children, currentPath);
                });
            };
            traverse(root);
        });
        return hits;
    },

    /**
     * Returns a list of upcoming dates (expiries, deadlints etc)
     * @param {number} daysThreshold - Search for dates within X days
     */
    getUpcomingDates(daysThreshold = 45) {
        if (this.isLocked || !this.data) return [];

        const upcoming = [];
        const now = new Date();
        const threshold = new Date();
        threshold.setDate(now.getDate() + daysThreshold);

        Object.keys(this.data.content).forEach(memberId => {
            const memberData = this.getMember(memberId);
            const memberName = memberData ? memberData.name : "Unknown";
            const root = this.data.content[memberId];

            const traverse = (nodes) => {
                nodes.forEach(n => {
                    if (n.type === 'field' && n.fieldType === 'date' && n.value) {
                        const d = new Date(n.value);
                        if (!isNaN(d.getTime())) {
                            // Check if future but within threshold
                            if (d >= now && d <= threshold) {
                                const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                                upcoming.push({
                                    title: n.title,
                                    member: memberName,
                                    date: d,
                                    daysLeft: diff
                                });
                            }
                        }
                    }
                    if (n.children) traverse(n.children);
                });
            };

            traverse(root);
        });

        // Sort by urgency
        upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
        return upcoming;
    },

    /**
     * Placeholder alias if UI calls 'search'
     */
    search(query) { return this.searchGlobal(query); },

    // --- Template Loader ---
    loadIndianMasterList(memberId) {
        // ... (Code from previous implementations logic for template loading)
        // I will just link the file if it was separate, but here it's inside `binder_template.js`.
        // This function calls `BinderTemplate.getIndianMasterList()`
        let template = [];
        if (typeof window.BINDER_TEMPLATE_DEFAULT !== 'undefined') {
            template = window.BINDER_TEMPLATE_DEFAULT;
        } else if (typeof BinderTemplate !== 'undefined') {
            template = BinderTemplate.getIndianMasterList();
            // We adding to root of member
            // Assume template is array of sections
            // We need to re-ID them to ensure uniqueness

            const importRecursive = (nodes) => {
                return nodes.map(n => {
                    const node = { ...n };
                    node.id = this.uuid(); // Ensure new ID
                    if (node.children) node.children = importRecursive(node.children);
                    return node;
                });
            };

            const imported = importRecursive(template);
            this.data.content[memberId] = imported;
            this.save();
        }
    },

    // --- Export ---
    exportData() {
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        return URL.createObjectURL(blob);
    },

    /**
     * Exports a specific member's structure as a clean template JSON.
     * Strips personal values, IDs, and timestamps.
     */
    exportAsTemplate(memberId) {
        const root = this.data.content[memberId] || [];

        // Recursive cleaner
        const cleanNode = (node) => {
            const newNode = {
                type: node.type,
                title: node.title
            };

            if (node.type === 'field') {
                newNode.fieldType = node.fieldType;
                newNode.value = ""; // Strip value
            }

            if (node.children) {
                newNode.children = node.children.map(cleanNode);
            }

            return newNode;
        };

        const template = root.map(cleanNode);

        const json = JSON.stringify(template, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        return URL.createObjectURL(blob);
    }
};

// Initialize
// BinderManager.init(); // REMOVED auto-init, wait for app_v2.js to call it async
window.BinderManager = BinderManager;
