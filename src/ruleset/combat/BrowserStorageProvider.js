export class BrowserStorageProvider {
    memoryMap = new Map();
    constructor() {
        // Hydrate from LocalStorage if available
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('rpg_save_')) {
                    this.memoryMap.set(key.replace('rpg_save_', ''), localStorage.getItem(key) || '');
                }
            }
        }
        catch (e) {
            console.warn('LocalStorage not available in BrowserStorageProvider');
        }
    }
    exists(path) {
        return this.memoryMap.has(path);
    }
    read(path) {
        const data = this.memoryMap.get(path);
        if (data === undefined)
            throw new Error(`File not found: ${path}`);
        return data;
    }
    write(path, data) {
        this.memoryMap.set(path, data);
        try {
            localStorage.setItem(`rpg_save_${path}`, data);
        }
        catch (e) {
            console.error('Failed to write to LocalStorage:', e);
        }
    }
    mkdir(_path) {
        // No-op for browser memory storage
    }
}
