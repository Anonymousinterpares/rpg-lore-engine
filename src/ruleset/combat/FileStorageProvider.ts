import * as fs from 'fs';
import * as path from 'path';
import { IStorageProvider } from './IStorageProvider';

export class FileStorageProvider implements IStorageProvider {
    exists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    read(filePath: string): string {
        return fs.readFileSync(filePath, 'utf-8');
    }

    write(filePath: string, data: string): void {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, data, 'utf-8');
    }

    mkdir(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}
