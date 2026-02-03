export interface IStorageProvider {
    exists(path: string): boolean | Promise<boolean>;
    read(path: string): string | Promise<string>;
    write(path: string, data: string): void | Promise<void>;
    mkdir(path: string): void | Promise<void>;
}
