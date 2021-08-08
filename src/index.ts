import Http from 'http';
import Https from 'https';
import Http2 from 'http2';
import type {Socket} from 'net';
import type Net from 'net';
import {readFileSync} from 'fs';
import { handleRequest } from './handle-request';
import { Https_Options, initOptions, Options, ParsedOptions, Protocols } from './options';
import { LogInterface, LogLevels, setLogLevel, voidLog} from './utils/log';
import { ErrorCodes, GError } from './error';
import Chalk from 'chalk';
import LRU_TTL_CACHE from 'lru-ttl-cache';
import {resolve} from 'path';
import { renderForDev, RenderFx } from './utils/render';
import {I18nInterface, Request} from './http/request';
import {Response} from './http/response';
import {GridfwRouter} from 'gridfw-tree-router';
import type { Controller } from './http/controller';
// import GridfwRouter from 'gridfw-tree-router';
/**
 * Gridfw
 */
export class Gridfw<TSession, TI18n extends I18nInterface> extends GridfwRouter<Controller<TSession, TI18n>> implements LogInterface{
	/** Request class */
	Request:	new (socket: Socket)=> Request<TSession, TI18n>;
	/** Response */
	Response:	new (req: Request<TSession, TI18n>)=> Response<TSession, TI18n>;

	/** Framework version */
	static version= JSON.parse(readFileSync('package.json', 'utf-8')).version
	/** Underlying http2 server  */
	readonly server: Http2.Http2SecureServer|Http.Server;
	/** If this is a secure connection */
	readonly secure:	boolean
	/** Check used protocol */
	readonly protocol:	Protocols
	/** Options */
	readonly options: Omit<ParsedOptions, 'baseURL'>;

	/** Views cache */
	// TODO adjust view cache
	readonly _viewCache: LRU_TTL_CACHE<string, RenderFx>;

	/** Base URL */
	baseURL:	URL
	/** If the base URL is generated, not given in options */
	private _baseURLAuto: boolean
	/** Server IP */
	ip?:		string
	/** Server Ip Type */
	ipType?: 	string
	/** Server port */
	port?:		number

	/** Locals, common data on all views */
	data:	Record<string, any>= {app: this}

	constructor(options: Partial<Options>={}){
		super(options);
		this.options= options= initOptions(options);
		const app= this;
		//* Base URL
		if(options.baseURL==null){
			this.baseURL= new URL('http://localhost');
			this._baseURLAuto= true;
		} else {
			this.baseURL=	options.baseURL;
			this._baseURLAuto= false;
		}
		//* Request Class
		this.Request= class extends Request<TSession, TI18n>{
			readonly app= app;
		};
		//* Response Class
		this.Response= class extends Response<TSession, TI18n>{
			readonly app= app;
		};
		//* Listen options
		this.protocol= options.protocol!;
		//* Options
		//* create server
		switch(options.protocol!){
			case Protocols.http:
				// HTTP 1.1
				this.secure= false;
				this.server= Http.createServer({

				});
				break;
			case Protocols.https:
				// HTTPs 1.1
				this.secure= true;
				let httpsOptions= (options as Https_Options).server;
				if(httpsOptions==null || httpsOptions.cert==null)
					throw new Error('Expected SSL/TLS certificat for HTTP2');
				this.server= Https.createServer(httpsOptions);
				break;
			case Protocols.http2:
				// HTTP 2
				this.secure= true;
				let http2Options= (options as Https_Options).server;
				if(http2Options?.cert==null)
					throw new Error('Expected SSL/TLS certificat for HTTP2');
				this.server= Http2.createSecureServer(http2Options);
				// Listener
				// this.server.on('stream', function (stream, headers, flags) {
				// 	TODO improuve HTTP2
				// 	console.log('--- received http2 request');
				// 	stream.respond({
				// 		'content-type': 'text/html; charset=utf-8',
				// 		':status': 500
				// 	});
				// 	stream.end('<b>Handler unimplemented!</b>');
				// });
				break;
			default:
				throw new Error(`Enexpected protocol: ${this.protocol}, valid values are: Protocols.http, Protocols.https and Protocols.http2`);
		}
		//* Listener
		this.server.on('request', handleRequest.bind(this));
		//* Log
		this.setLogLevel(options.logLevel ?? (options.isProd? LogLevels.warn : LogLevels.debug));
		//* I18N
		this._defaultLocale= options.defaultLocale?.toLowerCase() ?? 'en';
		this.reloadLoadI18n();
		//* Views
		this._viewCache= new LRU_TTL_CACHE(options.viewsCache);
		//* Views in dev mode
		if(!options.isProd && options.viewsDev){
			this._render= renderForDev(options.viewsDev);
		}
	}
	
	//* Log
	/** Log: Debug */
	debug:	(tag: string, message: any)=> this	=	voidLog;
	info:	(tag: string, message: any)=> this	=	voidLog;
	warn:	(tag: string, message: any)=> this	=	voidLog;
	error:	(tag: string, message: any)=> this	=	voidLog;
	fatalError:	(tag: string, message: any)=> this= voidLog;
	private _logLevel:	LogLevels= LogLevels.debug;
	getLogLevel(){ return this._logLevel; }
	setLogLevel: (level: LogLevels)=> this		= setLogLevel;

	//* Locales
	/** Supported locales */
	private _defaultLocale: string
	readonly locales: Set<string>= new Set()
	get defaultLocale(){ return this._defaultLocale; }
	set defaultLocale(locale: string){
		locale= locale.toLowerCase();
		if(this.locales.has(locale)) this._defaultLocale= locale;
		else throw new GError(ErrorCodes.UNKNOWN_LOCALE, `Unknown locale: ${locale}`, locale);
	}

	/**
	 * Reload i18n list
	 * ! Use Sync load
	 */
	reloadLoadI18n(){
		//TODO
		return this;
	}

	/** Get locale entries */
	async getLocale(locale: string): Promise<TI18n>{
		//TODO
		throw new Error('Unimplemented!');
	}

	/**
	 * Start listening
	 */
	listen(){
		const server= this.server;
		server.listen(this.options.listen);
		// server.on('error', function(err: any){
		// 	console.log('error>> ', err);
		// });
		// console.log('--- listen: ', this.secure);
		//* Data
		var a= server.address() as Net.AddressInfo;
		this.port= a.port;
		this.ip= a.address;
		this.ipType= a.family;
		//* Base url
		if(this._baseURLAuto){
			this.baseURL= new URL(`${this.secure?'https':'http'}://localhost:${this.port}`);
		}
		//* Print status
		this.printStatus();
		return this;
	}
	/** Close server connection */
	close(): Promise<this>{
		return new Promise((res, rej)=>{
			this.ip= this.port= this.ipType= undefined;
			this.server.close((err)=>{
				if(err) rej(err);
				else res(this);
			});
		});
	}

	/** Print app status */
	printStatus(){
		var options= this.options;
		console.log(Chalk.blueBright(`
╒═════════════════════════════════════════════════════════════════════════════╕

\t\t  ██████╗ ██████╗ ██╗██████╗ ███████╗██╗    ██╗
\t\t ██╔════╝ ██╔══██╗██║██╔══██╗██╔════╝██║    ██║
\t\t ██║  ███╗██████╔╝██║██║  ██║█████╗  ██║ █╗ ██║
\t\t ██║   ██║██╔══██╗██║██║  ██║██╔══╝  ██║███╗██║
\t\t ╚██████╔╝██║  ██║██║██████╔╝██║     ╚███╔███╔╝
\t\t  ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝      ╚══╝╚══╝
\t\t\tFramework version: ${Gridfw.version}

\tREADY
\t√ App name: ${options.name ?? '< Untitled >'}
\t√ App Author: ${options.author ?? '< Unknown >'}
\t√ Admin email: ${options.email ?? '<No email>'}
\t${options.isProd? Chalk.green('√ Production Mode') : Chalk.keyword('orange')("[X] Development Mode.\n\t[!] Enable prodution mode to boost performance")}
\t${Chalk.green(`█ Server listening At: ${this.baseURL.href}`)}
╘═════════════════════════════════════════════════════════════════════════════╛`));
		return this;
	}

	/** Render view */
	render(locale: string, path: string, data?: Record<string, any>){
		return this._render(locale, path, data);
	}
	/** Apply render */
	async _render(locale: string, path: string, data1?: Record<string, any>, data2?: Record<string, any>): Promise<string>{
		try {
			var data: Record<string, any>= {...this.data, ...data1, ...data2};
			path= `${locale}${path.charAt(0)==='/'?'': '/'}${path}`;
			// var options= this.options;
			// var viewPath= resolve(options.views, locale, path)+'.js';
			var renderFx= await this._viewCache.upsert(path);
			return renderFx(data);
		} catch (err) {
			if(err?.code==='ENOENT')
				throw new GError(ErrorCodes.VIEW_NOT_FOUND, `Missing view "${path}" for locale "${locale}" at: ${resolve(this.options.views, path)}.js `);
			else
				throw new GError(ErrorCodes.VIEW_ERROR, `Error at view "${resolve(this.options.views, path)}.js"`, err);
		}
	}
}


export * from './error';