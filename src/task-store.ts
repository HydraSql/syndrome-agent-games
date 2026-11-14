import {createHash, randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat, mkdir, open, realpath, rename, unlink} from 'node:fs/promises';
import {join, resolve} from 'node:path';

export interface StoredResponse {
  statusCode: number;
  headers: Record<string, string>;
  /** Exact response text; signature headers can be retained without re-encoding. */
  body: string;
}
interface TaskRecord {
  version: 1;
  taskId: string;
  bodyHash: string;
  state: 'pending' | 'completed';
  response?: StoredResponse;
}
const locks = new Map<string, Promise<void>>();
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function validResponse(value: unknown): value is StoredResponse {
  if (!value || typeof value !== 'object') return false;
  const r = value as StoredResponse;
  return Number.isInteger(r.statusCode) && r.statusCode >= 100 && r.statusCode <= 599 &&
    typeof r.body === 'string' && !!r.headers && typeof r.headers === 'object' &&
    !Array.isArray(r.headers) && Object.values(r.headers).every(v => typeof v === 'string');
}

/** Single-process coordination (including multiple instances). Do not share a directory
 * between processes. Pending records are never automatically replayed: a crash may
 * have occurred after an external side effect but before persisting its response. */
export class TaskStore {
  constructor(readonly directory: string) {}

  private async location(taskId: string): Promise<string> {
    if (typeof taskId !== 'string' || !taskId.length || Buffer.byteLength(taskId) > 1024) throw Error('INVALID_TASK_ID');
    const directory = resolve(this.directory);
    await mkdir(directory, {recursive: true, mode: 0o700});
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && info.uid !== process.getuid())) throw Error('TASK_DIRECTORY_NOT_PRIVATE');
    return join(await realpath(directory), `${hash(taskId)}.json`);
  }

  private async locked<T>(path: string, operation: () => Promise<T>): Promise<T> {
    const previous = locks.get(path) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(r => {release = r;});
    locks.set(path, current);
    await previous;
    try {return await operation();}
    finally {release(); if (locks.get(path) === current) locks.delete(path);}
  }

  private async read(path: string): Promise<TaskRecord | undefined> {
    let file;
    try {file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);}
    catch (error) {if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error;}
    try {
      const record = JSON.parse(await file.readFile('utf8')) as TaskRecord;
      if (!record || record.version !== 1 || typeof record.taskId !== 'string' ||
        typeof record.bodyHash !== 'string' || !/^[a-f0-9]{64}$/.test(record.bodyHash) ||
        !['pending', 'completed'].includes(record.state) ||
        (record.state === 'completed' ? !validResponse(record.response) : record.response !== undefined)) throw Error('INVALID_RECORD');
      return record;
    } catch {throw Error('TASK_STORE_CORRUPT');}
    finally {await file.close();}
  }

  private async write(path: string, record: TaskRecord): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, 'wx', 0o600);
      try {await file.writeFile(JSON.stringify(record)); await file.sync();}
      finally {await file.close();}
      await rename(temporary, path);
      const directory = await open(resolve(path, '..'), 'r');
      try {await directory.sync();} finally {await directory.close();}
    } finally {await unlink(temporary).catch(error => {if (error.code !== 'ENOENT') throw error;});}
  }

  private check(record: TaskRecord, taskId: string, bodyHash: string): void {
    if (record.taskId !== taskId || record.bodyHash !== bodyHash) throw Error('TASK_BODY_CONFLICT');
  }

  /** Supply an independently reconciled response after an interrupted execution.
   * Completed records are immutable; recovery cannot overwrite their response. */
  async recover(taskId: string, rawBody: Buffer, response: StoredResponse): Promise<StoredResponse> {
    if (!Buffer.isBuffer(rawBody)) throw Error('RAW_BODY_REQUIRED');
    if (!validResponse(response)) throw Error('INVALID_TASK_RESPONSE');
    const bodyHash = hash(rawBody);
    const snapshot = JSON.parse(JSON.stringify(response)) as StoredResponse;
    const path = await this.location(taskId);
    return this.locked(path, async () => {
      const record = await this.read(path);
      if (!record) throw Error('TASK_NOT_FOUND');
      this.check(record, taskId, bodyHash);
      if (record.state === 'completed') return record.response!;
      await this.write(path, {...record, state: 'completed', response: snapshot});
      return snapshot;
    });
  }

  async run(taskId: string, rawBody: Buffer, execute: () => Promise<StoredResponse>): Promise<StoredResponse> {
    if (!Buffer.isBuffer(rawBody)) throw Error('RAW_BODY_REQUIRED');
    const bodyHash = hash(rawBody);
    const path = await this.location(taskId);
    return this.locked(path, async () => {
      const existing = await this.read(path);
      if (existing) {
        this.check(existing, taskId, bodyHash);
        if (existing.state === 'completed') return existing.response!;
        throw Error('TASK_PENDING_RECONCILIATION_REQUIRED');
      }
      const record: TaskRecord = {version: 1, taskId, bodyHash, state: 'pending'};
      await this.write(path, record);
      const response = await execute();
      if (!validResponse(response)) throw Error('INVALID_TASK_RESPONSE');
      // Snapshot before the first await so caller mutation cannot change stored bytes.
      const snapshot = JSON.parse(JSON.stringify(response)) as StoredResponse;
      await this.write(path, {...record, state: 'completed', response: snapshot});
      return snapshot;
    });
  }
}
