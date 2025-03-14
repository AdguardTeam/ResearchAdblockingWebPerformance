/* eslint-disable @typescript-eslint/no-explicit-any */
import winston from 'winston';

/**
 * Logger class
 */
export class Logger {
    private logger: winston.Logger;

    private createLogger = (verbose: boolean) => {
        return winston.createLogger({
            level: verbose ? 'debug' : 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}] ${message}`;
                }),
            ),
            transports: [
                new winston.transports.Console(),
            ],
        });
    };

    constructor(verbose = false) {
        this.logger = this.createLogger(verbose);
    }

    setVerbose(verbose: boolean) {
        this.logger = this.createLogger(verbose);
    }

    public error(message: string, ...meta: any[]): void {
        this.logger.error(message, ...meta);
    }

    public info(message: string, ...meta: any[]): void {
        this.logger.info(message, ...meta);
    }

    public debug(message: string, ...meta: any[]): void {
        this.logger.debug(message, ...meta);
    }
}

export const logger = new Logger();
