import Chalk from 'chalk';
/** Log */
export interface LogInterface{
	/** Log: Debug */
	debug:	(tag: string, message: any)=> this
	/** Log: Info */
	info:	(tag: string, message: any)=> this
	/** Log: Warn */
	warn:	(tag: string, message: any)=> this
	/** Log: Error */
	error:	(tag: string, message: any)=> this
	/** Log: FatalError */
	fatalError: (tag: string, message: any)=> this
	/** Set log level */
	getLogLevel:	()=> LogLevels
	setLogLevel:	(level: LogLevels)=> this
}

/** Log Level */
export enum LogLevels{
	debug,
	info,
	warn,
	error,
	fatalError,
	/** Disable all logs */
	disable
}

export type LogMethodNames= 'DEBUG'|'INFO'|'WARN'|'ERROR'|'FATAL_ERROR';

/** void log */
export function voidLog(this: any, tag: string, message: any){
	return this;
}

/** Set log level */
export function setLogLevel(this: any, level: LogLevels){
	this.debug=	level>=LogLevels.debug ? logDebug : voidLog;
	this.info=	level>=LogLevels.info ? logInfo : voidLog;
	this.warn=	level>=LogLevels.warn ? logWarn : voidLog;
	this.error=	level>=LogLevels.error ? logError : voidLog;
	this.fatalError=	level>=LogLevels.fatalError ? logFatalError : voidLog;
	return this;
}


/** Debug method */
function logDebug(this:any, tag: string, message: any){
	console.log(`[►] DEBUG\t${tag}\t`, message);
	return this;
}
function logInfo(this:any, tag: string, message: any){
	console.log(Chalk.blueBright(`[i] INFO\t${tag}\t`), message);
	return this;
}
function logWarn(this:any, tag: string, message: any){
	console.log(Chalk.keyword('orange')(`[‼] WARN\t${tag}\t`), message);
	return this;
}
function logError(this:any, tag: string, message: any){
	console.log(Chalk.red(`[×] ERROR\t${tag}\t`), message);
	return this;
}
function logFatalError(this:any, tag: string, message: any){
	console.log(Chalk.red.underline(`[×] FATAL_ERROR\t${tag}\t`), message);
	return this;
}