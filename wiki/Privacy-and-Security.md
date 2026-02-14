# Privacy and Security 🔒

## Zero-Knowledge Architecture

Locomotion Diary is built on a **Zero-Knowledge Architecture**. This means that **we (the developers) cannot access your data**.

* **Offline Storage:** Your data lives entirely within your browser's local storage (IndexedDB). It is never sent to our servers.
* **Encryption:** Both your Diary Events and Legacy Binder are encrypted using **AES-GCM-256** with your Master Password.
* **No Cloud Sync:** There is no cloud account or login. You are in full control.

> **⚠️ CRITICAL WARNING:** If you lose your Master Password, your data is **lost forever**. We cannot recover it for you because we do not have your keys.

## Features

### 1. App Lock Screen

You can secure your diary from prying eyes on a shared device:

* **Auto-Lock:** The app locks automatically when you close the tab.
* **Manual Lock:** Click the **🔒 Lock App** button in the Binder Security sidebar.

### 2. Biometric Unlock (Windows Hello / TouchID) 👆

Enjoy password-free access while keeping your data encrypted.

* **How it works:** We use your device's secure hardware (TPM) to safely store your encryption key.
* **Setup:** Go to **Binder > Security** and click "Enroll Biometrics".
* **Requirements:** A device with Windows Hello/TouchID and the app served over HTTPS (or localhost).

### 3. Emergency Access Kit 🚑

Since there is no "Forgot Password" feature, you **MUST** create a backup plan.

1. Go to **Binder > Security**.
2. Click **🚑 Emergency Kit**.
3. This downloads a special HTML file containing your **Master Password** and a full **Encrypted Backup**.
4. **Action:** Print this out or save it to a physical USB drive. Keep it safe!
