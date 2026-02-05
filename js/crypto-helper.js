/**
 * Shared Crypto Helper (Native Web Crypto)
 * Provides AES-GCM-256 encryption/decryption for Binder and Diary.
 */
const CryptoHelper = {
    // --- OPTIMIZED V2: Shared Key Support ---

    // Derive a CryptoKey object (Session Key) once per session
    async deriveSessionKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    },

    // Encrypt using a pre-derived CryptoKey (Fast, no KDF)
    async encryptWithKey(dataObj, cryptoKey) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
        const enc = new TextEncoder();
        const encoded = enc.encode(JSON.stringify(dataObj));

        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, cryptoKey, encoded
        );

        return {
            algo: "AES-GCM-KEYS", // V2 Indicator
            iv: btoa(String.fromCharCode(...iv)),
            ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
        };
    },

    // Decrypt using a pre-derived CryptoKey
    async decryptWithKey(encryptedPayload, cryptoKey) {
        try {
            const iv = Uint8Array.from(atob(encryptedPayload.iv), c => c.charCodeAt(0));
            const ciphertext = Uint8Array.from(atob(encryptedPayload.ciphertext), c => c.charCodeAt(0));

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, cryptoKey, ciphertext
            );

            const dec = new TextDecoder();
            return JSON.parse(dec.decode(decrypted));
        } catch (e) {
            console.error("CryptoHelper V2 Decrypt Failed:", e);
            throw new Error("Decryption failed. Data corruption or wrong key.");
        }
    },

    // Legacy support (Slow, Per-Event KDF)
    async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    },

    // Encrypt Data (Legacy V1)
    async encrypt(dataObj, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(password, salt);
        const enc = new TextEncoder();
        const encoded = enc.encode(JSON.stringify(dataObj));

        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, key, encoded
        );

        // Convert buffers to Base64 for storage
        return {
            algo: "AES-GCM",
            salt: btoa(String.fromCharCode(...salt)),
            iv: btoa(String.fromCharCode(...iv)),
            ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
        };
    },

    // Decrypt Data (Legacy V1)
    async decrypt(encryptedPayload, password) {
        try {
            // Decode Base64
            const salt = Uint8Array.from(atob(encryptedPayload.salt), c => c.charCodeAt(0));
            const iv = Uint8Array.from(atob(encryptedPayload.iv), c => c.charCodeAt(0));
            const ciphertext = Uint8Array.from(atob(encryptedPayload.ciphertext), c => c.charCodeAt(0));

            const key = await this.deriveKey(password, salt);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, key, ciphertext
            );

            const dec = new TextDecoder();
            return JSON.parse(dec.decode(decrypted));
        } catch (e) {
            console.error("CryptoHelper Decrypt Failed:", e);
            throw new Error("Decryption failed. Wrong password or corrupted data.");
        }
    }
};

// Expose globally
window.CryptoHelper = CryptoHelper;
