"use strict";
export default class Logger {
    constructor() {
        this.loggingEnabled = true;
    }

    log(content) {
        if (this.loggingEnabled) {
            console.log("[XDM]", content);
        }
    }

    error(content) {
        if (this.loggingEnabled) {
            console.error("[XDM Error]", content);
        }
    }

    warn(content) {
        if (this.loggingEnabled) {
            console.warn("[XDM Warning]", content);
        }
    }
}
