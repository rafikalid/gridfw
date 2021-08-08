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
import Bytes from 'bytes';
import { upload } from './utils/uploader';
import {tmpdir} from 'os';

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
	viewsDev?: (path:string, locale: string, data: any)=> string
	/** Views cache */
	viewsCache:{
		/** Max entries @default Infinity */
		max?:		number,
		/** Max bytes @default Infinity */
		maxBytes?:	number|string,
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
	/** Upload options */
	upload:{
		/** Upload timeout */
		timeout?: number|string
		/** Temp directory, @default os.dir */
		tempDir?: string
		/** Limit file */
		limits?: {
			/** Max field name size (in bytes) (Default: 255 bytes) */
			fieldNameSize?: number | string;
			/** Max field value size (in bytes) (Default: 1MB). */
			fieldSize?: number | string;
			/** Max number of non-file fields (Default: Infinity) */
			fields?: number;
			/** For multipart forms, the max file size (in bytes) (Default: Infinity) */
			fileSize?: number | string;
			/** For multipart forms, the max number of file fields (Default: Infinity). */
			files?: number;
			/** For multipart forms, the max number of file fields (Default: Infinity).  */
			parts?: number;
			/** For multipart forms, the max number of header key=>value pairs to parse Default: 2000 (same as node's http). */
			headerPairs?: number;
		}
	}
}

export interface ParsedOptions extends BOptions{
	/** Views cache */
	viewsCache:{
		/** Max entries @default Infinity */
		max?:		number,
		/** Max bytes @default Infinity */
		maxBytes?:	number,
		/** Time to live @default Infinity */
		ttl?:    	number,
		/** TTL check interval. @default 60s */
		ttlInterval?:    number
	}
	
	/**
	 * Trust proxy: ( type= IPv4 | IPv6 | IPv4/netmask | IPv6/netmask | type[] ) or resolverFx
	 * @example '127.0.0.1'
	 * @example ['127.0.0.0/255.0.0.0', '192.168.0.0/255.255.0.0']
	 * @example ['127.0.0.0/8', '10.0.0.0/8']
	 * @example function(address, level){ return level===0; }
	 */
	trustProxy: (addr: string, i: number) => boolean
	/** Etag generator */
	etag: (entity: string | Buffer | Etag.StatsLike, options?: Etag.Options | undefined)=> string
	/** Upload options */
	upload:{
		/** Upload timeout */
		timeout:	number,
		/** Temp directory, @default os.dir */
		tempDir:	string
		/** Limit file */
		limits: {
			/** Max field name size (in bytes) (Default: 255 bytes) */
			fieldNameSize: number;
			/** Max field value size (in bytes) (Default: 1MB). */
			fieldSize: number;
			/** Max number of non-file fields (Default: Infinity) */
			fields: number;
			/** For multipart forms, the max file size (in bytes) (Default: 10M) */
			fileSize: number;
			/** For multipart forms, the max number of file fields (Default: Infinity). */
			files: number;
			/** For multipart forms, the max number of file fields (Default: Infinity).  */
			parts: number;
			/** For multipart forms, the max number of header key=>value pairs to parse Default: 2000 (same as node's http). */
			headerPairs: number;
		}
	}
}

export const DEFAULT_OPTIONS: Omit<ParsedOptions, 'baseURL'|'pretty'| 'trustProxy'| keyof typeof ROUTER_DEFAULT_OPTIONS>= {
	isProd:		false,
	name:		undefined,
	author:		undefined,
	email:		undefined,
	version:	'0.0.0',

	protocol:	Protocols.http,
	listen:		undefined,
	logLevel:	LogLevels.warn,
	defaultLocale:	'en',
	cookieSecret:	'gfw',
	views:			'views',
	viewsDev:		undefined,
	/** Views cache */
	viewsCache: {
		max:			Infinity,
		maxBytes:		Infinity,
		ttl:    		Infinity,
		ttlInterval:    60000
	},
	encoding:	'utf-8',
	etag:		Etag,
	jsonpParam: 'cb',
	errors: {
		else: function(err: Error|GError){
			console.log('----- ERROR: ', err)
		}
	},
	/** Upload options */
	upload:{
		/** Upload timeout */
		timeout:	Infinity,
		/** Temp directory, @default os.dir */
		tempDir: tmpdir(),
		/** Limit file */
		limits: {
			/** Max field name size (in bytes) (Default: 255 bytes) */
			fieldNameSize: 255,
			/** Max field value size (in bytes) (Default: 1MB). */
			fieldSize: 2**20,
			/** Max number of non-file fields (Default: Infinity) */
			fields:	Infinity,
			/** For multipart forms, the max file size (in bytes) (Default: 10Mb) */
			fileSize:  10*2**20,
			/** For multipart forms, the max number of file fields (Default: Infinity). */
			files: Infinity,
			/** For multipart forms, the max number of file fields (Default: Infinity).  */
			parts: Infinity,
			/** For multipart forms, the max number of header key=>value pairs to parse Default: 2000 (same as node's http). */
			headerPairs: 2000
		}
	}
};

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

export function initOptions(options: Partial<Options>): ParsedOptions{
	var opts= {...ROUTER_DEFAULT_OPTIONS, ...DEFAULT_OPTIONS, ...options} as Options;
	opts.pretty??= opts.isProd;
	//* Etag
	if(opts.etag==null || opts.etag===true) opts.etag= Etag;
	else if(typeof opts.etag !== 'function') throw new GError(ErrorCodes.OPTIONS, 'Illegal value for "etag" option');
	//* Trust proxy
	if(opts.trustProxy==null){
		opts.trustProxy= ProxyAddr.compile('127.0.0.1');
	} else if(typeof opts.trustProxy!=='function'){
		opts.trustProxy= ProxyAddr.compile(opts.trustProxy!);
	}
	//* Uploads
	if(opts.upload!==DEFAULT_OPTIONS.upload){
		opts.upload= {...DEFAULT_OPTIONS.upload, ...opts.upload};
		if(opts.upload.limits!==DEFAULT_OPTIONS.upload.limits){
			opts.upload.limits= uploadLimits({...DEFAULT_OPTIONS.upload.limits, ...opts.upload.limits});
		}
	}
	return opts as ParsedOptions;
}

export function uploadLimits(limits: NonNullable<Options['upload']['limits']>): ParsedOptions['upload']['limits']{
	// fieldNameSize
	if(typeof limits.fieldNameSize === 'string')
		limits.fieldNameSize= Bytes(limits.fieldNameSize);
	else limits.fieldNameSize??= 255;
	// fieldSize
	if(typeof limits.fieldSize === 'string') limits.fieldSize= Bytes(limits.fieldSize);
	// fileSize
	if(typeof limits.fileSize === 'string') limits.fileSize= Bytes(limits.fileSize);
	else limits.fileSize ??= 10 * 2**20; // 10Mb
	return limits as ParsedOptions['upload']['limits'];
}