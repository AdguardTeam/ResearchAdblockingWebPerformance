#!/usr/bin/env node

/**
 * This script syncs reports from the report directory to the docs directory
 * and generates an index.html file with links to all reports
 */

const path = require('path');
const fs = require('fs/promises');

// Paths
const reportDir = path.join(__dirname, '..', '..', 'report');
const docsDir = path.join(__dirname, '..', '..', 'docs');
const indexPath = path.join(docsDir, 'index.html');

/**
 * Extracts and formats date from filename
 * @param {string} filename - The filename to extract date from
 * @returns {string|null} - Formatted date string or null if not found
 */
function extractDateFromFilename(filename) {
  const dateRegex = /report_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.html/;
  const match = filename.match(dateRegex);

  if (match) {
    const [_, date, time] = match;
    return `${date} ${time.replace(/-/g, ':')}`;
  }

  return null;
}

/**
 * Main function
 */
async function main() {
  try {
    // Create docs directory if it doesn't exist
    await fs.mkdir(docsDir, { recursive: true });
    console.log('Docs directory created or already exists');

    // Get list of HTML files in report directory
    let reportFiles = [];
    try {
      const files = await fs.readdir(reportDir);
      reportFiles = files.filter(file => file.endsWith('.html'));
    } catch (error) {
      console.log('No report directory or no HTML files found');
    }

    // Get list of existing HTML files in docs directory (excluding index.html)
    let existingDocsFiles = [];
    try {
      const files = await fs.readdir(docsDir);
      existingDocsFiles = files.filter(file => file.endsWith('.html') && file !== 'index.html');
    } catch (error) {
      console.log('Error reading docs directory:', error.message);
    }

    // Remove files from docs that are no longer in report directory
    for (const file of existingDocsFiles) {
      if (!reportFiles.includes(file)) {
        try {
          await fs.unlink(path.join(docsDir, file));
          console.log(`Removed old file ${file} from docs directory`);
        } catch (error) {
          console.error(`Error removing file ${file}:`, error.message);
        }
      }
    }

    // Copy report files to docs directory
    if (reportFiles.length > 0) {
      console.log(`Found ${reportFiles.length} HTML report(s) to copy`);
      for (const file of reportFiles) {
        await fs.copyFile(
          path.join(reportDir, file),
          path.join(docsDir, file)
        );
        console.log(`Copied ${file} to docs directory`);
      }
    } else {
      console.log('No HTML files to copy');
    }

    // Get all HTML files in docs directory (excluding index.html) for the index page
    let docsFiles = [];
    try {
      const files = await fs.readdir(docsDir);
      docsFiles = files.filter(file => file.endsWith('.html') && file !== 'index.html');

      // Sort files by date in filename (newest first)
      docsFiles.sort((a, b) => {
        const dateA = extractDateFromFilename(a);
        const dateB = extractDateFromFilename(b);

        if (dateA && dateB) {
          return dateB.localeCompare(dateA); // Newest first
        }

        return b.localeCompare(a); // Fallback to alphabetical
      });
    } catch (error) {
      console.log('Error reading docs directory:', error.message);
    }

    // Generate HTML for file list
    let fileListHtml = '';
    if (docsFiles.length === 0) {
      fileListHtml = '    <li class="empty-message">No reports available yet.</li>\n';
    } else {
      for (const file of docsFiles) {
        fileListHtml += `    <li><a href="${file}">${file}</a></li>\n`;
      }
    }

    // Generate index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Index</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 4px;
      background-color: #f9f9f9;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .date {
      color: #666;
      font-size: 0.9em;
    }
    .empty-message {
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Report Index</h1>
  <ul>
${fileListHtml}  </ul>
</body>
</html>`;

    // Write index.html
    await fs.writeFile(indexPath, indexHtml);
    console.log('Generated index.html in docs directory');

    console.log('Reports synced and index.html generated successfully');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
