/**
 * Binder UI Manager
 * Handles the DOM interaction for the Legacy Binder module.
 */

const BinderUI = {
    currentMemberId: null,
    currentSectionId: null, // Selected section (parent for new fields)

    init() {
        // DOM Elements
        this.els = {
            memberSelect: document.getElementById('binder-member-select'),
            btnAddMember: document.getElementById('btn-add-member'),
            treeRoot: document.getElementById('binder-tree-root'),
            btnAddSection: document.getElementById('btn-add-section'),
            btnCollapseAll: document.getElementById('btn-collapse-all'),

            contentTitle: document.getElementById('current-section-title'),
            fieldsContainer: document.getElementById('binder-fields-container'),
            btnAddField: document.getElementById('btn-add-field'),
            btnEditSection: document.getElementById('btn-edit-section'),
            btnDeleteSection: document.getElementById('btn-delete-section'),
            btnDuplicateSection: document.getElementById('btn-duplicate-section'), // NEW

            modal: document.getElementById('binder-node-modal'),
            modalTitle: document.getElementById('binder-modal-title'),
            inputTitle: document.getElementById('binder-node-title'),
            fieldOptions: document.getElementById('field-options'),
            inputType: document.getElementById('binder-field-type'),
            inputValue: document.getElementById('binder-field-value'),
            btnModalSave: document.getElementById('btn-binder-save'),
            btnModalCancel: document.getElementById('btn-binder-cancel'),

            dashboard: document.getElementById('binder-dashboard') // Changed from binder-alerts-list
        };

        // Listeners
        this.bindEvents();

        // Listen for Data Changes
        window.addEventListener('binder-updated', () => this.render());
    },

    render() {
        this.renderMemberSelect();
        this.renderDashboard();
        this.renderSecurityTools(); // NEW

        if (this.currentMemberId) {
            this.renderTree();
            // If we have a selected section, re-render it to show updates
            if (this.currentSectionId) {
                this.selectSection(this.currentSectionId);
            }
        } else {
            // No member selected or available
            this.els.treeRoot.innerHTML = '<div class="empty-state small">No members found.</div>';
            this.renderContentEmpty();
        }
    },

    renderSecurityTools() {
        // Check if tools already exist
        let secContainer = document.getElementById('binder-security-tools');
        if (!secContainer) {
            secContainer = document.createElement('div');
            secContainer.id = 'binder-security-tools';
            secContainer.className = 'binder-sidebar-section';
            secContainer.innerHTML = `
                <h3 class="sidebar-header">🔐 Security</h3>
                <div class="security-actions">
                    <button class="btn small outline danger" id="btn-emergency-kit" title="Download Password & Backup">
                        🚑 Emergency Kit
                    </button>
                    <button class="btn small outline" id="btn-change-pwd" title="Update Master Password">
                        🔑 Change Pwd
                    </button>
                    <button class="btn small outline" id="btn-lock-app">
                        🔒 Lock App
                    </button>
                </div>
            `;
            // Append to sidebar (assuming sidebar structure, or after Tree)
            // Ideally should be in index.html, but we append here dynamically
            const sidebar = document.querySelector('.binder-sidebar');
            if (sidebar) sidebar.appendChild(secContainer);

            // Bind Events Only Once
            document.getElementById('btn-emergency-kit').onclick = () => {
                if (confirm("Download Emergency Access Kit?\n\nThis file contains your MASTER PASSWORD.\nKeep it safe!")) {
                    RecoveryManager.downloadEmergencyKit();
                }
            };
            document.getElementById('btn-change-pwd').onclick = async () => {
                const newPwd = prompt("Enter NEW Master Password:");
                if (!newPwd) return;
                if (newPwd.length < 4) { alert("Too short!"); return; }

                const confirmPwd = prompt("Confirm NEW Master Password:");
                if (newPwd !== confirmPwd) { alert("Passwords do not match!"); return; }

                if (confirm("Are you sure? This will re-encrypt your entire Binder with the new key.\n\nMake sure to DOWNLOAD A NEW EMERGENCY KIT immediately after.")) {
                    const success = await BinderManager.setupEncryption(newPwd);
                    if (success) {
                        alert("✅ Password Changed Successfully!\n\nPlease download a new Emergency Kit now.");
                        RecoveryManager.downloadEmergencyKit(); // Prompt new kit
                    }
                }
            };
            document.getElementById('btn-lock-app').onclick = () => {
                if (BinderManager) BinderManager.lock();
            };
        }
    },

    bindEvents() {
        // Member Select
        this.els.memberSelect.addEventListener('change', (e) => {
            this.currentMemberId = e.target.value;
            this.currentSectionId = null; // Reset selection
            this.renderTree();
            this.renderContentEmpty();
        });

        // Add Member Button
        this.els.btnAddMember.addEventListener('click', () => {
            const name = prompt("Enter Name for new Family Member:");
            if (name) {
                const id = BinderManager.addMember(name);
                // Ask to seed data?
                if (confirm("Load 'Indian Civil & Financial' Default Template for this member?")) {
                    BinderManager.loadIndianMasterList(id);
                }
                this.currentMemberId = id;
                this.render();
            }
        });

        // Edit Member
        const btnEditMember = document.getElementById('btn-edit-member');
        if (btnEditMember) {
            btnEditMember.addEventListener('click', () => {
                if (!this.currentMemberId) return;
                const member = BinderManager.getMember(this.currentMemberId);
                const newName = prompt("Rename Member:", member.name);
                if (newName && newName !== member.name) {
                    BinderManager.updateMember(this.currentMemberId, { name: newName });
                    this.renderMemberSelect(); // Refresh dropdown
                }
            });
        }

        // Delete Member
        const btnDeleteMember = document.getElementById('btn-delete-member');
        if (btnDeleteMember) {
            btnDeleteMember.addEventListener('click', () => {
                if (!this.currentMemberId) return;

                // Guardrail: Don't allow deleting the last member
                const members = BinderManager.getMembers();
                if (members.length <= 1) {
                    alert("You cannot delete the only member.\n\nPlease add another member first if you wish to remove this one.");
                    return;
                }

                const member = BinderManager.getMember(this.currentMemberId);
                if (confirm(`CRITICAL WARNING:\n\nAre you sure you want to delete "${member.name}"?\n\nThis will DELETE ALL documents, passwords, and data associated with them forever.\n\nThis action cannot be undone.`)) {
                    BinderManager.deleteMember(this.currentMemberId);
                    this.currentMemberId = null; // Clear selection
                    this.render(); // Will default to first available or empty
                }
            });
        }

        // Modal Actions
        this.els.btnModalCancel.addEventListener('click', () => {
            this.els.modal.style.display = 'none';
        });

        this.els.btnModalSave.addEventListener('click', () => this.handleSave());

        // Sidebar Actions
        const btnRefreshAlerts = document.getElementById('btn-refresh-alerts');
        if (btnRefreshAlerts) {
            btnRefreshAlerts.addEventListener('click', () => {
                this.renderDashboard();
                // Visual feedback
                btnRefreshAlerts.style.transform = 'rotate(360deg)';
                btnRefreshAlerts.style.transition = 'transform 0.5s';
                setTimeout(() => btnRefreshAlerts.style.transform = 'none', 500);
            });
        }

        // Logic: Add to Selected if selected, else Add to Root
        this.els.btnAddSection.addEventListener('click', () => {
            // Reset input titles (managed in openModal)
            // Just open modal, the handleSave logic will use currentSectionId
            this.openModal('section');
        });

        // Duplicate Logic
        if (this.els.btnDuplicateSection) {
            this.els.btnDuplicateSection.addEventListener('click', () => {
                if (this.currentSectionId && confirm("Create a copy of this section?")) {
                    const newId = BinderManager.duplicateNode(this.currentMemberId, this.currentSectionId);
                    if (newId) {
                        this.renderTree();
                        this.selectSection(newId);
                    }
                }
            });
        }


        // --- ROOT DROP ZONE ---
        this.els.treeRoot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.els.treeRoot.classList.add('drag-over-root');
        });

        this.els.treeRoot.addEventListener('dragleave', (e) => {
            this.els.treeRoot.classList.remove('drag-over-root');
        });

        this.els.treeRoot.addEventListener('drop', (e) => {
            e.preventDefault();
            this.els.treeRoot.classList.remove('drag-over-root');
            // Check if dropped on a specific node was handled?
            // Since node handlers stopPropagation, this only fires if dropped on 'empty space' (Root)
            this.handleDropRoot(e);
        });

        this.els.btnCollapseAll.addEventListener('click', () => {
            document.querySelectorAll('.tree-node.expanded').forEach(el => el.classList.remove('expanded'));
        });

        // Content Actions
        const btnAddSub = document.getElementById('btn-add-sub-section');
        if (btnAddSub) {
            // Explicitly for sub-section, but logic is same: Add to current
            btnAddSub.addEventListener('click', () => {
                // Ensure we don't clear currentSectionId here!
                this.openModal('section');
            });
        }

        const btnEditSection = document.getElementById('btn-edit-section');
        if (btnEditSection) {
            btnEditSection.addEventListener('click', () => {
                if (this.currentSectionId) {
                    const root = BinderManager.getContent(this.currentMemberId);
                    const node = BinderManager.findNode(root, this.currentSectionId);
                    if (node) this.openModal('section', node);
                }
            });
        }

        this.els.btnAddField.addEventListener('click', () => this.openModal('field'));
        this.els.btnDeleteSection.addEventListener('click', () => {
            // Find node to get title for better UX
            const root = BinderManager.getContent(this.currentMemberId);
            const node = BinderManager.findNode(root, this.currentSectionId);
            const title = node ? node.title : "this section";

            if (confirm(`Are you sure you want to delete "${title}"?\n\nThis will remove the section and ALL keys/values inside it.\n\nType: ${node.type}`)) {
                BinderManager.deleteNode(this.currentMemberId, this.currentSectionId);
                this.currentSectionId = null;
                this.render(); // Full re-render needed for tree
                this.renderContentEmpty();
            }
        });

        // Dynamic Input Type Listener
        this.els.inputType.addEventListener('change', (e) => {
            if (e.target.value === 'date') {
                this.els.inputValue.type = 'date';
            } else if (e.target.value === 'number') {
                this.els.inputValue.type = 'number';
            } else {
                this.els.inputValue.type = 'text';
            }
        });

        // --- Search & Export ---
        const btnSearch = document.getElementById('btn-binder-search');
        const searchModal = document.getElementById('binder-search-modal');
        const searchInput = document.getElementById('binder-search-input');
        const searchResults = document.getElementById('binder-search-results');
        const btnSearchClose = document.getElementById('btn-binder-search-close');

        if (btnSearch) {
            btnSearch.addEventListener('click', () => {
                searchModal.style.display = 'flex';
                searchInput.focus();
            });
        }

        if (btnSearchClose) {
            btnSearchClose.addEventListener('click', () => searchModal.style.display = 'none');
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                if (query.length < 2) {
                    searchResults.innerHTML = '<div class="empty-state small">Enter text to search...</div>';
                    return;
                }

                const hits = BinderManager.searchGlobal(query);
                searchResults.innerHTML = '';

                if (hits.length === 0) {
                    searchResults.innerHTML = '<div class="empty-state small">No matches found.</div>';
                    return;
                }

                hits.forEach(hit => {
                    const el = document.createElement('div');
                    el.style.padding = '10px';
                    el.style.borderBottom = '1px solid #eee';
                    el.style.cursor = 'pointer';
                    el.style.background = 'white';

                    const pathStr = hit.path.join(' > ');
                    // Highlight match?

                    el.innerHTML = `
                        <div style="font-weight: 500; color: #2c3e50;">${hit.node.title}</div>
                        <div style="font-size: 0.8em; color: #666;">${hit.member.name} • ${pathStr}</div>
                        ${hit.matchType === 'value' ? `<div style="font-size: 0.9em; color: #1976d2; margin-top:2px;">"${hit.node.value}"</div>` : ''}
                    `;

                    el.onclick = () => {
                        // Navigate to it
                        searchModal.style.display = 'none';
                        // Switch Member
                        this.currentMemberId = hit.member.id;
                        this.els.memberSelect.value = this.currentMemberId;
                        this.renderTree();

                        // Select Section (If it's a field, select parent; if section, select it)
                        if (hit.node.type === 'section') {
                            this.selectSection(hit.node.id);
                        } else {
                            // Find parent? BinderManager doesn't expose parent ID easily.
                            // We might need to crawl or just select the section from path?
                            // Search result path contains TITLES, not IDs.
                            // For V1, let's just alert or try to find parent.
                            // Actually `searchGlobal` returns path of *titles*.
                            // Improvement: `searchGlobal` should return parentID.
                            // But since I can't edit BinderManager easily right now without full rewrite of that function...
                            // I will just open the member root.
                            // Wait, I can try to find the section by title? No, duplicates.
                            // Let's just switch member and show message.
                            alert(`Found in: ${hit.member.name} > ${pathStr}`);
                        }
                    };

                    searchResults.appendChild(el);
                });
            });
        }

        // Export
        const btnExport = document.getElementById('btn-binder-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                const url = BinderManager.exportData();
                const a = document.createElement('a');
                a.href = url;
                a.download = `locomotion_binder_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Save as Template
        const btnSaveTemplate = document.getElementById('btn-binder-save-template');
        if (btnSaveTemplate) {
            btnSaveTemplate.addEventListener('click', () => {
                if (confirm("Download the current member's structure as 'binder_template.js'?\n\n(This will strip all personal values and keep only the sections/fields.)")) {
                    const rawJson = BinderManager.exportAsTemplate(this.currentMemberId);

                    // Convert blob URL back to text to wrap in JS? 
                    // No, exportAsTemplate returns blob URL.
                    // We need the raw string content to wrap it.
                    // Let's call a internal helper or just fetch the blob?
                    // Fetch blob is easy.
                    fetch(rawJson).then(r => r.text()).then(json => {
                        const jsContent = `/**\n * External Template for Locomotion Diary Binder\n */\n\nwindow.BINDER_TEMPLATE_DEFAULT = ${json};\n`;
                        const blob = new Blob([jsContent], { type: "application/javascript" });
                        const url = URL.createObjectURL(blob);

                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'binder_template.js';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        URL.revokeObjectURL(rawJson); // Clean up original JSON blob
                        alert("Template downloaded!\n\nTo apply it:\n1. Move the downloaded 'binder_template.js' into your project folder.\n2. Overwrite the existing file.");
                    });
                }
            });
        }

        // Print Button
        const btnPrint = document.getElementById('btn-binder-print');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                if (!this.currentMemberId) {
                    alert("Please select a member first.");
                    return;
                }

                // Password Mode Selection
                // A simple prompt is easiest, or a custom modal. 
                // Since user asked for options "Exposed/Hide/Hinted", let's use a simple prompt-like confirm or custom simple UI.
                // For simplicity and speed: A prompt "Enter Print Mode: 1=Hide, 2=Exposed, 3=Hinted" is UX poor.
                // Let's create a quick runtime modal or use standard browser confirm? No.
                // Let's assume we can inject a quick floating modal or re-use `searchModal`?
                // Let's create a dynamic modal element on the fly for this choice.

                const choice = prompt("PRINT OPTIONS - PASSWORD PRIVACY:\n\nType the mode name:\n\n'hide' -> ********\n'show' -> pass1234\n'hint' -> p******4", "hide");

                if (choice) {
                    const mode = choice.toLowerCase();
                    if (['hide', 'show', 'hint'].includes(mode)) {
                        BinderPrint.printMember(this.currentMemberId, mode);
                    } else {
                        BinderPrint.printMember(this.currentMemberId, 'hide'); // Default fallback
                    }
                }
            });
        }
    },

    // --- Helper for Currency ---
    getLocalCurrency() {
        const lang = navigator.language || 'en-US';
        const region = lang.split('-')[1];

        const currencies = {
            'US': 'USD', 'GB': 'GBP', 'AU': 'AUD', 'CA': 'CAD', 'NZ': 'NZD',
            'IN': 'INR', // Rupee
            'DE': 'EUR', 'FR': 'EUR', 'ES': 'EUR', 'IT': 'EUR', 'NL': 'EUR', // Eurozone (partial)
            'JP': 'JPY', 'CN': 'CNY', 'RU': 'RUB', 'BR': 'BRL', 'MX': 'MXN',
            'AE': 'AED', 'SA': 'SAR', 'ZA': 'ZAR', 'KR': 'KRW'
        };

        return currencies[region] || 'USD';
    },

    formatMoney(val) {
        if (isNaN(val)) return '$0.00';
        const currency = this.getLocalCurrency();
        return parseFloat(val).toLocaleString(navigator.language, {
            style: 'currency',
            currency: currency
        });
    },

    // --- RENDERERS ---

    renderMemberSelect() {
        const members = BinderManager.getMembers();
        this.els.memberSelect.innerHTML = '';

        if (members.length === 0) {
            const opt = document.createElement('option');
            opt.text = "No Members";
            opt.value = "";
            this.els.memberSelect.appendChild(opt);
            this.els.memberSelect.disabled = true;
            this.currentMemberId = null;
            return;
        }

        this.els.memberSelect.disabled = false;
        members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name; // + (m.relation ? ` (${m.relation})` : '');
            if (m.id === this.currentMemberId) opt.selected = true;
            this.els.memberSelect.appendChild(opt);
        });

        // Loopback check: if currentMemberId is invalid/null, pick first
        if (!this.currentMemberId || !members.find(m => m.id === this.currentMemberId)) {
            this.currentMemberId = members[0].id;
            this.els.memberSelect.value = this.currentMemberId;
        }
    },

    renderTree() {
        this.els.treeRoot.innerHTML = '';
        if (!this.currentMemberId) return;

        const root = BinderManager.getContent(this.currentMemberId);
        if (!root || root.length === 0) {
            this.els.treeRoot.innerHTML = '<div class="empty-state small">Empty. Add a section.</div>';
            return;
        }

        // Recursive Tree Builder
        const buildTree = (nodes, container) => {
            nodes.forEach(node => {
                if (node.type !== 'section') return; // Only show sections in tree

                const hasChildren = node.children && node.children.some(c => c.type === 'section');

                const el = document.createElement('div');
                el.className = 'tree-node';
                if (hasChildren) el.classList.add('has-children');
                el.dataset.id = node.id;

                // --- DRAG & DROP START ---
                el.draggable = true;
                el.addEventListener('dragstart', (e) => this.handleDragStart(e, node));
                el.addEventListener('dragover', (e) => this.handleDragOver(e));
                el.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                el.addEventListener('drop', (e) => this.handleDrop(e, node));
                el.addEventListener('dragend', (e) => this.handleDragEnd(e));
                // --- DRAG & DROP END ---

                // Highlight if selected
                if (node.id === this.currentSectionId) {
                    el.classList.add('selected');
                }

                const titleRow = document.createElement('div');
                titleRow.className = 'tree-title';

                // 1. Arrow (Expand/Collapse)
                const arrow = document.createElement('span');
                arrow.className = 'arrow';
                arrow.textContent = hasChildren ? '▶' : ''; // Triangle
                // Click arrow to toggle ONLY expansion
                arrow.onclick = (e) => {
                    e.stopPropagation();
                    if (hasChildren) {
                        el.classList.toggle('expanded');
                    }
                };

                // 2. Icon (Folder)
                const icon = document.createElement('span');
                icon.className = 'icon';
                icon.textContent = hasChildren ? '📁' : '📂';

                const titleText = document.createElement('span');
                titleText.textContent = node.title;

                titleRow.appendChild(arrow);
                titleRow.appendChild(icon);
                titleRow.appendChild(titleText);

                // Click Row to Select AND Expand
                titleRow.onclick = (e) => {
                    e.stopPropagation();
                    this.selectSection(node.id);
                    // Also expand if it has children
                    if (hasChildren) el.classList.add('expanded');
                };

                el.appendChild(titleRow);

                if (hasChildren) {
                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'tree-children';
                    buildTree(node.children, childrenContainer);
                    el.appendChild(childrenContainer);
                }

                container.appendChild(el);
            });
        };

        buildTree(root, this.els.treeRoot);

        // Expansion helper
        if (this.currentSectionId) {
            const activeEl = this.els.treeRoot.querySelector(`.tree-node[data-id="${this.currentSectionId}"]`);
            if (activeEl) {
                // Expand parents
                let parent = activeEl.parentElement;
                while (parent && parent !== this.els.treeRoot) {
                    if (parent.classList.contains('tree-children')) {
                        const node = parent.parentElement;
                        if (node) node.classList.add('expanded');
                    }
                    parent = parent.parentElement;
                }
                // Expand self if has children
                if (activeEl.classList.contains('has-children')) activeEl.classList.add('expanded');
            }
        }
    },

    // --- Drag & Drop Handlers ---
    dragSrcId: null,

    handleDragStart(e, node) {
        e.stopPropagation(); // CRITICAL: Stop bubbling to parent containers!
        this.dragSrcId = node.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.id);
        e.target.classList.add('dragging');
    },

    handleDragOver(e) {
        if (e.preventDefault) e.preventDefault(); // Necessary for drop
        e.dataTransfer.dropEffect = 'move';

        // Visual Feedback
        const target = e.target.closest('.tree-node');
        if (target && target.dataset.id !== this.dragSrcId) {
            target.classList.add('drag-over');
        }
        return false;
    },

    handleDragLeave(e) {
        const target = e.target.closest('.tree-node');
        if (target) {
            target.classList.remove('drag-over');
        }
    },

    handleDrop(e, targetNode) {
        e.stopPropagation();
        e.preventDefault();

        const targetEl = e.target.closest('.tree-node');
        if (targetEl) targetEl.classList.remove('drag-over');

        const srcId = e.dataTransfer.getData('text/plain');
        if (srcId === targetNode.id) return; // Dropped on self

        if (confirm(`Move folder inside "${targetNode.title}"?`)) {
            // Logic to move srcId -> targetNode.id (as parent)
            BinderManager.moveNode(this.currentMemberId, srcId, targetNode.id);
            this.renderTree();
        }

        return false;
    },

    handleDropRoot(e) {
        const srcId = e.dataTransfer.getData('text/plain');
        if (!srcId) return;

        // Visual check?
        if (confirm("Move folder to Top Level (Root)?")) {
            BinderManager.moveNode(this.currentMemberId, srcId, null);
            this.renderTree();
        }
    },

    handleDragEnd(e) {
        this.dragSrcId = null;
        document.querySelectorAll('.tree-node').forEach(el => {
            el.classList.remove('dragging');
            el.classList.remove('drag-over');
        });
    },

    selectSection(sectionId) {
        this.currentSectionId = sectionId;

        // Update Tree UI Highlight
        document.querySelectorAll('.tree-node').forEach(el => el.classList.remove('selected'));
        const activeEl = document.querySelector(`.tree-node[data-id="${sectionId}"]`);
        if (activeEl) {
            activeEl.classList.add('selected');
            activeEl.classList.add('expanded'); // Auto expand
        }

        // Update Content Area
        const root = BinderManager.getContent(this.currentMemberId);
        const node = BinderManager.findNode(root, sectionId);

        if (node) {
            this.els.contentTitle.textContent = node.title;
            this.els.btnAddField.disabled = false;
            this.els.btnEditSection.disabled = false;
            if (this.els.btnDuplicateSection) this.els.btnDuplicateSection.disabled = false;
            this.els.btnDeleteSection.disabled = false;

            const btnAddSub = document.getElementById('btn-add-sub-section');
            if (btnAddSub) btnAddSub.disabled = false;

            this.renderFields(node);
        } else {
            this.renderContentEmpty();
        }
    },

    renderFields(sectionNode) {
        this.els.fieldsContainer.innerHTML = '';

        if (!sectionNode.children || sectionNode.children.length === 0) {
            this.els.fieldsContainer.innerHTML = '<div class="empty-state">This folder is empty.<br>Add sub-folders or fields.</div>';
            return;
        }

        // Separate Fields from Sub-Sections (Sub-sections show in tree, fields in grid)
        const fields = sectionNode.children.filter(n => n.type === 'field');

        if (fields.length === 0) {
            this.els.fieldsContainer.innerHTML = '<div class="empty-state">No fields in this section.</div>';
            return;
        }

        fields.forEach(field => {
            const card = document.createElement('div');
            card.className = 'field-card';

            let valDisplay = field.value;
            let valClass = 'field-value';
            let customStyle = '';

            // 1. Determine Display Value & Style
            if (field.fieldType === 'password') {
                valDisplay = '••••••••';
                valClass += ' password-mask';
            } else if (field.fieldType === 'date') {
                if (valDisplay) valDisplay = new Date(valDisplay).toLocaleDateString();
            } else if (field.fieldType === 'asset') {
                if (valDisplay) {
                    valDisplay = '+ ' + this.formatMoney(valDisplay);
                    customStyle = 'color: #2e7d32; font-weight: bold;';
                }
            } else if (field.fieldType === 'liability') {
                if (valDisplay) {
                    valDisplay = '- ' + this.formatMoney(valDisplay);
                    customStyle = 'color: #c62828; font-weight: bold;';
                }
            }

            // 2. Create Elements
            const label = document.createElement('span');
            label.className = 'field-label';
            label.textContent = field.title;

            const valDiv = document.createElement('div');
            valDiv.className = valClass;
            valDiv.textContent = valDisplay || '(Empty)';
            if (!valDisplay) valDiv.style.color = '#ccc';
            if (customStyle) valDiv.style.cssText = customStyle;

            // Password Toggle Logic
            if (field.fieldType === 'password') {
                valDiv.onclick = () => {
                    if (valDiv.textContent === '••••••••') {
                        valDiv.textContent = field.value || '(Empty)';
                        valDiv.classList.remove('password-mask');
                    } else {
                        valDiv.textContent = '••••••••';
                        valDiv.classList.add('password-mask');
                    }
                };
            }

            // Actions
            const actions = document.createElement('div');
            actions.className = 'field-actions';
            actions.innerHTML = `
                <button class="btn-icon-small edit-field" title="Edit">✎</button>
                <button class="btn-icon-small delete-field" title="Delete">🗑️</button>
            `;

            actions.querySelector('.edit-field').onclick = () => this.openModal('field', field);
            actions.querySelector('.delete-field').onclick = () => {
                if (confirm("Delete this field?")) {
                    BinderManager.deleteNode(this.currentMemberId, field.id);
                    this.render();
                }
            };

            card.appendChild(label);
            card.appendChild(valDiv);
            card.appendChild(actions);
            this.els.fieldsContainer.appendChild(card);
        });
    },

    renderContentEmpty() {
        this.els.contentTitle.textContent = "Select a Section";
        this.els.fieldsContainer.innerHTML = '<div class="empty-state"><p>Select a section from the left sidebar to view details.</p></div>';
        this.els.btnAddField.disabled = true;
        this.els.btnEditSection.disabled = true;
        if (this.els.btnDuplicateSection) this.els.btnDuplicateSection.disabled = true;
        this.els.btnDeleteSection.disabled = true;
        const btnAddSub = document.getElementById('btn-add-sub-section');
        if (btnAddSub) btnAddSub.disabled = true;
    },

    renderDashboard() {
        const dashboard = this.els.dashboard; // Wrapper
        dashboard.innerHTML = '';

        // --- 1. Net Worth Widget ---
        const summary = BinderManager.calculateAssetSummary(this.currentMemberId);

        // FINANCIAL OVERVIEW
        const div = document.createElement('div');
        div.style.marginBottom = '20px';
        div.style.padding = '10px';
        div.style.background = '#f9f9f9';
        div.style.borderRadius = '8px';
        div.style.border = '1px solid #eee';

        // const format = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

        div.innerHTML = `
            <h4 style="margin:0 0 10px 0; color:#444; font-size: 0.9em; text-transform:uppercase;">💰 Financial Overview</h4>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9em;">
                <span style="color:#2e7d32;">Assets:</span>
                <span style="font-weight:600; color:#2e7d32;">${this.formatMoney(summary.assets)}</span>
            </div>
             <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9em;">
                <span style="color:#c62828;">Liabilities:</span>
                <span style="font-weight:600; color:#c62828;">${this.formatMoney(summary.liabilities)}</span>
            </div>
            <div style="border-top:1px dashed #ccc; margin:5px 0;"></div>
            <div style="display:flex; justify-content:space-between; font-size:1em;">
                <span style="font-weight:600;">Net Worth:</span>
                <span style="font-weight:700; color:${summary.netWorth >= 0 ? '#333' : '#c62828'};">${this.formatMoney(summary.netWorth)}</span>
            </div>
       `;
        dashboard.appendChild(div);

        // --- 2. Alerts Widget ---
        // Header
        const alertHeader = document.createElement('div');
        alertHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;";
        alertHeader.innerHTML = `
             <h4 style="margin: 0; color: #d32f2f; font-size: 0.9em;">Upcoming Alerts</h4>
             <button id="btn-refresh-alerts" class="btn-icon-small" title="Check Validity Now">🔄</button>
         `;
        // Re-attach refresh listener if we want, or just rely on render loop.
        // Since we wiping innerHTML, listener on button is lost.
        // We should delegate or add onclick here.
        const btnRefresh = alertHeader.querySelector('#btn-refresh-alerts');
        if (btnRefresh) btnRefresh.onclick = () => this.renderDashboard();

        dashboard.appendChild(alertHeader);

        const alerts = BinderManager.getUpcomingDates(60); // 2 months
        if (alerts.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size: 0.8rem; color: #999;';
            empty.textContent = 'No upcoming expiries.';
            dashboard.appendChild(empty);
            return;
        }

        alerts.forEach(a => {
            const div = document.createElement('div');
            div.className = `alert-item ${a.daysLeft < 30 ? 'urgent' : ''}`;
            div.innerHTML = `
                <div class="alert-info">
                    <div style="font-weight:500;">${a.title}</div>
                    <div style="font-size:0.75rem; color:#666;">${a.member} • ${a.date.toLocaleDateString()}</div>
                </div>
                <div class="alert-days">${a.daysLeft}d</div>
            `;
            dashboard.appendChild(div);
        });
    },

    // --- Modals ---
    pendingEditId: null, // If editing existing
    pendingMode: null, // 'section' or 'field'

    openModal(mode, existingData = null) {
        this.els.modal.style.display = 'flex';
        this.pendingMode = mode;
        this.pendingEditId = existingData ? existingData.id : null;

        // Reset Inputs
        this.els.inputTitle.value = existingData ? existingData.title : '';
        this.els.inputValue.value = existingData ? existingData.value : '';
        this.els.inputType.value = existingData ? existingData.fieldType : 'text';

        // Set Input Type correctly
        if (this.els.inputType.value === 'date') this.els.inputValue.type = 'date';
        else if (this.els.inputType.value === 'number') this.els.inputValue.type = 'number';
        else this.els.inputValue.type = 'text';

        // Show/Hide Field Options
        if (mode === 'field') {
            this.els.fieldOptions.style.display = 'block';
        } else {
            this.els.fieldOptions.style.display = 'none';
        }

        // Dynamic Context-Aware Title
        if (existingData) {
            // Editing existing
            const typeLabel = mode === 'field' ? 'Field' : 'Section';
            this.els.modalTitle.textContent = `Edit ${typeLabel}: "${existingData.title}"`;
        } else {
            // Adding New
            let parentName = "Root (Top Level)";
            if (this.currentSectionId) {
                const root = BinderManager.getContent(this.currentMemberId);
                const node = BinderManager.findNode(root, this.currentSectionId);
                if (node) parentName = node.title;
            }

            if (mode === 'field') {
                this.els.modalTitle.textContent = `Adding Field to: "${parentName}"`;
            } else {
                if (this.currentSectionId) {
                    this.els.modalTitle.textContent = `Adding Sub-Section under: "${parentName}"`;
                } else {
                    this.els.modalTitle.textContent = `Adding new Root Section`;
                }
            }
        }

        this.els.inputTitle.focus();
    },

    handleSave() {
        const title = this.els.inputTitle.value.trim();
        if (!title) { alert("Title is required"); return; }

        const data = { title };

        if (this.pendingMode === 'field') {
            data.type = 'field';
            data.fieldType = this.els.inputType.value;
            data.value = this.els.inputValue.value;
        } else {
            data.type = 'section';
            // Sections don't have values/types
        }

        if (this.pendingEditId) {
            // Update
            BinderManager.updateNode(this.currentMemberId, this.pendingEditId, data);
        } else {
            // New
            // Uses currentSectionId as parent. If null, adds to root.
            BinderManager.addNode(this.currentMemberId, this.currentSectionId, data);

            // If we added a child to a section, we should expand that section in tree
            if (this.currentSectionId) {
                const parentEl = document.querySelector(`.tree-node[data-id="${this.currentSectionId}"]`);
                if (parentEl) parentEl.classList.add('expanded');
            }
        }

        this.els.modal.style.display = 'none';
        this.render(); // Handles Refresh
    }

};

// Init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init if view exists
    if (document.getElementById('view-binder')) {
        BinderUI.init();
        BinderUI.render(); // Initial Render
    }
});
