import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from './config.js';
import { fail } from '../validation.js';

export class PythonWorker {
  constructor(root, python, weights) {
    this.root = root;
    this.python = python;
    this.weights = weights;
    this.child = null;
    this.pending = null;
    this.readyPromise = null;
    this.closing = false;
  }
  available() {
    return (
      existsSync(this.python) &&
      existsSync(this.weights) &&
      existsSync(this.weights.replace(/\.pt$/, '.source.json'))
    );
  }
  async start() {
    if (this.child) {
      return this.readyPromise;
    }
    if (!existsSync(this.python)) {
      fail('O ambiente de análise local não está configurado. Consulte o guia de instalação.', 503);
    }
    this.closing = false;
    const child = spawn(
      this.python,
      ['-X', 'utf8', '-u', join(projectRoot, 'experiments/corrosion/worker.py')],
      {
        cwd: projectRoot,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CORROSION_DATA_DIR: this.root,
          CORROSION_WEIGHTS: this.weights,
          PYTHONNOUSERSITE: '1',
        },
      },
    );
    this.child = child;
    let buffer = '';
    this.readyPromise = new Promise((resolveReady, rejectReady) => {
      const timeout = setTimeout(() => {
        rejectReady(new Error('O processo de análise não iniciou a tempo.'));
        this.stop();
      }, 60000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        buffer += chunk;
        if (buffer.length > 1024 * 1024) {
          this.stop();
          return;
        }
        let end;
        while ((end = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          try {
            const message = JSON.parse(line);
            if (message.event === 'ready') {
              clearTimeout(timeout);
              resolveReady();
            } else if (this.pending && message.id === this.pending.id) {
              const pending = this.pending;
              this.pending = null;
              clearTimeout(pending.timer);
              message.error
                ? pending.reject(new Error(message.error))
                : pending.resolve(message.result);
            }
          } catch {
            this.stop();
          }
        }
      });
      child.stderr.on('data', (chunk) =>
        console.error('[Análise visual]', String(chunk).slice(0, 2000)),
      );
      const stopped = (error) => {
        clearTimeout(timeout);
        const reason =
          error || new Error('O processo de análise foi interrompido. Tente novamente.');
        rejectReady(reason);
        if (this.child === child) {
          this.child = null;
          this.readyPromise = null;
          if (this.pending) {
            clearTimeout(this.pending.timer);
            this.pending.reject(reason);
            this.pending = null;
          }
        }
      };
      child.on('error', stopped);
      child.on('exit', () => stopped());
      child.stdin.on('error', () => {});
    });
    return this.readyPromise;
  }
  async run(job) {
    await this.start();
    return new Promise((resolveResult, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('A análise demorou além do limite. Tente novamente com imagens menores.'));
        this.stop();
      }, 120000);
      this.pending = {
        id: job.id,
        resolve: resolveResult,
        reject,
        timer,
      };
      this.child.stdin.write(JSON.stringify(job) + '\n', (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending = null;
          reject(error);
        }
      });
    });
  }
  stop() {
    const child = this.child;
    this.child = null;
    this.readyPromise = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('O processo de análise foi interrompido. Tente novamente.'));
      this.pending = null;
    }
    if (child) {
      child.kill();
    }
  }
}
