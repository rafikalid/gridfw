import type Http2 from 'http2';
import type Https from 'https';
import type Net from 'net';

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
	/** Used protocol */
	protocol?: Protocols
	/** Listening options */
	listen?: Net.ListenOptions
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
	server?: Http2.SecureServerOptions
}