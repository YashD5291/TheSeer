#!/usr/bin/env node

/**
 * The Seer — Native Messaging Host for Resume PDF Generation
 *
 * Chrome Native Messaging protocol:
 *   Input:  4-byte LE length header + JSON payload from stdin
 *   Output: 4-byte LE length header + JSON payload to stdout
 *
 * Expected input:  { responseText: string, chatTitle?: string }
 * Success output:  { success: true, pdfPath, texPath, folderName, folderPath, altPdfPath }
 * Error output:    { success: false, error: string }
 */

import { execFile } from 'node:child_process';
import { writeFile, unlink, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESUME_GEN = join(__dirname, '..', 'resume-gen.mjs');

// Ensure PATH includes homebrew for tectonic
const PATH = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  process.env.PATH,
].join(':');

// Read a Chrome native message from stdin (4-byte LE header + JSON)
function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let headerBuf = null;
    let messageLength = null;
    let totalRead = 0;

    process.stdin.on('readable', function onReadable() {
      while (true) {
        // First, read the 4-byte header
        if (headerBuf === null) {
          const header = process.stdin.read(4);
          if (!header) return;
          headerBuf = header;
          messageLength = header.readUInt32LE(0);
          if (messageLength === 0) {
            process.stdin.removeListener('readable', onReadable);
            resolve({});
            return;
          }
        }

        // Then read the message body
        const remaining = messageLength - totalRead;
        const chunk = process.stdin.read(remaining);
        if (!chunk) return;

        chunks.push(chunk);
        totalRead += chunk.length;

        if (totalRead >= messageLength) {
          process.stdin.removeListener('readable', onReadable);
          try {
            const json = Buffer.concat(chunks).toString('utf-8');
            resolve(JSON.parse(json));
          } catch (e) {
            reject(new Error(`Failed to parse input JSON: ${e.message}`));
          }
          return;
        }
      }
    });

    process.stdin.on('end', () => {
      if (messageLength === null) {
        reject(new Error('No input received'));
      }
    });

    // Timeout after 5 seconds for reading input
    setTimeout(() => reject(new Error('Timeout reading input')), 5000);
  });
}

// Write a Chrome native message to stdout (4-byte LE header + JSON)
function writeMessage(obj) {
  const json = JSON.stringify(obj);
  const buf = Buffer.from(json, 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

// Run resume-gen.mjs with --json flag
function runResumeGen(tempFile, chatTitle) {
  return new Promise((resolve, reject) => {
    const args = [RESUME_GEN, tempFile, '--json'];
    if (chatTitle) {
      args.push('--name', chatTitle);
    }

    execFile('node', args, {
      env: { ...process.env, PATH },
      timeout: 120000, // 2 minutes max
      maxBuffer: 10 * 1024 * 1024, // 10MB
    }, (error, stdout, stderr) => {
      if (error) {
        // Try to parse JSON from stdout even on error (resume-gen emits JSON errors)
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
          return;
        } catch {
          // Fall through to reject
        }
        reject(new Error(stderr || error.message));
        return;
      }

      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`Invalid JSON from resume-gen: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

async function main() {
  let tempFile = null;

  try {
    const input = await readMessage();

    if (!input.responseText) {
      writeMessage({ success: false, error: 'Missing responseText in input' });
      process.exit(0);
    }

    // Write response text to a temp file
    tempFile = join(tmpdir(), `seer-resume-${Date.now()}.md`);
    await writeFile(tempFile, input.responseText, 'utf-8');

    // Run resume-gen.mjs
    const result = await runResumeGen(tempFile, input.chatTitle || null);

    // Read back generated files for dashboard tracking
    if (result.success && result.texPath && result.pdfPath) {
      try {
        const [latexSource, pdfBuffer, pdfStat] = await Promise.all([
          readFile(result.texPath, 'utf-8'),
          readFile(result.pdfPath),
          stat(result.pdfPath),
        ]);
        result.latexSource = latexSource;
        result.pdfBase64 = pdfBuffer.toString('base64');
        result.pdfSizeBytes = pdfStat.size;
      } catch (readErr) {
        // Non-fatal — PDF still generated, just can't send to dashboard
      }
    }

    writeMessage(result);
  } catch (err) {
    writeMessage({ success: false, error: err.message || String(err) });
  } finally {
    // Clean up temp file
    if (tempFile) {
      await unlink(tempFile).catch(() => {});
    }
    process.exit(0);
  }
}

main();
