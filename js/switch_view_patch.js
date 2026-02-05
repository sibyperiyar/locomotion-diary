
// --- Navigation Logic (Re-implemented for Safety) ---
window.switchView = function (viewId) {
    console.log(`Switching to view: ${viewId}`);

    // 1. Hide all sections
    document.querySelectorAll('section').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none'; // Force hide
    });

    // 2. Show target
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.add('active');
        target.style.display = 'flex'; // Force show
        window.scrollTo(0, 0); // Reset scroll
    } else {
        console.error(`View not found: view-${viewId}`);
    }
};
