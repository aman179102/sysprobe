#!/usr/bin/env node

/**
 * sysprobe - High-Performance Linux Latency & Gateway Benchmarking Tool
 * Author: Aman Kumar (@aman179102)
 * Repository: https://github.com/aman179102/sysprobe
 * License: MIT
 */

const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// ANSI Color Palette (Tokyo Night Inspired)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[38;2;122;162;247m',
  cyan: '\x1b[38;2;125;207;255m',
  green: '\x1b[38;2;158;206;106m',
  yellow: '\x1b[38;2;224;175;104m',
  purple: '\x1b[38;2;187;154;247m',
  magenta: '\x1b[38;2;247;118;142m',
  muted: '\x1b[38;2;86;95;137m',
  bgDark: '\x1b[48;2;26;27;38m',
};

const VERSION = '1.0.0';

function printBanner() {
  console.log(`
${C.purple}  ███████╗██╗   ██╗███████╗██████╗ ██████╗  ██████╗ ██████╗ ███████╗
  ██╔════╝╚██╗ ██╔╝██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██╔════╝
  ███████╗ ╚████╔╝ ███████╗██████╔╝██████╔╝██║   ██║██████╔╝█████╗  
  ╚════██║  ╚██╔╝  ╚════██║██╔═══╝ ██╔══██╗██║   ██║██╔══██╗██╔══╝  
  ███████║   ██║   ███████║██║     ██║  ██║╚██████╔╝██████╔╝███████╗
  ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝${C.reset}
  ${C.cyan}⚡ High-Throughput Latency & Kernel Gateway Benchmarking CLI v${VERSION}${C.reset}
  ${C.muted}Crafted with ❤️ by ${C.bold}Aman Kumar${C.reset}${C.muted} (@aman179102) | ${C.blue}https://aman179102.netlify.app${C.reset}
`);
}

function printHelp() {
  printBanner();
  console.log(`${C.bold}USAGE:${C.reset}
  ${C.green}sysprobe${C.reset} <command> [options]

${C.bold}COMMANDS:${C.reset}
  ${C.cyan}http${C.reset} <url>       Benchmark HTTP/HTTPS endpoint tail latency and throughput
  ${C.cyan}kernel${C.reset}           Inspect host Linux kernel I/O capabilities (io_uring, eBPF, TCP)
  ${C.cyan}version${C.reset}          Print sysprobe version
  ${C.cyan}help${C.reset}             Display this help message

${C.bold}HTTP BENCHMARK OPTIONS:${C.reset}
  ${C.yellow}-c, --concurrency${C.reset} <num>   Number of concurrent requests (default: 10)
  ${C.yellow}-n, --requests${C.reset}    <num>   Total number of requests to dispatch (default: 100)
  ${C.yellow}-m, --method${C.reset}      <verb>  HTTP method: GET, POST, HEAD (default: GET)
  ${C.yellow}-t, --timeout${C.reset}     <ms>    Timeout per request in milliseconds (default: 15000)
  ${C.yellow}-H, --header${C.reset}      <k:v>   Custom header (can be used multiple times)
  ${C.yellow}--json${C.reset}                    Emit clean machine-readable JSON output
  ${C.yellow}--no-banner${C.reset}               Suppress the ASCII art banner

${C.bold}EXAMPLES:${C.reset}
  ${C.dim}# Benchmark an API endpoint with 50 concurrency and 500 total requests${C.reset}
  sysprobe http https://aman179102.netlify.app/ -c 50 -n 500

  ${C.dim}# Inspect Linux kernel network stack and io_uring parameters${C.reset}
  sysprobe kernel

  ${C.dim}# Output structured JSON for CI/CD pipeline assertions${C.reset}
  sysprobe http https://api.github.com -n 50 --json
`);
}

function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

function renderHistogram(latencies) {
  if (latencies.length === 0) return;
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const buckets = 8;
  const range = (max - min) / buckets || 1;
  const counts = new Array(buckets).fill(0);

  for (const lat of latencies) {
    const idx = Math.min(buckets - 1, Math.floor((lat - min) / range));
    counts[idx]++;
  }

  const maxCount = Math.max(...counts, 1);
  const barWidth = 32;

  console.log(`\n${C.bold}${C.purple}📊 Tail Latency Distribution Histogram:${C.reset}`);
  for (let i = 0; i < buckets; i++) {
    const bStart = (min + i * range).toFixed(1).padStart(7);
    const bEnd = (min + (i + 1) * range).toFixed(1).padStart(7);
    const count = counts[i];
    const fillLen = Math.round((count / maxCount) * barWidth);
    const bar = `${C.cyan}${'█'.repeat(fillLen)}${C.dim}${'░'.repeat(barWidth - fillLen)}${C.reset}`;
    console.log(`  [${C.muted}${bStart}ms - ${bEnd}ms${C.reset}] ${bar} ${C.bold}${count.toString().padStart(5)}${C.reset} ${C.dim}(${((count / latencies.length) * 100).toFixed(1)}%)${C.reset}`);
  }
}

async function runHttpBenchmark(rawUrl, options) {
  if (!options.json && !options.noBanner) {
    printBanner();
  }

  if (!rawUrl) {
    console.error(`${C.magenta}✘ Error: Target URL is required.${C.reset} Example: sysprobe http https://example.com`);
    process.exit(1);
  }

  let url = rawUrl;
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  if (!options.json) {
    console.log(`${C.bold}🚀 Probing Endpoint:${C.reset} ${C.blue}${url}${C.reset}`);
    console.log(`   Config: ${C.green}${options.requests}${C.reset} total requests | ${C.green}${options.concurrency}${C.reset} concurrent workers | Method: ${C.yellow}${options.method}${C.reset}\n`);
  }

  const latencies = [];
  const statusCounts = {};
  let errorsCount = 0;
  let totalBytes = 0;
  let dispatched = 0;
  let completed = 0;

  const startTime = performance.now();

  async function worker() {
    while (true) {
      const current = dispatched++;
      if (current >= options.requests) break;

      const reqStart = performance.now();
      try {
        const signal = AbortSignal.timeout(options.timeout);
        const headers = {
          'User-Agent': 'sysprobe/1.0.0 (+https://github.com/aman179102/sysprobe)',
          ...options.headers,
        };

        const res = await fetch(url, {
          method: options.method,
          headers,
          signal,
        });

        const duration = performance.now() - reqStart;
        const text = await res.text();
        totalBytes += Buffer.byteLength(text, 'utf8');

        latencies.push(duration);
        statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
      } catch (err) {
        errorsCount++;
      } finally {
        completed++;
        if (!options.json && process.stdout.isTTY) {
          const pct = Math.round((completed / options.requests) * 100);
          const bar = '■'.repeat(Math.round(pct / 5)) + ' '.repeat(20 - Math.round(pct / 5));
          process.stdout.write(`\r  ${C.blue}[${bar}]${C.reset} ${C.bold}${pct}%${C.reset} (${completed}/${options.requests} completed)`);
        }
      }
    }
  }

  const workers = [];
  const actualConcurrency = Math.min(options.concurrency, options.requests);
  for (let i = 0; i < actualConcurrency; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  const totalDurationMs = performance.now() - startTime;
  const totalDurationSec = totalDurationMs / 1000;

  if (process.stdout.isTTY && !options.json) {
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
  }

  latencies.sort((a, b) => a - b);

  const p50 = calculatePercentile(latencies, 50);
  const p90 = calculatePercentile(latencies, 90);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const p999 = calculatePercentile(latencies, 99.9);
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;

  const sum = latencies.reduce((a, b) => a + b, 0);
  const mean = latencies.length ? sum / latencies.length : 0;
  const variance = latencies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (latencies.length || 1);
  const stddev = Math.sqrt(variance);

  const rps = (completed / (totalDurationSec || 0.001)).toFixed(1);
  const transferRateKb = (totalBytes / 1024 / (totalDurationSec || 0.001)).toFixed(1);

  if (options.json) {
    const result = {
      target: url,
      version: VERSION,
      author: 'Aman Kumar (@aman179102)',
      timestamp: new Date().toISOString(),
      config: {
        total_requests: options.requests,
        concurrency: options.concurrency,
        method: options.method,
      },
      summary: {
        completed,
        errors: errorsCount,
        duration_ms: Math.round(totalDurationMs),
        requests_per_sec: parseFloat(rps),
        transfer_rate_kb_sec: parseFloat(transferRateKb),
      },
      latencies: {
        min_ms: parseFloat(min.toFixed(2)),
        mean_ms: parseFloat(mean.toFixed(2)),
        stddev_ms: parseFloat(stddev.toFixed(2)),
        p50_ms: parseFloat(p50.toFixed(2)),
        p90_ms: parseFloat(p90.toFixed(2)),
        p95_ms: parseFloat(p95.toFixed(2)),
        p99_ms: parseFloat(p99.toFixed(2)),
        p99_9_ms: parseFloat(p999.toFixed(2)),
        max_ms: parseFloat(max.toFixed(2)),
      },
      status_codes: statusCounts,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Terminal Output
  console.log(`${C.bold}${C.green}✔ Benchmark Completed in ${totalDurationSec.toFixed(2)}s${C.reset}\n`);

  console.log(`${C.bold}${C.blue}📈 Throughput & Requests:${C.reset}`);
  console.log(`  Requests Completed:   ${C.bold}${completed}${C.reset} / ${options.requests} (${errorsCount ? C.magenta + errorsCount + ' failed' : C.green + '0 errors'}${C.reset})`);
  console.log(`  Throughput:           ${C.bold}${C.green}${Number(rps).toLocaleString()} req/s${C.reset}`);
  console.log(`  Data Transfer:        ${C.bold}${transferRateKb} KB/s${C.reset} (${(totalBytes / 1024 / 1024).toFixed(2)} MB total)`);

  console.log(`\n${C.bold}${C.cyan}⏱️ Tail Latency Breakdown:${C.reset}`);
  console.log(`  Min Latency:          ${min.toFixed(2)} ms`);
  console.log(`  Mean (Average):       ${mean.toFixed(2)} ms (±${stddev.toFixed(2)} ms)`);
  console.log(`  p50 (Median):         ${C.bold}${p50.toFixed(2)} ms${C.reset}`);
  console.log(`  p90 Latency:          ${p90.toFixed(2)} ms`);
  console.log(`  p95 Latency:          ${p95.toFixed(2)} ms`);
  console.log(`  p99 Latency:          ${C.bold}${C.yellow}${p99.toFixed(2)} ms${C.reset}`);
  console.log(`  p99.9 Tail Latency:   ${C.bold}${C.magenta}${p999.toFixed(2)} ms${C.reset}`);
  console.log(`  Max Latency:          ${max.toFixed(2)} ms`);

  if (Object.keys(statusCounts).length > 0) {
    console.log(`\n${C.bold}${C.yellow}📡 HTTP Status Distribution:${C.reset}`);
    for (const [code, count] of Object.entries(statusCounts)) {
      const color = code.startsWith('2') ? C.green : code.startsWith('3') ? C.cyan : code.startsWith('4') ? C.yellow : C.magenta;
      console.log(`  Status ${color}${code}${C.reset}: ${count} responses (${((count / completed) * 100).toFixed(1)}%)`);
    }
  }

  if (latencies.length > 0) {
    renderHistogram(latencies);
  }

  console.log(`\n${C.muted}────────────────────────────────────────────────────────────${C.reset}`);
  console.log(`${C.dim}Need Linux kernel & gateway optimization insights? Read the research paper:${C.reset}`);
  console.log(`${C.blue}https://doi.org/10.5281/zenodo.24493466${C.reset} by ${C.bold}Aman Kumar${C.reset} (@aman179102)\n`);
}

function runKernelInspection() {
  printBanner();
  console.log(`${C.bold}${C.cyan}🐧 Host Linux Kernel & Architecture Inspection:${C.reset}\n`);

  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();
  const cpus = os.cpus();

  console.log(`  Operating System:     ${C.bold}${platform} (${release})${C.reset}`);
  console.log(`  Architecture:         ${C.bold}${arch}${C.reset}`);
  console.log(`  CPU Model:            ${C.bold}${cpus[0]?.model || 'Generic'}${C.reset} (${cpus.length} vCPUs)`);
  console.log(`  Total Memory:         ${C.bold}${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB${C.reset}`);

  if (platform !== 'linux') {
    console.log(`\n${C.yellow}ℹ Note: Full kernel parameter extraction is only supported on Linux.${C.reset}\n`);
    return;
  }

  console.log(`\n${C.bold}${C.purple}⚡ Advanced Kernel I/O Parameters:${C.reset}`);

  function readSysctl(key, fallback = 'N/A') {
    try {
      return execSync(`sysctl -n ${key} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    } catch {
      return fallback;
    }
  }

  let ioUringSupported = false;
  try {
    ioUringSupported = fs.existsSync('/usr/include/linux/io_uring.h') || parseFloat(release) >= 5.1;
  } catch {}

  console.log(`  io_uring Availability:       ${ioUringSupported ? C.green + '✔ Supported (Linux Kernel 5.1+)' : C.magenta + '✘ Not Available'}${C.reset}`);
  console.log(`  TCP Congestion Control:      ${C.bold}${readSysctl('net.ipv4.tcp_congestion_control', 'cubic')}${C.reset}`);
  console.log(`  eBPF JIT Compiler:           ${readSysctl('net.core.bpf_jit_enable') === '1' ? C.green + '✔ Enabled' : C.dim + 'Default'}${C.reset}`);
  console.log(`  Max Epoll User Watches:      ${C.bold}${Number(readSysctl('fs.epoll.max_user_watches', 'N/A')).toLocaleString()}${C.reset}`);
  console.log(`  Max Open File Descriptors:   ${C.bold}${Number(readSysctl('fs.file-max', 'N/A')).toLocaleString()}${C.reset}`);
  console.log(`  TCP Somaxconn (Queue):       ${C.bold}${readSysctl('net.core.somaxconn', '4096')}${C.reset}`);

  console.log(`\n${C.muted}────────────────────────────────────────────────────────────${C.reset}`);
  console.log(`${C.dim}For deterministic tail-latency gateway designs using io_uring:${C.reset}`);
  console.log(`${C.blue}https://github.com/aman179102/awesome-iouring${C.reset}\n`);
}

function parseArgs(args) {
  const options = {
    command: args[0] || 'help',
    target: '',
    concurrency: 10,
    requests: 100,
    method: 'GET',
    timeout: 15000,
    headers: {},
    json: false,
    noBanner: false,
  };

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '-c' || arg === '--concurrency') {
      options.concurrency = parseInt(args[++i], 10) || 10;
    } else if (arg === '-n' || arg === '--requests') {
      options.requests = parseInt(args[++i], 10) || 100;
    } else if (arg === '-m' || arg === '--method') {
      options.method = (args[++i] || 'GET').toUpperCase();
    } else if (arg === '-t' || arg === '--timeout') {
      options.timeout = parseInt(args[++i], 10) || 15000;
    } else if (arg === '-H' || arg === '--header') {
      const header = args[++i] || '';
      const [k, v] = header.split(':');
      if (k && v) options.headers[k.trim()] = v.trim();
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--no-banner') {
      options.noBanner = true;
    } else if (!arg.startsWith('-') && !options.target) {
      options.target = arg;
    }
    i++;
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    printHelp();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version') || args[0] === 'version') {
    console.log(`sysprobe version ${VERSION} by Aman Kumar (@aman179102)`);
    process.exit(0);
  }

  const options = parseArgs(args);

  switch (options.command) {
    case 'http':
      await runHttpBenchmark(options.target, options);
      break;
    case 'kernel':
      runKernelInspection();
      break;
    default:
      console.error(`${C.magenta}Unknown command: "${options.command}"${C.reset}\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\x1b[31mFatal error:\x1b[0m ${err.message}`);
  process.exit(1);
});
