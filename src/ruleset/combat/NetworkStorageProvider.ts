import { IStorageProvider } from './IStorageProvider';

export class NetworkStorageProvider implements IStorageProvider {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:3001/api') {
        this.baseUrl = baseUrl;
    }

    async exists(path: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/exists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            const data = await response.json();
            return data.exists;
        } catch (e) {
            console.error('NetworkStorageProvider.exists failed:', e);
            return false;
        }
    }

    async read(path: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (!response.ok) throw new Error(`Failed to read ${path}: ${response.statusText}`);
        const data = await response.json();
        return data.content;
    }

    async write(path: string, data: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, data })
        });
        if (!response.ok) throw new Error(`Failed to write ${path}: ${response.statusText}`);
    }

    async mkdir(path: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/mkdir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (!response.ok) throw new Error(`Failed to mkdir ${path}: ${response.statusText}`);
    }
}
