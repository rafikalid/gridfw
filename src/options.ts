import Http2 from 'http2';
import type Net from 'net';
/**
 * Gridfw options
 */
export interface Options{
	/** Server options */
	server?: Http2.SecureServerOptions & Http2.ServerOptions
	/** Listening options */
	listen?: Net.ListenOptions
}
