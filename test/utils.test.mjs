import test from 'node:test';
import assert from 'node:assert/strict';
import { isProcessAlive, sleep, parsePortFromAddress } from '../dist/index.mjs';

test('isProcessAlive should return true for current running process', async () => {
    const alive = await isProcessAlive(process.pid);
    assert.equal(alive, true);
});

test('isProcessAlive should return false for non-existent PID', async () => {
    // 9999999 is almost certainly not running
    const alive = await isProcessAlive(9999999);
    assert.equal(alive, false);
});

test('isProcessAlive should return false for invalid PID', async () => {
    assert.equal(await isProcessAlive(-1), false);
    assert.equal(await isProcessAlive(0), false);
    assert.equal(await isProcessAlive(NaN), false);
});

test('sleep should delay execution', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `Elapsed time ${elapsed}ms should be at least 40ms`);
});

test('parsePortFromAddress should parse IPv4 addresses', () => {
    assert.equal(parsePortFromAddress('127.0.0.1:3000'), 3000);
    assert.equal(parsePortFromAddress('0.0.0.0:8080'), 8080);
    assert.equal(parsePortFromAddress('192.168.1.100:443'), 443);
});

test('parsePortFromAddress should parse IPv6 addresses', () => {
    assert.equal(parsePortFromAddress('[::1]:3000'), 3000);
    assert.equal(parsePortFromAddress('[::]:8080'), 8080);
    assert.equal(parsePortFromAddress('[2001:db8::1]:80'), 80);
});

test('parsePortFromAddress should reject invalid ports', () => {
    assert.equal(parsePortFromAddress('invalid'), null);
    assert.equal(parsePortFromAddress('127.0.0.1:70000'), null);
    assert.equal(parsePortFromAddress('127.0.0.1:0'), null);
});
