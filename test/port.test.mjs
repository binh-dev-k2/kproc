import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
    findPidsByPort,
    findPidByPort,
    findPortsByPid,
    ProcessNotFoundError,
    InvalidInputError,
    clearCache
} from '../dist/index.mjs';

test('port lookup workflow with active HTTP server', async () => {
    clearCache();

    // Start ephemeral server on random available port
    const server = http.createServer((_req, res) => {
        res.end('ok');
    });

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(true));
    });

    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const port = address.port;
    assert.ok(port > 0, `Allocated port should be > 0, got ${port}`);

    try {
        // Find PIDs on this port
        const pids = await findPidsByPort(port);
        assert.ok(Array.isArray(pids));
        assert.ok(pids.includes(process.pid), `PIDs on port ${port} should include current process ${process.pid}`);

        // Find primary PID
        const primaryPid = await findPidByPort(port);
        assert.equal(primaryPid, process.pid);

        // Reverse lookup: ports by PID
        const ports = await findPortsByPid(process.pid);
        assert.ok(ports.includes(port), `Process ports should include ${port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
        clearCache();
    }

    // After server is closed, the port should be free
    const pidsAfterClose = await findPidsByPort(port);
    assert.equal(pidsAfterClose.length, 0);

    // findPidByPort on free port should throw ProcessNotFoundError
    await assert.rejects(
        async () => {
            await findPidByPort(port);
        },
        (err) => err instanceof ProcessNotFoundError
    );
});

test('port lookup validation errors', async () => {
    await assert.rejects(
        async () => {
            await findPidsByPort(99999);
        },
        (err) => err instanceof InvalidInputError
    );

    await assert.rejects(
        async () => {
            await findPidsByPort(-1);
        },
        (err) => err instanceof InvalidInputError
    );
});
