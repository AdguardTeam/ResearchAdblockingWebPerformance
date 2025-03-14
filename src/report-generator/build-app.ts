import { build, BuildArtifact } from 'bun';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { type ReportResult } from './report-generator';

const srcDir = path.join(__dirname, 'app', 'src');

function inlineCSS(htmlContent: string, cssPaths: string[]): string {
    let inlinedCss = '';
    cssPaths.forEach((cssPath) => {
        const cssContent = fs.readFileSync(cssPath, 'utf-8');
        inlinedCss += `<style>${cssContent}</style>\n`;
        fs.unlinkSync(cssPath);
        logger.info(`Inlined and removed CSS file: ${cssPath}`);
    });

    // Replace the CSS placeholder with inlined CSS
    return htmlContent.replace('<!--INLINE_CSS-->', inlinedCss.trim());
}

function inlineJavaScript(htmlContent: string, jsPaths: string[]): string {
    let inlinedJs = '';
    jsPaths.forEach((jsPath) => {
        const jsContent = fs.readFileSync(jsPath, 'utf-8');
        const encodedJs = Buffer.from(jsContent, 'utf-8').toString('base64');
        fs.unlinkSync(jsPath);
        logger.info(`Inlined and removed JS file: ${jsPath}`);
        inlinedJs += `<script type="module" src="data:text/javascript;base64,${encodedJs}"></script>\n`;
    });

    // Replace the JS placeholder with inlined JS
    return htmlContent.replace(
        '<!--INLINE_JS-->',
        inlinedJs,
    );
}

function inlineJsonData(htmlContent: string, reportResultsMap: Record<string, ReportResult>): string {
    const inlinedJson = `<script>window.reportResults = ${JSON.stringify(reportResultsMap)};</script>`;
    return htmlContent.replace('<!--INLINE_JSON-->', inlinedJson);
}

// Helper function to inline assets
function inlineAssets(
    htmlContent: string,
    outputs: BuildArtifact[],
    reportResultsMap: Record<string, ReportResult>,
): string {
    let newHtmlContent = htmlContent;

    const jsPaths = outputs
        .filter((output) => path.extname(output.path) === '.js')
        .map((output) => output.path);

    newHtmlContent = inlineJavaScript(newHtmlContent, jsPaths);

    // Inline CSS
    const cssPaths = outputs
        .filter((output) => path.extname(output.path) === '.css')
        .map((output) => output.path);
    newHtmlContent = inlineCSS(newHtmlContent, cssPaths);

    newHtmlContent = inlineJsonData(newHtmlContent, reportResultsMap);

    return newHtmlContent;
}

export const buildApp = async (
    distDir: string,
    reportResultsMap: Record<string, ReportResult>,
    filename: string = 'index.html',
): Promise<void> => {
    logger.info(`Building app in ${distDir}`);

    const result = await build({
        entrypoints: [path.join(srcDir, 'index.tsx')],
        outdir: distDir,
        target: 'browser',
        splitting: false,
        format: 'esm',
        sourcemap: 'inline',
        minify: false,
        // @ts-ignore
        experimentalCss: true,
    });

    if (!result.success) {
        logger.error('Build failed');
        result.logs.forEach((message) => {
            logger.error(message.message);
        });
        return;
    }

    // Read the source index.html
    const htmlSrc = path.join(srcDir, 'public', 'index.html');
    let htmlContent: string;
    try {
        htmlContent = fs.readFileSync(htmlSrc, 'utf-8');
    } catch (err) {
        logger.error(`Failed to read HTML source: ${err}`);
        throw err;
    }

    // Inline assets
    try {
        htmlContent = inlineAssets(htmlContent, result.outputs, reportResultsMap);
    } catch (err) {
        logger.error(`Failed to inline assets: ${err}`);
        throw err;
    }

    // Write the final HTML to the dist directory using the provided filename
    const htmlDest = path.join(distDir, filename);
    try {
        fs.writeFileSync(htmlDest, htmlContent, 'utf-8');
        logger.info(`App built at ${htmlDest}`);
    } catch (err) {
        logger.error(`Failed to write final HTML: ${err}`);
        throw err;
    }

    logger.info('All assets inlined into HTML and external files removed');
};
