export interface AgentMessage {
    role: 'system' | 'narrator' | 'player' | 'director' | 'scribe';
    content: string;
    turns_ago?: number;
}

export class HistoryManager {
    private messages: AgentMessage[] = [];
    private maxHistory: number = 20;
    private compactedSummary: string = '';
    private readonly maxCompactedLength: number = 2000;
    private readonly maxMessageContentLength: number = 600;

    public addMessage(role: AgentMessage['role'], content: string) {
        // Cap individual message content to prevent single large narrator responses from bloating the buffer
        const trimmedContent = content.length > this.maxMessageContentLength
            ? content.substring(0, this.maxMessageContentLength) + '...'
            : content;

        this.messages.push({ role, content: trimmedContent });

        if (this.messages.length > this.maxHistory) {
            this.compactOldest();
        }
    }

    /**
     * Compacts the oldest messages into a rolling summary string instead of discarding them.
     * Preserves key facts in compressed form.
     */
    private compactOldest(): void {
        const toCompact: AgentMessage[] = [];
        while (this.messages.length > this.maxHistory) {
            toCompact.push(this.messages.shift()!);
        }

        if (toCompact.length === 0) return;

        // Mechanical compaction: extract first ~120 chars of each message as a brief
        const briefs = toCompact.map(m => {
            const brief = m.content.substring(0, 120).replace(/\n/g, ' ').trim();
            return `[${m.role}] ${brief}`;
        });

        const newFragment = briefs.join(' | ');
        this.compactedSummary = this.compactedSummary
            ? `${this.compactedSummary} | ${newFragment}`
            : newFragment;

        // Cap total compacted length, trimming from the oldest (front)
        if (this.compactedSummary.length > this.maxCompactedLength) {
            this.compactedSummary = this.compactedSummary.substring(
                this.compactedSummary.length - this.maxCompactedLength
            );
        }
    }

    /**
     * Returns the compacted summary of messages that have aged out of the active buffer.
     */
    public getCompactedSummary(): string {
        return this.compactedSummary;
    }

    public getRecent(n: number = 10): AgentMessage[] {
        return this.messages.slice(-n);
    }

    public getAll(): AgentMessage[] {
        return [...this.messages];
    }

    public clear() {
        this.messages = [];
        this.compactedSummary = '';
    }
}
