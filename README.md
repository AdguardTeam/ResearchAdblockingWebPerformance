# Research Ad Blocking Web Performance

This research aims to study the impact of ad blocking on websites' performance.

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [Building the Docker Image](#building-the-docker-image)
  - [Running Benchmarks](#running-benchmarks)
    - [Baseline Benchmark](#baseline-benchmark)
    - [Extension-Based Ad Blocking Benchmark](#extension-based-ad-blocking-benchmark)
    - [DNS-Based Ad Blocking Benchmark](#dns-based-ad-blocking-benchmark)
  - [Generating Reports](#generating-reports)
  - [CLI Usage](#cli-usage)
    - [Options](#options)
    - [Commands](#commands)
    - [Examples](#examples)
- [Scripts and Commands](#scripts-and-commands)
- [License](#license)

## Introduction

This project aims to quantify the impact of ad blocking on web performance by collecting metrics such as load times, bytes transferred, and number of requests under various conditions:

1. **Without ad blocking (baseline)**
2. **Using DNS-based ad blocking**
3. **Using browser extension-based ad blocking**

The project utilizes Puppeteer to automate browser interactions and collect performance data. It generates reports to visualize and compare the results, helping to understand how ad blocking affects website performance.

For benchmark testing, we use a list of top 100 U.S. news publishers obtained from [NewzDash](https://www.newzdash.com/about/all-news-publishers-tracked/U.S./),. We have also combined this list with data from FeedSpot's top news sites to create a more comprehensive `combined_unique_news_domains.txt` file containing 173 unique news domains for more thorough statistics collection.

## Prerequisites

Ensure you have the following installed on your system:

- **[Docker Desktop](https://www.docker.com/products/docker-desktop)**
- **[Bun](https://bun.sh/)** (JavaScript runtime and package manager)

## Installation

### Clone the Repository:

```bash
git clone https://github.com/maximtop/research-ad-blocking-web-performance.git
```

### Install Dependencies:

The project uses **Bun** as the JavaScript runtime and package manager.

```bash
bun install
```

## Usage

### Building the Docker Image

To run the benchmarks in a consistent environment, build the Docker image using the provided `Dockerfile`.

```bash
bun run docker-build
```

This command builds the Docker image and tags it as `maximtop/adblock-research:latest`.

### Running Benchmarks

The benchmarks are run inside Docker containers to ensure consistency. Metrics will be collected and stored in the `dist/metrics` directory.

#### Baseline Benchmark

Runs the benchmark without any ad blocking (control test).

```bash
docker run --rm \
  -v $(pwd)/dist:/app/dist \
  maximtop/adblock-research:latest \
  /bin/bash -c \
  "bun src/cli.ts -e baseline -f src/domains/top_100_newzdash_march_2025.txt"
```

**Explanation:**

- **`-v $(pwd)/dist:/app/dist`**: Mounts the local `dist/metrics` directory into the Docker container, so the metrics are saved outside the container.
- **`bun src/cli.ts -e baseline -f src/domains/top_100_newzdash_march_2025.txt`**: Runs the benchmark script inside the container for the baseline scenario.

#### Extension-Based Ad Blocking Benchmark

Runs the benchmark using a browser extension for ad blocking.

```bash
docker run --rm \
  -v $(pwd)/dist:/app/dist \
  maximtop/adblock-research:latest \
  /bin/bash -c \
  "bun src/cli.ts -e extension -x -f src/domains/top_100_newzdash_march_2025.txt"
```

**Explanation:**

- **`-x`**: Enables the ad blocker extension in the benchmark script.
- **`-e extension`**: Specifies the environment to include the extension.

#### DNS-Based Ad Blocking Benchmark

Runs the benchmark using DNS-based ad blocking with AdGuard DNS.

```bash
ADGUARD_DNS_DOH_URL="https://dns.adguard.com/dns-query" \
docker run --rm \
  --dns=127.0.0.1 \
  -v $(pwd)/dist:/app/dist \
  maximtop/adblock-research:latest \
  /bin/bash -c \
  "dnsproxy -u $ADGUARD_DNS_DOH_URL -b 8.8.8.8 & sleep 5 \
    && bun src/cli.ts -e dns -f src/domains/top_100_newzdash_march_2025.txt"
```

**Explanation:**

- **`ADGUARD_DNS_DOH_URL`**: Environment variable pointing to the AdGuard DNS-over-HTTPS endpoint.
- **`--dns=127.0.0.1`**: Directs Docker to use the local DNS server running inside the container.
- **`dnsproxy -u $ADGUARD_DNS_DOH_URL -b 8.8.8.8`**: Starts `dnsproxy` inside the container, forwarding DNS queries to AdGuard DNS.
- **`sleep 5`**: Waits a few seconds to ensure `dnsproxy` is running before starting the benchmark.
- **`bun src/cli.ts -e dns -f src/domains/top_100_newzdash_march_2025.txt`**: Runs the benchmark script with DNS-based ad blocking.

**Note:**

- The `dnsproxy` tool must be installed inside the Docker image. Ensure your `Dockerfile` installs `dnsproxy`.
- Make sure the `src/domains/top_100_newzdash_march_2025.txt` file exists and contains the domains to test.

### Generating Reports

After running benchmarks, generate an HTML report to visualize the results.

```bash
bun src/cli.ts generate-report -i dist/metrics/baseline_2025-03-13_15-16-01.json,dist/metrics/dns_2025-03-13_09-25-59.json,dist/metrics/extension_2025-03-13_13-28-17.json
```

The report will be generated in the `report` directory.

You can also specify a custom output directory:

```bash
bun src/cli.ts generate-report -i dist/metrics/baseline_2025-03-13_15-16-01.json,dist/metrics/dns_2025-03-13_09-25-59.json -r custom-report
```

### CLI Usage

The project includes a Command Line Interface (CLI) that allows you to run benchmarks and generate reports with various options.

#### Options

The CLI script is located at `src/cli.ts`. You can run it directly using Bun:

```bash
bun src/cli.ts [options]
```

Here are the available options:

- `-e, --environment <type>`: **Test environment**. Specifies the testing environment. Possible values are:
  - `none`: No specific ad blocking setup
  - `baseline`: Standard baseline testing without ad blocking
  - `dns`: Runs with DNS-based ad blocking
  - `extension`: Runs with the ad blocker browser extension enabled
- `-f, --file <path>`: **Path to the domains list file**. Specifies the file containing the list of domains to test.
- `-l, --limit <number>`: **Limit the number of domains to process**. Processes only the specified number of domains from the list.
- `-d, --domain <domain>`: **Process a single domain**. Use this to test a single domain instead of a list.
- `-p, --proxy-server <proxy_server:port>`: **Proxy server**. Specifies a proxy server to route traffic through.
- `-h, --har [path]`: **Enable HAR collection**. Collects HTTP Archive (HAR) files. You can optionally specify the path to save the HAR file.
- `-x, --with-extension`: **Run with the extension enabled**. Enables the ad blocker browser extension during the benchmark.
- `-v, --verbose`: **Enable verbose logging**. Outputs additional logging information.
- `-o, --output-file <filename>`: **Specify the output filename**. Sets the filename for the output metrics JSON (without extension).

#### Commands

In addition to the default action, the CLI provides a `generate-report` command:

- `generate-report`: Generates an HTML report from collected metrics.

  **Options:**

  - `-i, --input <files>`: **Comma-separated list of input JSON files** (Required). Specifies the metrics files to include in the report.
  - `-r, --report-output <path>`: **Output directory path**. Default is `report`.

Example:

```bash
bun src/cli.ts generate-report -i dist/metrics/baseline_2025-03-13_15-16-01.json,dist/metrics/extension_2025-03-13_13-28-17.json -r report
```

#### Running Locally

To run the CLI locally without Docker:

```bash
# Install required dependencies
bun install

# Run a simple test with a single domain
bun src/cli.ts -e baseline -d example.com

# Run with a file of domains
bun src/cli.ts -e baseline -f src/domains/top_100_newzdash_march_2025.txt

# Generate a report
bun src/cli.ts generate-report -i dist/metrics/baseline_results.json -r report
```

Note that running locally requires all dependencies to be installed, including Puppeteer and any browser extensions used for testing.

#### Examples

**Running a Baseline Benchmark**

Run the benchmark without any ad blocking (baseline scenario):

```bash
bun src/cli.ts -e baseline -f src/domains/top_100_newzdash_march_2025.txt
```

**Running with Extension-Based Ad Blocking**

Run the benchmark with the ad blocker browser extension enabled:

```bash
bun src/cli.ts -e extension -x -f src/domains/top_100_newzdash_march_2025.txt
```

**Running with DNS-Based Ad Blocking**

Run the benchmark using DNS-based ad blocking:

```bash
ADGUARD_DNS_DOH_URL="https://dns.adguard.com/dns-query" \
bun src/cli.ts -e dns -f src/domains/top_100_newzdash_march_2025.txt
```

**Note:** When running DNS tests locally, make sure you have properly configured DNS settings or proxy tools like `dnsproxy` installed and running.

**Processing a Single Domain**

To process a single domain:

```bash
bun src/cli.ts -e none -d example.com
```

**Limiting the Number of Domains**

To limit the number of domains processed from a file:

```bash
bun src/cli.ts -e none -f src/domains/top_100_us_news.txt -l 10
```

**Using the Combined News Domains List**

To run benchmarks using our comprehensive combined list of news domains:

```bash
bun src/cli.ts -e baseline -f src/domains/combined_unique_news_domains.txt
```

This will test against all 173 unique news domains from multiple sources, providing more thorough and representative results.

**Enabling HAR Collection**

To enable HAR (HTTP Archive) file collection:

```bash
bun src/cli.ts -e none -f src/domains/top_100_us_news.txt -h
```

Optionally, specify a custom HAR file path:

```bash
bun src/cli.ts -e none -f src/domains/top_100_us_news.txt -h my-har-results.har
```

**Verbose Logging**

To enable verbose logging for more detailed output:

```bash
bun src/cli.ts -e none -f src/domains/top_100_us_news.txt -v
```

**Specifying Output Filename**

To specify a custom output filename for the metrics:

```bash
bun src/cli.ts -e none -f src/domains/top_100_us_news.txt -o custom_metrics_filename
```

### Help Command

For a full list of available options and commands, you can display the help message:

```bash
bun src/cli.ts --help
```

## Scripts and Commands

The following scripts are available in `package.json` for development purposes:

```json
"scripts": {
  "lint": "eslint . && tsc --noEmit",
  "test": "bun test"
}
```

**Descriptions:**

- **lint**: Lints the codebase using ESLint and checks TypeScript types.
- **test**: Runs the test suite using Bun's test runner (Jest-compatible)
- **docker-build**: Builds the Docker image for benchmarking.
- **generate-report**: Shorthand for the report generation command (requires input parameters when run)
