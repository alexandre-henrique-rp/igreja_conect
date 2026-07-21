declare module "clamdjs" {
  /**
   * clamdjs é distribuído como CommonJS. Importar com `import clamdjs from "clamdjs"`
   * (default import) e acessar `clamdjs.createScanner(host, port)`.
   *
   * API real (verificada via `Object.keys(require("clamdjs"))`):
   * - `createScanner(host, port)` → retorna `Scanner`
   * - `ping(host, port)` → PING no daemon
   * - `version(host, port)` → versão do ClamAV
   * - `isCleanReply(reply)` → helper pra validar respostas
   */
  export interface ScanResult {
    good: boolean;
    reason?: string;
  }

  export interface Scanner {
    scanBuffer(buffer: Buffer, chunkSize?: number): Promise<ScanResult>;
    scanFile(path: string, chunkSize?: number): Promise<ScanResult>;
    version(): Promise<string>;
  }

  const clamdjs: {
    createScanner(host: string, port: number): Scanner;
    ping(host: string, port: number): Promise<boolean>;
    version(host: string, port: number): Promise<string>;
    isCleanReply(reply: string): boolean;
  };
  export default clamdjs;
}
