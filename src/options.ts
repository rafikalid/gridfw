import type Http2 from 'http2';
import type Https from 'https';
import type Net from 'net';
import { LogLevels } from './utils/log';

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
export interface BOptions{
	/** is production mode */
	isProd?:		boolean
	/**
	 * Pretty rendring: useful for dev
	 * @default true in DEV mode, false when PROD
	 */
	pretty?: boolean
	/** App name */
	name?: string
	/** Author */
	author?: string
	/** Author email */
	email?: string
	/** app version */
	version?: string

	/** Base URL */
	baseURL?:	URL

	/** Used protocol */
	protocol?:	Protocols
	/** Listening options */
	listen?:	Net.ListenOptions
	/** Log level */
	logLevel?:	LogLevels
	/** i18n: Default locale */
	defaultLocale?: string
	
	/** Cookie options */
	cookieSecret?: string
	// cookie?: {
	// 	/** Cookie crypt salt */
	// 	secret: string
	// }
	/** Views folder path */
	views: string

	/**
	 * Trust proxy: ( type= IPv4 | IPv6 | IPv4/netmask | IPv6/netmask | type[] ) or resolverFx
	 * @example '127.0.0.1'
	 * @example ['127.0.0.0/255.0.0.0', '192.168.0.0/255.255.0.0']
	 * @example ['127.0.0.0/8', '10.0.0.0/8']
	 * @example function(address, level){ return level===0; }
	 */
	trustProxy: string | string[] | ((addr: string, i: number) => boolean)

	
	/** JSONP Callback query param */
	jsonpParam?: string
}

/** HTTP 1.1 options */
export interface Http_Options extends BOptions{
	protocol?: Protocols.http
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