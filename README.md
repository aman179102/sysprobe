# sysprobe

> High-throughput HTTP tail-latency and Linux kernel networking diagnostic CLI.

Developed by **Aman Kumar** ([@aman179102](https://github.com/aman179102)) | [Portfolio](https://aman179102.netlify.app/) | [Zenodo Paper](https://doi.org/10.5281/zenodo.24493466)

---

## Capabilities

- **Tail-Latency Profiling**: Measure p50, p90, p95, p99, and p99.9 latency distributions with real-time ASCII histogram visualizations.
- **Kernel I/O Probing**: Inspect Linux kernel subsystem configurations including `io_uring` support, eBPF JIT compilation status, epoll watch capacity, TCP socket queues, and congestion algorithms.
- **CI/CD Integration**: Supports `--json` mode for automated regression checks and pipeline assertion workflows.
- **Zero Heavy Dependencies**: Runs directly on modern Node.js runtimes without external runtime dependencies.

---

## Quick Start

### Direct Execution via NPX
```bash
npx sysprobe-cli http https://example.com -c 10 -n 100
```

### Global Installation
```bash
npm install -g sysprobe-cli
```

### Universal One-Line Installer
```bash
curl -fsSL https://aman179102.netlify.app/install.sh | bash
```

---

## CLI Usage

```text
sysprobe <command> [options]
```

### Commands

| Command | Purpose |
|---|---|
| `http <url>` | Execute concurrency benchmarks and measure latency percentiles |
| `kernel` | Query Linux socket limits and async I/O parameters |
| `version` | Display version information |
| `help` | Show complete command references |

### Options for `http`

- `-c, --concurrency <number>`: Number of concurrent worker streams (Default: 10).
- `-n, --requests <number>`: Total HTTP requests dispatched (Default: 100).
- `-m, --method <verb>`: HTTP method, e.g., GET, POST, HEAD (Default: GET).
- `-t, --timeout <ms>`: Milliseconds allowed per request before abort (Default: 15000).
- `-H, --header <k:v>`: Additional custom HTTP request header.
- `--json`: Output raw JSON metric data.
- `--no-banner`: Hide header banner text.

---

## Examples

#### Benchmarking an HTTP service
```bash
sysprobe http https://aman179102.netlify.app/ -c 20 -n 200
```

#### Diagnostic inspection of Linux host kernel
```bash
sysprobe kernel
```

#### JSON metric piping for CI assertions
```bash
sysprobe http https://api.github.com -n 20 --json | jq '.latencies.p99_ms'
```

---

## Author & Research

Created and maintained by **Aman Kumar**:
- Systems Research: [Academia.edu](https://independentresearcher.academia.edu/aman179102) & [Zenodo](https://doi.org/10.5281/zenodo.24493466)
- Systems List: [awesome-iouring](https://github.com/aman179102/awesome-iouring)
- GitHub Profile: [@aman179102](https://github.com/aman179102)

License: MIT
