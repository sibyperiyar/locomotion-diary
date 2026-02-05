/**
 * Security Monitor
 * Handles Auto-Lock (Idle Timer) and Stealth Mode (Panic Button).
 */
const SecurityMonitor = {
    IDLE_TIMEOUT_MS: 10 * 60 * 1000, // 10 Minutes
    idleTimer: null,

    // Stealth State
    escCount: 0,
    escTimer: null,

    init() {
        this.resetTimer();

        // Activity Listeners (Debounced)
        const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
        events.forEach(evt => {
            window.addEventListener(evt, () => this.resetTimer(), { passive: true });
        });

        // Stealth Listener (Interceptor)
        window.addEventListener('keydown', (e) => this.handleKey(e));

        console.log("🛡️ Security Monitor: Active (Auto-Lock: 10m)");
    },

    resetTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.onIdleTimeout(), this.IDLE_TIMEOUT_MS);
    },

    onIdleTimeout() {
        console.log("SecurityMonitor: IDLE DETECTED. Locking App.");
        if (window.BinderManager && !window.BinderManager.isLocked) {
            window.BinderManager.lock();
        } else {
            // Fallback if BinderManager not ready or already locked
            if (!document.getElementById('app-lock-screen') || document.getElementById('app-lock-screen').style.display === 'none') {
                window.location.reload();
            }
        }
    },

    handleKey(e) {
        if (e.key === 'Escape') {
            this.escCount++;

            // Clear previous reset timer
            if (this.escTimer) clearTimeout(this.escTimer);

            // Reset count if gap between presses is too long (>400ms)
            this.escTimer = setTimeout(() => {
                this.escCount = 0;
            }, 400);

            if (this.escCount >= 3) {
                this.triggerStealth();
            }
        }
    },

    triggerStealth() {
        console.log("🛑 PANIC BUTTON TRIGGERED (Stealth Mode)");
        this.escCount = 0;

        // 1. Immediate Memory Wipe (Best Effort)
        if (window.BinderManager) {
            window.BinderManager.sessionKey = null;
            window.BinderManager.data = null;
            window.BinderManager.encryptedData = null;
        }
        if (window.DiaryStore) {
            window.DiaryStore.sessionKey = null;
        }

        // 2. Replace UI with "Boring" Content (Fake Error)
        document.body.innerHTML = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; text-align: center; color: #333; background: white; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <h1 style="font-size: 24px; margin-bottom: 10px;">502 Bad Gateway</h1>
                <hr style="width: 300px; border: 0; border-top: 1px solid #ccc; margin: 20px 0;">
                <p style="font-size: 14px; color: #666;">nginx/1.18.0 (Ubuntu)</p>
            </div>
        `;
        document.title = "502 Bad Gateway";
        document.body.style.background = "white";

        // 3. Stop all scripts/timers (Implicit by DOM destruction mostly, but reload seals it)
        // We delay the reload slightly to let the illusion sink in, 
        // OR we just stay on this screen forever until user manually refreshes.
        // Hitting refresh manually will reload the app (which prompts for password).
        // This is safe.
    }
};

// Expose and Auto-Start
window.SecurityMonitor = SecurityMonitor;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SecurityMonitor.init());
} else {
    SecurityMonitor.init();
}
