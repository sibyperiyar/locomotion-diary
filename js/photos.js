
/**
 * PhotoManager
 * Handles Local File System Access for Embedded Photos.
 */
const PhotoManager = {
    dirHandle: null,

    // Check if browser supports the API
    isSupported: () => {
        // Supported in all browsers via Fallback
        return true;
    },

    // Trigger the Directory Picker
    selectDirectory: async () => {
        // Mode A: Modern API (Chrome/Edge/Opera)
        if ('showDirectoryPicker' in window) {
            try {
                const handle = await window.showDirectoryPicker({
                    id: 'locomotion_photos',
                    mode: 'read'
                });
                PhotoManager.dirHandle = handle;
                PhotoManager.files = []; // Clear fallback

                // Allow checking permissions later
                const perm = await PhotoManager.verifyPermission(handle);
                if (perm) {
                    alert("Folder Linked! 📸\nWe can now scan this folder for loading photos.");
                }
            } catch (err) {
                console.error("Photo Folder selection cancelled or failed:", err);
            }
        }
        // Mode B: Fallback (Firefox/Safari)
        else {
            const fallbackInput = document.getElementById('photos-fallback-input');
            if (!fallbackInput) {
                alert("Error: Photo input element missing.");
                return;
            }

            // Clean listener to avoid duplicates
            fallbackInput.onchange = (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    PhotoManager.files = Array.from(e.target.files);
                    PhotoManager.dirHandle = null; // Clear modern handle
                    alert(`Folder Linked! 📸\nLoaded ${PhotoManager.files.length} files for scanning.`);
                }
            };

            fallbackInput.click();
        }
    },

    // Verify Read Permission
    verifyPermission: async (handle) => {
        const options = { mode: 'read' };
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    },

    // Scan for photos on a specific date (YYYY-MM-DD)
    // This is a naive implementation: Iterates all files. 
    // In production, we'd index this. For MVP, we scan.
    findPhotosByDate: async (dateStr) => {
        if (!PhotoManager.dirHandle) return [];

        const photos = [];
        // dateStr format: "2024-01-15"
        // We look for files modified or named with this date? 
        // EXIF is hard to read without a library (exif-js).
        // FOR MVP: We rely on file 'lastModified' or Name regex? 
        // File System Access gives individual handles. Reading every file to check EXIF is slow.
        // Option A: Link by Filename (e.g. IMG_20240115_...) -> Fast.
        // Option B: Link by File.lastModified (Date taken often matches this) -> Medium.

        // Let's try matching Filename (Android/iOS standard) AND File Date.
        const cleanDate = dateStr.replace(/-/g, ''); // 20240115

        try {
            for await (const [name, handle] of PhotoManager.dirHandle.entries()) {
                if (handle.kind === 'file') {
                    // Check extension
                    if (!name.match(/\.(jpg|jpeg|png|webp|heic)$/i)) continue;

                    let match = false;

                    // 1. Name Check (e.g. IMG_20240115_...)
                    if (name.includes(cleanDate)) match = true;

                    // 2. Fallback: Check Metadata (Only if name doesn't match? Or always?)
                    // For speed, let's trust name first.

                    if (match) {
                        // Get file to display
                        const file = await handle.getFile();
                        // Create Object URL
                        const url = URL.createObjectURL(file);
                        photos.push({ name, url });
                    }
                }
            }
        } catch (e) {
            console.error("Error scanning photos:", e);
        }
        return photos;
    }
};

window.PhotoManager = PhotoManager;
