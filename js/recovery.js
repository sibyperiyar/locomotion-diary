/**
 * Recovery Manager
 * Handles the generation of Emergency Access Kits and Backup/Restore operations.
 */
const RecoveryManager = {

    /**
     * Generates a downloadable HTML file containing the Master Password and Encrypted Data.
     */
    downloadEmergencyKit() {
        if (!BinderManager.sessionKey || !BinderManager.encryptedData) {
            alert("Binder is locked or empty. Cannot generate kit.");
            return;
        }

        const password = BinderManager.sessionKey;
        const timestamp = new Date().toLocaleString();

        // We embed the raw encrypted JSON to allow restore
        const backupPayload = JSON.stringify({
            data: BinderManager.encryptedData,
            meta: {
                exportedAt: Date.now(),
                appVersion: '2.0'
            }
        });

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Locomotion Diary - Emergency Access Kit</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
        .header { border-bottom: 2px solid #d32f2f; padding-bottom: 20px; margin-bottom: 40px; }
        h1 { color: #d32f2f; margin: 0; }
        .warning { background: #fff3e0; border-left: 5px solid #ff9800; padding: 15px; margin: 20px 0; }
        .credential-box { background: #f5f5f5; border: 1px solid #ddd; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
        .password { font-family: monospace; font-size: 2em; letter-spacing: 2px; color: #2c3e50; font-weight: bold; background: white; padding: 10px 20px; border-radius: 4px; border: 1px dashed #999; display: inline-block; }
        .instructions { background: #e3f2fd; padding: 20px; border-radius: 8px; }
        .footer { margin-top: 50px; font-size: 0.8em; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
        textarea { width: 100%; height: 100px; margin-top: 10px; font-family: monospace; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Emergency Access Kit 🚑</h1>
        <p>Generated on: ${timestamp}</p>
    </div>

    <div class="warning">
        <strong>⚠️ KEEP THIS FILE SAFE</strong><br>
        This file contains your <strong>Master Password</strong> and a backup of your data.<br>
        Anyone with access to this file can unlock your Locomotion Diary.
    </div>

    <div class="credential-box">
        <div>Your Master Password</div>
        <div class="password">${password}</div>
    </div>

    <div class="instructions">
        <h3>How to Restore</h3>
        <ol>
            <li>Open <strong>Locomotion Diary</strong>.</li>
            <li>If locked out, click <strong>"Restore from Backup"</strong> on the lock screen.</li>
            <li>Upload this HTML file (or copy the backup code below).</li>
            <li>Enter the Master Password shown above.</li>
        </ol>
    </div>

    <div style="margin-top: 40px;">
        <h3>Encrypted Backup Data</h3>
        <p>This text block contains your encrypted data. You can copy-paste this into the Restore tool if file upload fails.</p>
        <textarea readonly id="backup-data">${backupPayload}</textarea>
    </div>

    <div class="footer">
        Locomotion Diary • Secure Personal Data Store • v2.0
    </div>
</body>
</html>
        `;

        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Locomotion-Emergency-Kit-${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Trigger file picker to restore data (Unified Restore)
     * Handles:
     * 1. Emergency Kit (HTML) -> Restores Binder + Password
     * 2. Diary Backup (JSON) -> Restores Diary Events (requires unlock first if locked)
     */
    triggerRestore() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.html,.json,.locomotion';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) { resolve(false); return; }

                const text = await file.text();
                try {
                    let data = null;
                    let foundPassword = null;
                    let isBinderBackup = false;

                    // A. Attempt to Parse as JSON first
                    try {
                        data = JSON.parse(text);
                    } catch (jsonErr) {
                        // B. Not JSON? Try extracting from HTML (Emergency Kit)
                        const matchData = text.match(/<textarea readonly id="backup-data">([\s\S]*?)<\/textarea>/);
                        if (matchData && matchData[1]) {
                            data = JSON.parse(matchData[1]);
                            isBinderBackup = true; // HTML is definitely Binder

                            // Extract Password
                            const matchPwd = text.match(/<div class="password">(.*?)<\/div>/);
                            if (matchPwd && matchPwd[1]) {
                                foundPassword = matchPwd[1];
                            }
                        } else {
                            throw new Error("No recognized backup data found.");
                        }
                    }

                    // --- TYPE DETECTION ---

                    // Case 1: Binder Backup (Encrypted Wrapper)
                    if (data && data.data && data.data.ciphertext) {
                        isBinderBackup = true;
                    }

                    // Case 2: Diary Backup (Raw Event Array or Export Object)
                    // Diary exports are usually arrays or objects with "locomotion_export"
                    let isDiaryBackup = false;
                    let eventsToImport = null;

                    if (Array.isArray(data)) {
                        isDiaryBackup = true;
                        eventsToImport = data;
                    } else if (data.locomotion_export || (data.meta && data.events)) {
                        isDiaryBackup = true;
                        eventsToImport = data.events || data;
                    }

                    // --- EXECUTION ---

                    if (isBinderBackup) {
                        // === RESTORE BINDER ===
                        if (confirm("⚠️ BINDER RESTORE ⚠️\n\nThis will OVERWRITE your current secure binder data.\nAre you sure?")) {
                            localStorage.setItem(BinderManager.STORAGE_KEY, JSON.stringify(data.data));
                            BinderManager.encryptedData = data.data;
                            BinderManager.isLocked = true;

                            if (foundPassword) {
                                const success = await BinderManager.unlock(foundPassword);
                                if (success) {
                                    alert("✅ Binder Restored & Unlocked!");

                                    // Also set the session key for Diary if useful?
                                    // For now, just reload to let auth.js handle logic
                                    window.location.reload();
                                    resolve(true);
                                    return;
                                }
                            }
                            alert("Restore Complete! Please enter your Master Password.");
                            window.location.reload();
                            resolve(true);
                        }

                    } else if (isDiaryBackup) {
                        // === RESTORE DIARY ===
                        // We can only restore diary if we are UNLOCKED (because we need to write to encrypted DB)
                        if (BinderManager.isLocked && !BinderManager.sessionKey) {
                            alert("🔒 App is Locked!\n\nPlease UNLOCK the app first (or Reset) before importing a Diary JSON backup.");
                            resolve(false);
                            return;
                        }

                        if (!window.DiaryStore) {
                            alert("Diary Store not ready.");
                            resolve(false);
                            return;
                        }

                        if (confirm(`📅 DIARY IMPORT\n\nFound ${eventsToImport.length} events.\nMerge them into your diary?`)) {
                            try {
                                // Use the existing import logic if available?
                                // Or direct DB call.
                                // Let's use direct DB call to be safe from UI deps.
                                await window.DiaryStore.mergeEvents(eventsToImport);
                                alert("✅ Import Successful!");
                                if (window.startApp) window.startApp();
                                resolve(true);
                            } catch (impErr) {
                                alert("Import Failed: " + impErr.message);
                            }
                        }

                    } else {
                        alert("Unknown Backup Format.\nPlease upload a valid Binder HTML or Diary JSON.");
                        resolve(false);
                    }

                } catch (err) {
                    console.error("Restore failed", err);
                    alert("Restore Failed: " + err.message);
                    resolve(false);
                }
            };

            input.click();
        });
    }
};

window.RecoveryManager = RecoveryManager;
