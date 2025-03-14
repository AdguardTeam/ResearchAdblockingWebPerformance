# Reports Documentation

This directory contains HTML reports generated for the Research Adblocking Web Performance project.

## Overview

The reports in this directory show performance metrics and other data related to web performance with and without ad-blocking. These reports are automatically synced from the `report` directory via a GitHub Action.

## Accessing Reports

You can access all reports through the [index.html](./index.html) page, which provides a sorted list of all available reports.

## Report Naming Convention

Reports follow the naming convention: `report_YYYY-MM-DD_HH-MM-SS.html` where:
- `YYYY-MM-DD` is the date the report was generated
- `HH-MM-SS` is the time the report was generated

## Adding New Reports

To add new reports:
1. Place the HTML report file in the `report` directory
2. The GitHub Action will automatically copy it to the `docs` directory and update the index

## Removing Reports

To remove a report:
1. Delete the HTML report file from the `report` directory
2. The sync script will automatically remove it from the `docs` directory on the next run

The `docs` directory will always mirror the HTML files found in the `report` directory.

## Running the Sync Script Manually

You can sync reports manually by running the Node.js script:

```bash
node .github/scripts/sync-reports.js
```

This will:
1. Create the docs directory if it doesn't exist
2. Remove any HTML files in docs that are no longer in the report directory
3. Copy all HTML reports from the report directory to docs
4. Generate an index.html file with links to those reports

## GitHub Action

The reports are maintained by the [Sync Reports to Docs](.github/workflows/sync-reports.yml) GitHub Action, which runs:
- On every push that changes files in the `report` directory
- On manual trigger via GitHub Actions interface
