import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import {
    findPidsByPort,
    killByPort,
    isProcessAlive,
    sleep,
    clearCache
} from '../dist/index.mjs';

// Helper to get a random available port
const getAvailablePort = async () => {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
};

test('killByPort terminates process bound to port and frees socket', async () => {
    clearCache();
    const port = await getAvailablePort();

    // Spawn an isolated child node process that listens on this port
    const script = `
        const http = require('http');
        const server = http.createServer((req, res) => res.end('live'));
        server.listen(${port}, '127.0.0.1', () => {
            console.log('READY');
        });
    `;

    const child = spawn(process.execPath, ['-e', script], {
        stdio: ['ignore', 'pipe', 'ignore']
    });

    try {
        // Wait for child server to print READY
        await new Promise((resolve, reject) => {
            child.stdout.on('data', (data) => {
                if (data.toString().includes('READY')) {
                    resolve(true);
                }
            });
            child.on('error', reject);
            child.on('exit', () => reject(new Error('Child exited early')));
            setTimeout(() => reject(new Error('Timeout waiting for child server')), 5000);
        });

        // Verify child PID is listening on port
        const pids = await findPidsByPort(port);
        assert.ok(pids.includes(child.pid), `Port ${port} should be bound by child PID ${child.pid}`);

        // Terminate via killByPort
        const result = await killByPort(port, { verify: true, tree: true });
        assert.equal(result.success, true);
        assert.equal(result.pid, child.pid);

        // Verify child process is dead
        assert.equal(await isProcessAlive(child.pid), false);

        // Verify port is free
        clearCache();
        const pidsAfter = await findPidsByPort(port);
        assert.equal(pidsAfter.length, 0);
    } finally {
        if (child.pid) {
            try { process.kill(child.pid); } catch { /* ignore */ }
        }
    }
});
