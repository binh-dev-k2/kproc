import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
    killByPid,
    killByPids,
    isProcessAlive,
    InvalidInputError
} from '../dist/index.mjs';

test('killByPid safety guard rejects killing current process by default', async () => {
    await assert.rejects(
        async () => {
            await killByPid(process.pid);
        },
        (err) => err instanceof InvalidInputError
    );
});

test('killByPid safety guard rejects system critical processes', async () => {
    await assert.rejects(
        async () => {
            await killByPid(0);
        },
        (err) => err instanceof InvalidInputError
    );

    // On Windows, PID 4 is System
    if (process.platform === 'win32') {
        await assert.rejects(
            async () => {
                await killByPid(4);
            },
            (err) => err instanceof InvalidInputError
        );
    }
});

test('killByPid dryRun simulates termination without killing process', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        stdio: 'ignore'
    });

    try {
        assert.ok(child.pid);
        assert.equal(await isProcessAlive(child.pid), true);

        const res = await killByPid(child.pid, { dryRun: true });
        assert.equal(res.success, true);
        assert.equal(res.pid, child.pid);

        // Process should still be alive after dryRun
        assert.equal(await isProcessAlive(child.pid), true);
    } finally {
        if (child.pid) {
            try { process.kill(child.pid); } catch { /* ignore */ }
        }
    }
});

test('killByPid terminates live child process with verification', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        stdio: 'ignore'
    });

    assert.ok(child.pid);
    assert.equal(await isProcessAlive(child.pid), true);

    const result = await killByPid(child.pid, { verify: true, tree: true });
    assert.equal(result.success, true);
    assert.equal(result.verified, true);
    assert.equal(result.pid, child.pid);

    assert.equal(await isProcessAlive(child.pid), false);
});

test('killByPids terminates multiple child processes in parallel', async () => {
    const child1 = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    const child2 = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });

    assert.ok(child1.pid && child2.pid);
    assert.equal(await isProcessAlive(child1.pid), true);
    assert.equal(await isProcessAlive(child2.pid), true);

    const results = await killByPids([child1.pid, child2.pid], { verify: true });
    assert.equal(results.length, 2);
    assert.equal(results[0].success, true);
    assert.equal(results[1].success, true);

    assert.equal(await isProcessAlive(child1.pid), false);
    assert.equal(await isProcessAlive(child2.pid), false);
});
