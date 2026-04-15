class VideoPopup {
    run() {
        document.addEventListener('DOMContentLoaded', this.onLoad.bind(this), false);
    }

    onLoad() {
        // Initially show empty state, hide content
        document.getElementById('content').style.display = 'none';
        document.getElementById('empty-state').style.display = 'flex';

        // Request status from background
        chrome.runtime.sendMessage({ type: "stat" }, this.onMsg.bind(this));

        // Toggle monitoring
        document.getElementById("chk").addEventListener('change', (e) => {
            chrome.runtime.sendMessage({ type: "cmd", enabled: e.target.checked });
            window.close();
        });

        // Clear button
        document.getElementById('clear').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: "clear" });
            window.close();
        });

        // Format button
        document.getElementById('format').addEventListener('click', () => {
            alert("Play the video in your desired format on the web player first, then XDM will capture it.");
        });
    }

    onMsg(response) {
        if (!response) return;

        // Update status indicator
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');

        if (response.connected) {
            statusDot.className = 'status-indicator connected';
            statusText.textContent = 'Connected to XDM';
        } else {
            statusDot.className = 'status-indicator disconnected';
            statusText.textContent = 'Not connected';
        }

        // Update checkbox
        document.getElementById("chk").checked = response.enabled;

        // Render video list
        if (response.list && response.list.length > 0) {
            document.getElementById('content').style.display = 'block';
            document.getElementById('empty-state').style.display = 'none';
        }

        this.renderList(response.list || []);
    }

    renderList(arr) {
        let table = document.getElementById("table");
        table.innerHTML = '';

        arr.forEach(listItem => {
            let row = table.insertRow(0);
            let cell = row.insertCell(0);

            let div = document.createElement('div');
            div.className = 'video-item';

            let button = document.createElement('button');
            button.className = 'video-btn';
            button.innerText = listItem.text;
            button.id = listItem.id;

            let info = document.createElement('span');
            info.className = 'video-info';
            info.textContent = listItem.info;

            div.appendChild(button);
            div.appendChild(info);
            cell.appendChild(div);

            button.addEventListener('click', (e) => {
                chrome.runtime.sendMessage({ type: "vid", itemId: e.target.id });
            });
        });
    }
}

const popup = new VideoPopup();
popup.run();
