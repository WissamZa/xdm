window.onload = function () {
    document.getElementById("OpenLink").addEventListener('click', function () {
        // Try to open XDM via custom protocol
        window.open("xdm+app://launch");
        window.close();
    });
};
