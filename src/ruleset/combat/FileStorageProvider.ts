import * as fs from 'fs';
import * as path from 'path';
import { IStorageProvider } from './IStorageProvider';

export class FileStorageProvider implements IStorageProvider {
    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async read(filePath: string): Promise<string> {
        return await fs.promises.readFile(filePath, 'utf-8');
    }

    async write(filePath: string, data: string): Promise<void> {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
        }
        await fs.promises.writeFile(filePath, data, 'utf-8');
    }

    async mkdir(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }
}
