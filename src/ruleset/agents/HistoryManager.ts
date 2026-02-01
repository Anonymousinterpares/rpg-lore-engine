export interface AgentMessage {
    role: 'system' | 'narrator' | 'player' | 'director' | 'scribe';
    content: string;
    turns_ago?: number;
}

export class HistoryManager {
    private messages: AgentMessage[] = [];
    private maxHistory: number = 20;

    public addMessage(role: AgentMessage['role'], content: string) {
        this.messages.push({ role, content });
        if (this.messages.length > this.maxHistory) {
            // In a real implementation, we'd trigger the Scribe here
            // this.messages.shift(); 
        }
    }

    public getRecent(n: number = 10): AgentMessage[] {
        return this.messages.slice(-n);
    }

    public getAll(): AgentMessage[] {
        return [...this.messages];
    }

    public clear() {
        this.messages = [];
    }
}
