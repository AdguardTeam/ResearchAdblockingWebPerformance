import fsExtra from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';

import { logger } from './logger';

const execPromise = promisify(exec);

/**
 * Extracts a zip file to the specified destination using the native unzip command
 *
 * @param zipPath Path to the zip file
 * @param destDir Destination directory
 * @returns Promise that resolves when extraction is complete
 */
export async function extractZipFile(zipPath: string, destDir: string): Promise<void> {
    logger.info(`Starting extraction of ${zipPath} to ${destDir}`);

    try {
        const { stderr } = await execPromise(`unzip -o "${zipPath}" -d "${destDir}"`);
        if (stderr && stderr.length > 0) {
            logger.error(`unzip stderr: ${stderr}`);
        }
        logger.info('Extraction completed successfully');
    } catch (error) {
        logger.error(`Extraction failed: ${error}`);
        throw error;
    }
}

/**
 * Ensures a directory exists and is empty
 *
 * @param dirPath Path to the directory
 */
export async function ensureEmptyDir(dirPath: string): Promise<void> {
    if (fsExtra.existsSync(dirPath)) {
        await fsExtra.remove(dirPath);
        logger.info(`Removed existing directory at: ${dirPath}`);
    }

    await fsExtra.ensureDir(dirPath);
    logger.info(`Created empty directory at: ${dirPath}`);
}
