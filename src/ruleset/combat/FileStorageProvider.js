import * as fs from 'fs';
import * as path from 'path';
export class FileStorageProvider {
    exists(filePath) {
        return fs.existsSync(filePath);
    }
    read(filePath) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    write(filePath, data) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, data, 'utf-8');
    }
    mkdir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}
