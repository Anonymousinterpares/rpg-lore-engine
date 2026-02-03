export class HistoryManager {
    messages = [];
    maxHistory = 20;
    addMessage(role, content) {
        this.messages.push({ role, content });
        if (this.messages.length > this.maxHistory) {
            // In a real implementation, we'd trigger the Scribe here
            // this.messages.shift(); 
        }
    }
    getRecent(n = 10) {
        return this.messages.slice(-n);
    }
    getAll() {
        return [...this.messages];
    }
    clear() {
        this.messages = [];
    }
}
