import Http, { IncomingMessage, ServerResponse } from 'http';
import Https from 'https';
import Http2 from 'http2';
import type { Socket } from 'net';
import type Net from 'net';
import { readFileSync } from 'fs';
import {
	Https_Options,
	initOptions,
	Options,
	ParsedOptions,
	Protocols
} from './options';
import { LogInterface, LogLevels, setLogLevel, voidLog } from './utils/log';
import { ErrorCodes, GError } from './error';
import Chalk from 'chalk';
import LRU_TTL_CACHE from 'lru-ttl-cache';
import { resolve } from 'path';
import { renderForDev, RenderFx } from './utils/render';
import { Request } from './http/request';
import { Response } from './http/response';
import {
	GridfwRouter,
	HTTPStatus,
	PathResolverResult,
	PathResolverSuccess
} from 'gridfw-tree-router';
import type { Controller } from './http/controller';
//@ts-ignore
import { CookieParams } from './utils/cookie';
import { ParamMap } from './utils/path-params';
import { I18N } from './helpers/i18n';
// import GridfwRouter from 'gridfw-tree-router';
/**
 * Gridfw
 */
export class Gridfw<TSession = any, TI18n extends I18N = any>
	extends GridfwRouter<Controller<TSession, TI18n>>
	implements LogInterface
{
	/** Request class */
	Request: new (socket: Socket) => Request<TSession, TI18n>;
	/** Response */
	Response: new (req: Request<TSession, TI18n>) => Response<TSession, TI18n>;

	/** Framework version */
	static version = JSON.parse(readFileSync('package.json', 'utf-8')).version;
	/** Underlying http2 server  */
	readonly server: Http2.Http2SecureServer | Http.Server;
	/** If this is a secure connection */
	readonly secure: boolean;
	/** Check used protocol */
	readonly protocol: Protocols;
	/** Options */
	readonly options: Omit<ParsedOptions, 'baseURL'>;

	/** Views cache */
	// TODO adjust view cache
	readonly _viewCache: LRU_TTL_CACHE<string, RenderFx>;

	/** Base URL */
	baseURL: URL;
	/** If the base URL is generated, not given in options */
	private _baseURLAuto: boolean;
	/** Server IP */
	ip?: string;
	/** Server Ip Type */
	ipType?: string;
	/** Server port */
	port?: number;

	/** Locals, common data on all views */
	data: Record<string, any> = { app: this };

	constructor(options: Partial<Options> = {}) {
		super(options);
		this.options = options = initOptions(options);
		const app = this;
		//* Base URL
		if (options.baseURL == null) {
			this.baseURL = new URL('http://localhost');
			this._baseURLAuto = true;
		} else {
			this.baseURL = options.baseURL;
			this._baseURLAuto = false;
		}
		//* Request Class
		this.Request = class extends Request<TSession, TI18n> {
			readonly app = app;
		};
		//* Response Class
		this.Response = class extends Response<TSession, TI18n> {
			readonly app = app;
		};
		//* Listen options
		this.protocol = options.protocol!;
		//* Options
		//* create server
		switch (options.protocol!) {
			case Protocols.http:
				// HTTP 1.1
				this.secure = false;
				this.server = Http.createServer({
					//@ts-ignore
					IncomingMessage: this.Request,
					ServerResponse: this.Response
				});
				break;
			case Protocols.https:
				// HTTPs 1.1
				this.secure = true;
				let httpsOptions = (options as Https_Options).server;
				if (httpsOptions == null || httpsOptions.cert == null)
					throw new Error('Expected SSL/TLS certificat for HTTP2');
				// TODO add response objects
				this.server = Https.createServer(httpsOptions);
				break;
			case Protocols.http2:
				// HTTP 2
				this.secure = true;
				let http2Options = (options as Https_Options).server;
				if (http2Options?.cert == null)
					throw new Error('Expected SSL/TLS certificat for HTTP2');
				this.server = Http2.createSecureServer(http2Options);
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
				throw new Error(
					`Enexpected protocol: ${this.protocol}, valid values are: Protocols.http, Protocols.https and Protocols.http2`
				);
		}
		//* Listener
		this.handle = this.handle.bind(this); // enable to use this method by external services
		this.server.on('request', this.handle);
		//* Log
		this.setLogLevel(
			options.logLevel ??
				(options.isProd ? LogLevels.warn : LogLevels.debug)
		);
		//* I18N
		this._defaultLocale = options.defaultLocale?.toLowerCase() ?? 'en';
		//* Views
		this._viewCache = new LRU_TTL_CACHE(options.viewsCache);
		//* Views in dev mode
		if (!options.isProd && options.viewsDev) {
			this._render = renderForDev(options.viewsDev);
		}
	}

	//* Log
	/** Log: Debug */
	debug: (tag: string, message: any) => this = voidLog;
	info: (tag: string, message: any) => this = voidLog;
	warn: (tag: string, message: any) => this = voidLog;
	error: (tag: string, message: any) => this = voidLog;
	fatalError: (tag: string, message: any) => this = voidLog;
	private _logLevel: LogLevels = LogLevels.debug;
	getLogLevel() {
		return this._logLevel;
	}
	setLogLevel: (level: LogLevels) => this = setLogLevel;

	//* Locales
	/** Supported locales */
	private _defaultLocale: string;
	readonly locales: Set<string> = new Set();
	readonly localesMap: Map<string, TI18n> = new Map();
	get defaultLocale() {
		return this._defaultLocale;
	}
	set defaultLocale(locale: string) {
		locale = locale.toLowerCase();
		if (this.locales.has(locale)) this._defaultLocale = locale;
		else
			throw new GError(
				ErrorCodes.UNKNOWN_LOCALE,
				`Unknown locale: ${locale}`,
				locale
			);
	}
	/**
	 * Init i18n files
	 * @internal
	 */
	_initI18n(...args: TI18n[]) {
		for (let i = 0, len = args.length; i < len; ++i) {
			let locale = args[i];
			let lname = locale.name;
			if (typeof lname !== 'string')
				throw new GError(
					ErrorCodes.WRONG_LOCALE,
					`Expected locale name`
				);
			if (this.locales.has(lname))
				throw new GError(
					ErrorCodes.DUPLICATED_LOCALE,
					`Duplicated locale: ${lname}`
				);
			this.locales.add(lname);
			this.localesMap.set(lname, locale);
		}
		return this;
	}

	/** Get locale entries */
	getLocale(locale: string): TI18n | undefined {
		return this.localesMap.get(locale);
	}

	/**
	 * Start listening
	 */
	listen() {
		const server = this.server;
		server.listen(this.options.listen);
		// server.on('error', function(err: any){
		// 	console.log('error>> ', err);
		// });
		// console.log('--- listen: ', this.secure);
		//* Data
		var a = server.address() as Net.AddressInfo;
		this.port = a.port;
		this.ip = a.address;
		this.ipType = a.family;
		//* Base url
		if (this._baseURLAuto) {
			this.baseURL = new URL(
				`${this.secure ? 'https' : 'http'}://localhost:${this.port}`
			);
		}
		//* Print status
		this.printStatus();
		return this;
	}
	/** Server listening */
	get listening() {
		return this.server.listening;
	}
	/** Close server connection */
	close(): Promise<this> {
		return new Promise((res, rej) => {
			this.ip = this.port = this.ipType = undefined;
			this.server.close(err => {
				if (err) rej(err);
				else res(this);
			});
		});
	}

	/** Print app status */
	printStatus() {
		var options = this.options;
		console.log(
			Chalk.blueBright(`
╒═════════════════════════════════════════════════════════════════════════════╕

\t\t  ██████╗ ██████╗ ██╗██████╗ ███████╗██╗    ██╗
\t\t ██╔════╝ ██╔══██╗██║██╔══██╗██╔════╝██║    ██║
\t\t ██║  ███╗██████╔╝██║██║  ██║█████╗  ██║ █╗ ██║
\t\t ██║   ██║██╔══██╗██║██║  ██║██╔══╝  ██║███╗██║
\t\t ╚██████╔╝██║  ██║██║██████╔╝██║     ╚███╔███╔╝
\t\t  ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝      ╚══╝╚══╝
\t\t\tFramework version: ${Gridfw.version}

\tREADY
\t${
				options.name
					? '√ App Name: ' + options.name
					: Chalk.keyword('orange')('[X] App Name not set')
			}
\t${
				options.author
					? '√ Author: ' + options.author
					: Chalk.keyword('orange')('[X] Author not set')
			}
\t${
				options.email
					? '√ Admin Email: ' + options.email
					: Chalk.keyword('orange')('[X] Admin Email not set')
			}
\t${
				options.isProd
					? Chalk.green('√ Production Mode')
					: Chalk.keyword('orange')(
							'[X] Development Mode.\n\t[!] Enable prodution mode to boost performance'
					  )
			}
\t${Chalk.green(`█ Server listening At: ${this.baseURL.href}`)}
╘═════════════════════════════════════════════════════════════════════════════╛`)
		);
		return this;
	}

	/** Render view */
	render(locale: string, path: string, data?: Record<string, any>) {
		return this._render(locale, path, data);
	}
	/** Apply render */
	async _render(
		locale: string,
		path: string,
		data1?: Record<string, any>,
		data2?: Record<string, any>
	): Promise<string> {
		try {
			var data: Record<string, any> = {
				...this.data,
				...data1,
				...data2
			};
			path = `${locale}${path.charAt(0) === '/' ? '' : '/'}${path}`;
			// var options= this.options;
			// var viewPath= resolve(options.views, locale, path)+'.js';
			var renderFx = await this._viewCache.upsert(path);
			return renderFx(data);
		} catch (err: any) {
			if (err?.code === 'ENOENT')
				throw new GError(
					ErrorCodes.VIEW_NOT_FOUND,
					`Missing view "${path}" for locale "${locale}" at: ${resolve(
						this.options.views,
						path
					)}.js `
				);
			else
				throw new GError(
					ErrorCodes.VIEW_ERROR,
					`Error at view "${resolve(this.options.views, path)}.js"`,
					err
				);
		}
	}
	/** Handle request */
	async handle(
		req: Request<TSession, TI18n>,
		resp: Response<TSession, TI18n>
	) {
		var controllerResponse: any;
		try {
			var options = this.options;
			//* Resolve path
			var path = req.url!,
				method = req.method!;
			var c = path.indexOf('?');
			if (c === -1) {
				req.rawQuery = '';
			} else {
				req.rawQuery = path.substr(c + 1);
				path = path.substr(0, c);
			}
			req.pathname = path;
			//* Resolve Route
			var routeNode = this._routerCache.get(`${method} ${path}`, true, [
				method,
				path
			]) as PathResolverResult<Controller<TSession, TI18n>>;
			if (routeNode.status !== HTTPStatus.OK) throw routeNode.error;
			//* Resolve Path params
			req.params = new ParamMap(req, routeNode);
			//* Resolve cookie params
			req.cookies = new CookieParams(req);
			//* Exec wrappers
			let wrappers = routeNode.wrappers;
			if (wrappers.length > 0) {
				var wrapperIndex = 0;
				function next() {
					var w = wrappers[wrapperIndex++];
					if (w == null)
						return (
							routeNode as PathResolverSuccess<
								Controller<TSession, TI18n>
							>
						).controller(req, resp);
					else return w(req, resp, next);
				}
				controllerResponse = await next();
			} else {
				controllerResponse = await (
					routeNode as PathResolverSuccess<
						Controller<TSession, TI18n>
					>
				).controller(req, resp);
			}
		} catch (err: any) {
			//* Handle error
			var errors = this.options.errors;
			if (typeof err?.code === 'number')
				(errors[err.code] ?? errors.else)(err, req, resp);
			else errors.else(err, req, resp);
		} finally {
			// Clear temp files for uploading
			if (req._uploading != null) req._uploading.then(r => r.clear());
			// Send returned data & end request
			if (resp.writableEnded === false) {
				if (controllerResponse == null) await resp.end();
				else await resp.send(controllerResponse);
			}
		}
	}
	/** Link events to websocket */
	ws(eventName: string | string[], cb: () => void): this {
		//TODO
		throw new Error('unimplemented!');
		return this;
	}
	/** Load routes using class representation */
	scan(path: string): void {
		throw new Error('Please use Gridfw-compiler to compile your project!');
	}
}

export * from './error';
export * from './schema/decorators';
export * from './http/request';
export * from './http/response';
export * from './helpers/i18n';
export * from './helpers/types';
