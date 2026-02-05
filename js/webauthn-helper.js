/**
 * WebAuthn Helper (Biometric Security)
 * Implements "Passwordless" Unlock using Windows Hello / TouchID via the PRF Extension.
 * 
 * Mechanism:
 * 1. We don't just "authenticate", we ask the Authenticator to derive a secret key (PRF) from a random salt.
 * 2. We use this derived key to Encrypt/Decrypt the user's Master Password.
 * 3. Results: The Master Password is stored on disk, but ONLY the hardware authenticator can decrypt it.
 */
const WebAuthnHelper = {
    // Storage Keys
    KEY_CRED_ID: 'webauthn_cred_id',
    KEY_SALT: 'webauthn_salt',
    KEY_BLOB: 'webauthn_blob', // Encrypted Master Password

    // Config
    RP_NAME: "Locomotion Diary",
    RP_ID: window.location.hostname, // Must match current domain (localhost or specific ID)

    /**
     * Check if Biometrics are supported and enabled in this browser.
     */
    async isSupported() {
        if (!window.PublicKeyCredential) return false;

        // Security Check: WebAuthn requires HTTPS or Localhost
        // It does NOT work on file:// protocol
        if (!window.isSecureContext) {
            console.warn("WebAuthn Skipped: Context is not secure (file://). Needs HTTPS or localhost.");
            return false;
        }

        // Check for Platform Auth (availability of Hello/TouchID)
        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (!available) return false;
        } catch (e) {
            return false;
        }

        return true;
    },

    /**
     * Check if we have a registered credential for this device.
     */
    isEnrolled() {
        return !!localStorage.getItem(this.KEY_CRED_ID);
    },

    /**
     * UTILS: Base64URL conversions (WebAuthn uses Base64URL, not standard Base64)
     */
    toBuffer(base64url) {
        const padding = '='.repeat((4 - base64url.length % 4) % 4);
        const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return Uint8Array.from(rawData, c => c.charCodeAt(0));
    },

    toBase64URL(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },

    /**
     * ENROLL: Register device and encrypt the password.
     */
    async enroll(masterPassword) {
        if (!await this.isSupported()) throw new Error("Biometrics not supported on this device.");

        // 1. Generate a Challenge & User ID
        const challenge = window.crypto.getRandomValues(new Uint8Array(32));
        const userId = window.crypto.getRandomValues(new Uint8Array(16));

        // 2. Prepare PRF Salt (We need this later to derive the key)
        // Note: Spec says we usually provide 'eval' during 'get', but for creation we just ask for support.
        // Wait, to get the Key *during enrollment* to encrypt the password, we have to perform a 'get' immediately after 'create'.
        // Or specific authenticators return it during create?
        // Standard flow: Create -> Get (internal/silent if possible?? No, 'get' always prompts).
        // Let's do: Create Credential (ask for 'prf' extension). 
        // Then Call Get(eval: salt) to get the encryption key.

        // A. CREATE CREDENTIAL
        console.log("WebAuthn: Creating Credential...");
        const cred = await navigator.credentials.create({
            publicKey: {
                challenge: challenge,
                rp: { name: this.RP_NAME /* id: this.RP_ID  <-- Often causes errors on localhost/file:// */ },
                user: {
                    id: userId,
                    name: "user@locomotion",
                    displayName: "Diary Owner"
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // Hello / TouchID
                    userVerification: "required",
                    residentKey: "required" // Discoverable credential
                },
                timeout: 60000,
                extensions: { prf: {} } // Request PRF capability
            }
        });

        if (!cred) throw new Error("Credential creation failed.");

        // Save Credential ID
        const credId = this.toBase64URL(cred.rawId);

        // B. GET ENCRYPTION KEY (PRF)
        // We generate a fixed salt for this device.
        const prfSalt = window.crypto.getRandomValues(new Uint8Array(32));

        console.log("WebAuthn: Deriving Encryption Key...");
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: window.crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ type: "public-key", id: cred.rawId }],
                userVerification: "required",
                extensions: {
                    prf: {
                        eval: {
                            first: prfSalt
                        }
                    }
                }
            }
        });

        if (!assertion.getClientExtensionResults().prf || !assertion.getClientExtensionResults().prf.results) {
            throw new Error("Authenticator does not support PRF (Encryption).");
        }

        // Output Key Material
        const prfOutput = new Uint8Array(assertion.getClientExtensionResults().prf.results.first);

        // 3. ENCRYPT MASTER PASSWORD
        // We use the PRF Output as a key to encrypt the Master Password string.
        // We can reuse CryptoHelper for this? 
        // CryptoHelper expects a built Key or Password string.
        // Let's import PRF Output as a raw AES key.
        const encryptionKey = await window.crypto.subtle.importKey(
            "raw",
            prfOutput,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );

        // Encrypt
        const encText = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            encryptionKey,
            encText.encode(masterPassword)
        );

        // 4. STORAGE
        // We store: Credential ID, PRF Salt, IV, Ciphertext
        localStorage.setItem(this.KEY_CRED_ID, credId);
        localStorage.setItem(this.KEY_SALT, this.toBase64URL(prfSalt));

        const blob = {
            iv: this.toBase64URL(iv),
            data: this.toBase64URL(ciphertext)
        };
        localStorage.setItem(this.KEY_BLOB, JSON.stringify(blob));

        return true;
    },

    /**
     * UNLOCK: Retrieve password using biometrics.
     */
    async unlock() {
        if (!this.isEnrolled()) throw new Error("Not enrolled.");

        const credId = this.toBuffer(localStorage.getItem(this.KEY_CRED_ID));
        const prfSalt = this.toBuffer(localStorage.getItem(this.KEY_SALT));
        const blob = JSON.parse(localStorage.getItem(this.KEY_BLOB));

        // 1. Get PRF Key from Authenticator
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: window.crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ type: "public-key", id: credId }],
                userVerification: "required",
                extensions: {
                    prf: {
                        eval: {
                            first: prfSalt
                        }
                    }
                }
            }
        });

        if (!assertion.getClientExtensionResults().prf || !assertion.getClientExtensionResults().prf.results) {
            throw new Error("No PRF result from authenticator.");
        }

        const prfOutput = new Uint8Array(assertion.getClientExtensionResults().prf.results.first);

        // 2. Decrypt Master Password
        const decryptionKey = await window.crypto.subtle.importKey(
            "raw",
            prfOutput,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const iv = this.toBuffer(blob.iv);
        const data = this.toBuffer(blob.data);

        const plaintextBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            decryptionKey,
            data
        );

        const dec = new TextDecoder();
        return dec.decode(plaintextBuffer);
    }
};

window.WebAuthnHelper = WebAuthnHelper;
