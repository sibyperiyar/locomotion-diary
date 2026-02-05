/**
 * BinderPrint
 * Module for generating a "Book-style" PDF export of the Legacy Binder data.
 */

const BinderPrint = {

    /**
     * Entry point to print a specific member's binder
     * @param {string} memberId 
     * @param {string} passwordMode - 'mask' | 'show' | 'hint'
     */
    printMember(memberId, passwordMode = 'mask') {
        const member = BinderManager.getMember(memberId);
        if (!member) return;

        const content = BinderManager.getContent(memberId);

        // 1. Generate HTML Content
        const htmlBody = this.generateBody(member, content, passwordMode);

        // 2. Create Hidden Iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';

        document.body.appendChild(iframe);

        // 3. Write Document
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Binder Export - ${member.name}</title>
                <style>
                    ${this.getPrintStyles()}
                </style>
            </head>
            <body>
                ${htmlBody}
            </body>
            </html>
        `);
        doc.close();

        // 4. Print & Cleanup
        // Wait for images/resources (though we have none really)
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            // Cleanup after print dialog closes (approximate)
            // Browsers don't give a reliable callback for "after print".
            // We'll leave the iframe for a bit or remove it on next print.
            // For now, let's just leave it hidden or remove after long timeout
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 60000);
        }, 500);
    },

    /**
     * Generates the CSS for the print View
     */
    getPrintStyles() {
        return `
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Inter:wght@400;600&display=swap');

            :root {
                --p-text: #2c3e50;
                --p-accent: #2c3e50;
                --p-border: #ccc;
            }

            body {
                font-family: 'Merriweather', serif;
                color: var(--p-text);
                line-height: 1.6;
                margin: 0;
                padding: 2cm; /* Default margin if @page ignored */
            }

            @page {
                size: A4;
                margin: 2cm;
            }

            h1, h2, h3, h4 {
                font-family: 'Merriweather', serif;
                color: #000;
                page-break-after: avoid;
            }

            h1 { font-size: 2.5em; text-align: center; margin-bottom: 2em; text-transform: uppercase; letter-spacing: 2px; }
            h2 { font-size: 1.8em; border-bottom: 2px solid #333; padding-bottom: 10px; margin-top: 2em; margin-bottom: 1em; }
            h3 { font-size: 1.4em; color: #444; margin-top: 1.5em; border-left: 4px solid #333; padding-left: 10px; }
            h4 { font-size: 1.1em; color: #666; font-family: 'Inter', sans-serif; text-transform: uppercase; margin-top: 1em; }

            /* Cover Page */
            .cover-page {
                height: 90vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                page-break-after: always;
            }
            .cover-title { font-size: 3em; font-weight: bold; margin-bottom: 0.5em; }
            .cover-subtitle { font-size: 1.5em; color: #666; }
            .cover-date { margin-top: 3em; color: #888; font-family: 'Inter', sans-serif; }

            /* Tables (Record Lists) */
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 2em;
                font-family: 'Inter', sans-serif;
                font-size: 0.9em;
                page-break-inside: auto;
            }
            
            tr { page-break-inside: avoid; page-break-after: auto; }
            
            th {
                background-color: #f0f0f0;
                border-bottom: 2px solid #333;
                text-align: left;
                padding: 8px 10px;
                font-weight: 600;
                color: #333;
            }

            td {
                border-bottom: 1px solid #ddd;
                padding: 8px 10px;
                vertical-align: top;
            }

            /* Key-Value Detail Grid */
            .detail-grid {
                display: grid;
                grid-template-columns: 1fr 1fr; /* 2 Column layout for details */
                gap: 20px 40px;
                margin-bottom: 2em;
                page-break-inside: avoid;
            }

            .detail-item {
                margin-bottom: 10px;
            }

            .detail-label {
                font-family: 'Inter', sans-serif;
                font-size: 0.8em;
                text-transform: uppercase;
                color: #777;
                letter-spacing: 0.5px;
                display: block;
            }

            .detail-value {
                font-size: 1.1em;
                font-weight: 500;
                border-bottom: 1px dotted #ccc;
                padding-bottom: 2px;
                display: block;
            }
            
            /* Helper for long sections to break */
            .section-block {
                margin-bottom: 2em;
            }
            
            .empty-msg {
                font-style: italic;
                color: #999;
                font-family: 'Inter', sans-serif;
                font-size: 0.9em;
            }
        `;
    },

    generateBody(member, contentNodes, passwordMode) {
        let html = '';

        // 1. Cover Page
        html += `
            <div class="cover-page">
                <div class="cover-title">Confidential Binder</div>
                <div class="cover-subtitle">${member.name} (${member.relation})</div>
                <div class="cover-date">Generated on ${new Date().toLocaleDateString()}</div>
            </div>
        `;

        // 2. Iterate Root Nodes (Main Sections)
        contentNodes.forEach(node => {
            html += this.processNode(node, 1, passwordMode);
        });

        return html;
    },

    /**
     * Recursive function to process nodes
     * @param {*} node 
     * @param {*} level - Heading Level (1=H2, 2=H3, etc)
     * @param {*} passwordMode 
     */
    processNode(node, level, passwordMode) {
        if (node.type === 'field') return ''; // Fields handled by parent section

        let html = `<div class="section-block">`;

        // Heading
        const hTag = `h${Math.min(level + 1, 6)}`; // Start at H2
        html += `<${hTag}>${node.title}</${hTag}>`;

        if (!node.children || node.children.length === 0) {
            html += `<div class="empty-msg">(No content)</div></div>`;
            return html;
        }

        // --- Heusistic: Detect Content Mode ---
        // 1. Are children directly FIELDS? -> Detail View
        // 2. Are children SECTIONS? -> Table View (Multi-record) OR Sub-Sections (Recursive)

        const childFields = node.children.filter(c => c.type === 'field');
        const childSections = node.children.filter(c => c.type === 'section');

        // CASE A: Mixed Content or Mostly Fields directly here
        // Usually leaf sections have only fields.
        if (childFields.length > 0) {
            // Render Fields in Grid
            html += `<div class="detail-grid">`;
            childFields.forEach(f => {
                html += `
                    <div class="detail-item">
                        <span class="detail-label">${f.title}</span>
                        <span class="detail-value">${this.formatValue(f, passwordMode)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // CASE B: Has Sub-Sections (Children)
        if (childSections.length > 0) {
            // Check if these sub-sections "look like rows" in a table.
            // A "Row" section usually has fields inside it.
            // If the first child section has fields, we can try to make a table.

            // Heuristic: If there are multiple child sections, and they share similar structure (fields), treat as table.
            // Simplified: If child sections have NO sub-sections of their own, treat as TABLE (Record List).
            // Example: "Insurance" -> ["Policy A", "Policy B"] -> Each has fields.

            const isTabularCandidate = childSections.every(sec =>
                !sec.children || sec.children.every(c => c.type === 'field')
            );

            if (isTabularCandidate && childSections.length > 0) {
                // RENDER AS TABLE
                html += this.renderTable(childSections, passwordMode);
            } else {
                // RENDER AS NESTED SECTIONS (Standard Recursive)
                childSections.forEach(sec => {
                    html += this.processNode(sec, level + 1, passwordMode);
                });
            }
        }

        html += `</div>`;
        return html;
    },

    renderTable(sections, passwordMode) {
        // 1. Harvest all unique field keys (titles) to form columns
        // We also include the Section Title itself as the first column "Item" or "Name" if relevant?
        // Actually, normally the Section Title is the "ID" (e.g. "HDFC Bank").
        // So Col 1 = "Record Name", Cols... = Fields

        const allFieldTitles = new Set();
        sections.forEach(sec => {
            if (sec.children) {
                sec.children.forEach(c => {
                    if (c.type === 'field') allFieldTitles.add(c.title);
                });
            }
        });

        const columns = Array.from(allFieldTitles);

        if (columns.length === 0) {
            // Just a list of titles
            return `<ul>${sections.map(s => `<li>${s.title}</li>`).join('')}</ul>`;
        }

        let html = `<table><thead><tr>`;
        html += `<th>Item</th>`; // The Section Title Column
        columns.forEach(col => html += `<th>${col}</th>`);
        html += `</tr></thead><tbody>`;

        sections.forEach(sec => {
            html += `<tr>`;
            html += `<td><strong>${sec.title}</strong></td>`;

            columns.forEach(col => {
                // Find field with this title
                const field = sec.children ? sec.children.find(c => c.type === 'field' && c.title === col) : null;
                const val = field ? this.formatValue(field, passwordMode) : '-';
                html += `<td>${val}</td>`;
            });

            html += `</tr>`;
        });

        html += `</tbody></table>`;
        return html;
    },

    formatValue(field, passwordMode) {
        if (!field.value) return '';

        if (field.fieldType === 'password') {
            const val = field.value;
            if (passwordMode === 'show') return val;
            if (passwordMode === 'mask') return '********';
            if (passwordMode === 'hint') {
                if (val.length <= 2) return val[0] + '***';
                return val[0] + '******' + val[val.length - 1];
            }
            return '********';
        }

        if (field.fieldType === 'date') {
            try {
                return new Date(field.value).toLocaleDateString();
            } catch (e) { return field.value; }
        }

        if (field.fieldType === 'asset') {
            const val = parseFloat(field.value);
            if (!isNaN(val)) {
                return `<span style="color:#2e7d32; font-weight:bold;">+ ${val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>`;
            }
        }

        if (field.fieldType === 'liability') {
            const val = parseFloat(field.value);
            if (!isNaN(val)) {
                return `<span style="color:#c62828; font-weight:bold;">- ${val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>`;
            }
        }

        return field.value;
    }
};

window.BinderPrint = BinderPrint;
