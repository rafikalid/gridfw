import type Http2 from 'http2';
import type Https from 'https';
import type Net from 'net';
import Etag from 'etag';
import ProxyAddr from 'proxy-addr';
import { LogLevels } from './utils/log';
import { ErrorCodes, GError } from './error';
// TODO import from root package
import {Options as RouterOptions, DEFAULT_OPTIONS as ROUTER_DEFAULT_OPTIONS} from 'gridfw-tree-router';
import { RenderFx } from './utils/render';

/** Supported http protocols */
export enum Protocols{
	http,
	https,
	http2
}


/**
 * Gridfw options
 */
export type Options= Http_Options | Https_Options | Http2_Options;
export interface BOptions extends RouterOptions{
	/** is production mode */
	isProd:		boolean
	/**
	 * Pretty rendring: useful for dev
	 * @default true in DEV mode, false when PROD
	 */
	pretty: boolean
	/** App name */
	name?: string
	/** Author */
	author?: string
	/** Author email */
	email?: string
	/** app version */
	version?: string

	/** Base URL */
	baseURL:	URL

	/** Used protocol */
	protocol:	Protocols
	/** Listening options */
	listen?:	Net.ListenOptions
	/** Log level */
	logLevel:	LogLevels
	/** i18n: Default locale */
	defaultLocale: string
	
	/** Cookie options */
	cookieSecret: string
	// cookie?: {
	// 	/** Cookie crypt salt */
	// 	secret: string
	// }
	/** Views path for prod mode */
	views: string
	/** Generate views in dev mode */
	viewsDev: (path:string, locale: string, data: any)=> string
	/** Views cache */
	viewsCache:{
		/** Max entries @default Infinity */
		max?:		number,
		/** Max bytes @default Infinity */
		maxBytes?:	number,
		/** Time to live @default Infinity */
		ttl?:    	number|string,
		/** TTL check interval. @default 60s */
		ttlInterval?:    number|string
	}

	/**
	 * Trust proxy: ( type= IPv4 | IPv6 | IPv4/netmask | IPv6/netmask | type[] ) or resolverFx
	 * @example '127.0.0.1'
	 * @example ['127.0.0.0/255.0.0.0', '192.168.0.0/255.255.0.0']
	 * @example ['127.0.0.0/8', '10.0.0.0/8']
	 * @example function(address, level){ return level===0; }
	 */
	trustProxy: string | string[] | ((addr: string, i: number) => boolean)

	/** Default encoding */
	encoding: BufferEncoding
	/** Etag generator */
	etag: boolean | ((entity: string | Buffer | Etag.StatsLike, options?: Etag.Options | undefined)=> string)
	
	/** JSONP Callback query param */
	jsonpParam: string

	/** Error management */
	errors: {
		[k: number]: (err: Error|GError)=> void
		else: (err: Error|GError)=> void
	}
}

/** HTTP 1.1 options */
export interface Http_Options extends BOptions{
	protocol: Protocols.http
}
export interface Https_Options extends BOptions{
	protocol: Protocols.https
	/** server options */
	server: Https.ServerOptions
}

/** HTTP2 options */
export interface Http2_Options extends BOptions{
	protocol: Protocols.http2
	/** Server options */
	server: Http2.SecureServerOptions
}

export function initOptions(options: Partial<Options>): Options{
	var result= {...ROUTER_DEFAULT_OPTIONS, ...options} as Options;
	result.isProd??= false;
	result.pretty??= result.isProd;
	//* Protocol
	options.protocol??= Protocols.http;
	//* default locale
	options.defaultLocale ??= 'en';
	//* Etag
	if(result.etag==null || result.etag===true) result.etag= Etag;
	else if(typeof result.etag !== 'function') throw new GError(ErrorCodes.OPTIONS, 'Illegal value for "etag" option');
	//* Trust proxy
	if(options.trustProxy==null){
		options.trustProxy= ProxyAddr.compile('127.0.0.1');
	} else if(typeof options.trustProxy!=='function'){
		options.trustProxy= ProxyAddr.compile(options.trustProxy!);
	}
	return result;
}