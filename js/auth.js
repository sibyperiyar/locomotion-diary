/**
 * Auth Manager & App Launcher
 * Handles the "Secure Lock Screen" and initializes encryption before the app starts.
 */

(async function logic() {
    // UI Elements
    const authScreen = document.getElementById('app-lock-screen');
    const pwdInput = document.getElementById('auth-password');
    const btnUnlock = document.getElementById('btn-unlock-app');
    const authError = document.getElementById('auth-error');
    const authTitle = document.getElementById('lock-title');
    const authMsg = document.getElementById('lock-message');
    const authSetupNote = document.getElementById('auth-setup-note');

    // Wait for App Globals
    const waitForApp = async () => {
        while (!window.DiaryStore || !window.BinderManager) {
            await new Promise(r => setTimeout(r, 100)); // Polling
        }
    };

    await waitForApp();

    // Initialize Binder (Native Crypto Check)
    await BinderManager.init();

    // Helper: Get or Create App-Specific Salt for Diary Encryption
    const getAppSalt = () => {
        let saltStr = localStorage.getItem('diary_sec_salt');
        if (!saltStr) {
            const s = window.crypto.getRandomValues(new Uint8Array(16));
            saltStr = btoa(String.fromCharCode(...s));
            localStorage.setItem('diary_sec_salt', saltStr);
        }
        return Uint8Array.from(atob(saltStr), c => c.charCodeAt(0));
    };

    // Helper to start app with encryption
    const launchApp = async (sessionKey) => {
        if (window.DiaryStore) {
            if (sessionKey) {
                // Enable Encryption (V2 Key)
                window.DiaryStore.enableEncryption(sessionKey);

                // OPTIMIZATION / MIGRATION CHECK:
                // We run this in BACKGROUND to ensure data matches the efficient V2 format.
                // Do not await to allow immediate app entry.
                if (window.DiaryStore.migrateToEncrypted) {
                    window.DiaryStore.migrateToEncrypted().then(count => {
                        if (count > 0) console.log(`Background Security Update: Secured ${count} entries.`);
                    }).catch(e => console.error("Background Migration Warning", e));
                }
            }
            if (window.startApp) window.startApp();
        }
    };

    // Auth Logic
    if (BinderManager.isLocked) {
        // --- LOCKED MODE ---
        authScreen.style.display = 'flex';
        pwdInput.focus();

        // --- BIOMETRIC UNLOCK (New) ---
        if (window.WebAuthnHelper && window.WebAuthnHelper.isEnrolled()) {
            const btnBio = document.createElement('button');
            btnBio.className = 'btn';
            btnBio.style.background = '#27ae60'; // Green
            btnBio.style.marginLeft = '10px';
            btnBio.innerHTML = "👆 Bio Unlock";
            btnBio.title = "Use Windows Hello / TouchID";

            btnBio.onclick = async () => {
                try {
                    authError.textContent = "Scanning...";
                    const recoveredPwd = await window.WebAuthnHelper.unlock();
                    pwdInput.value = recoveredPwd;
                    attemptUnlock(); // Auto-submit
                } catch (e) {
                    console.error(e);
                    authError.textContent = "Bio Failed: " + e.message;
                }
            };

            // Insert next to Unlock button
            btnUnlock.parentNode.insertBefore(btnBio, btnUnlock.nextSibling);
        }

        const attemptUnlock = async () => {
            const pwd = pwdInput.value;
            authError.style.color = "#e74c3c"; // Red reset
            authError.textContent = "Verifying...";
            try {
                // 1. Verify against Binder (Master Password Check)
                const success = await BinderManager.unlock(pwd);
                if (success) {
                    authError.style.color = "#2e7d32";
                    authError.textContent = "Success! Securing session...";

                    // 2. Derive Diary Session Key (Fast V2 Key)
                    const salt = getAppSalt();
                    const sessionKey = await window.CryptoHelper.deriveSessionKey(pwd, salt);

                    // 3. Set Legacy Password for background optimization (to read old data)
                    if (window.DiaryStore.setLegacyPassword) {
                        window.DiaryStore.setLegacyPassword(pwd);
                    }

                    // 4. Launch
                    await launchApp(sessionKey);
                    authScreen.style.display = 'none';

                    // --- BIOMETRIC ENROLLMENT PROMPT ---
                    // If supported, not enrolled, and successfully unlocked with password
                    if (window.WebAuthnHelper) {
                        const supported = await window.WebAuthnHelper.isSupported();
                        const enrolled = window.WebAuthnHelper.isEnrolled();

                        if (supported && !enrolled) {
                            // Gentle prompt
                            setTimeout(async () => {
                                if (confirm("✨ ENABLE BIOMETRICS? ✨\n\nYour device supports secure unlock (Windows Hello / TouchID).\nDo you want to enable it for faster access next time?")) {
                                    try {
                                        await window.WebAuthnHelper.enroll(pwd);
                                        alert("✅ Biometrics Enabled!\nNext time, look for the 'Bio Unlock' button.");
                                    } catch (err) {
                                        alert("Setup Failed: " + err.message);
                                    }
                                }
                            }, 1000);
                        }
                    }

                } else {
                    authError.textContent = "Incorrect Password";
                    pwdInput.classList.add('error');
                    setTimeout(() => pwdInput.classList.remove('error'), 500);
                }
            } catch (e) {
                console.error("Unlock Error", e);
                authError.textContent = "Unlock Error: " + e.message;
            }
        };

        btnUnlock.onclick = attemptUnlock;
        pwdInput.onkeypress = (e) => { if (e.key === 'Enter') attemptUnlock(); };

        // --- RESTORE BUTTON (Dynamic) ---
        if (!document.getElementById('btn-auth-restore')) {
            const container = authScreen.querySelector('.lock-card');

            // Container for extra actions
            const actionRow = document.createElement('div');
            actionRow.style.marginTop = '15px';
            actionRow.style.display = 'flex';
            actionRow.style.gap = '10px';
            actionRow.style.justifyContent = 'center';

            // 1. Restore Button
            const btnRestore = document.createElement('button');
            btnRestore.id = 'btn-auth-restore';
            btnRestore.className = 'btn outline small';
            btnRestore.textContent = "♻️ Restore Backup";
            btnRestore.title = "Restore from Binder HTML or Diary JSON";
            btnRestore.onclick = () => {
                if (window.RecoveryManager) RecoveryManager.triggerRestore();
            };

            // 2. Factory Reset Button (New)
            const btnReset = document.createElement('button');
            btnReset.id = 'btn-auth-reset';
            btnReset.className = 'btn outline small danger';
            btnReset.style.borderColor = '#e74c3c';
            btnReset.style.color = '#e74c3c';
            btnReset.textContent = "🗑️ Reset App";
            btnReset.title = "Forgot Password? Wipe Data to Start Fresh.";
            btnReset.onclick = async () => {
                if (confirm("🚨 FACTORY RESET 🚨\n\nForgot your password?\nThis will DELETE ALL DATA (Binder & Diary) so you can start fresh or import a JSON backup.\n\nAre you sure you want to Wipe Everything?")) {
                    if (confirm("Last Warning: This action is IRREVERSIBLE.\n\nDelete all data?")) {
                        console.log("Factory Reset Triggered...");

                        // 1. Clear LocalStorage (Binder, Keys, Salt)
                        localStorage.clear();

                        // 2. Clear IndexedDB (Diary)
                        const req = indexedDB.deleteDatabase("LocomotionDiaryDB");
                        req.onsuccess = () => {
                            alert("App Reset Complete.\nReloading...");
                            window.location.reload();
                        };
                        req.onerror = (e) => {
                            alert("Error clearing DB. Please manually clear browser data.");
                            window.location.reload();
                        };
                    }
                }
            };

            actionRow.appendChild(btnRestore);
            actionRow.appendChild(btnReset);
            container.appendChild(actionRow);
        }

    } else if (!BinderManager.sessionKey) {
        // --- SETUP MODE (First Run / Migration) ---
        authScreen.style.display = 'flex';
        authTitle.textContent = "Secure Your Diary";
        authMsg.textContent = "Create a Master Password to encrypt your data.";
        authSetupNote.style.display = 'block';
        btnUnlock.textContent = "Set Password & Enter";
        pwdInput.placeholder = "Create New Password";

        const attemptSetup = async () => {
            const pwd = pwdInput.value;
            if (pwd.length < 4) {
                authError.textContent = "Password too short (min 4 chars)";
                return;
            }

            authError.textContent = "Encrypting... (Do not close)";
            try {
                // 1. Setup Binder Encryption
                const success = await BinderManager.setupEncryption(pwd);
                if (success) {
                    // 2. Generate Salt & Derive Session Key
                    const salt = getAppSalt();
                    const sessionKey = await window.CryptoHelper.deriveSessionKey(pwd, salt);

                    // 3. Set Legacy Password (same as new)
                    if (window.DiaryStore.setLegacyPassword) {
                        window.DiaryStore.setLegacyPassword(pwd);
                    }

                    authError.textContent = "Securing Diary Events...";
                    await launchApp(sessionKey);

                    alert("Master Password Set! Your Diary & Binder are now encrypted.");
                    authScreen.style.display = 'none';

                    // --- BIOMETRIC ENROLLMENT PROMPT (SETUP) ---
                    if (window.WebAuthnHelper) {
                        if (await window.WebAuthnHelper.isSupported()) {
                            if (confirm("✨ ENABLE BIOMETRICS? ✨\n\nEnable Windows Hello / TouchID for faster access?")) {
                                await window.WebAuthnHelper.enroll(pwd);
                                alert("✅ Biometrics Enabled!");
                            }
                        }
                    }

                } else {
                    authError.textContent = "Setup Failed";
                }
            } catch (e) {
                console.error("Setup Error:", e);
                authError.textContent = "Error: " + e.message;
                alert("Setup Error: " + e.message);
            }
        };

        btnUnlock.onclick = attemptSetup;
        pwdInput.onkeypress = (e) => { if (e.key === 'Enter') attemptSetup(); };

    } else {
        // --- UNLOCKED / LEGACY ---
        if (window.startApp) window.startApp();
    }

})();
