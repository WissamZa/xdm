document.addEventListener('DOMContentLoaded', function () {
    // Auto-trigger the registration link after a short delay
    window.setTimeout(() => {
        const link = document.getElementById("link");
        if (link) {
            link.href = "xdm-app:chrome-extension://" + chrome.runtime.id + "/";
            link.click();
        }
    }, 1000);
}, false);
