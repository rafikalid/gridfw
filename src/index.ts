import Http2 from 'http2';
import type { Options } from './options';
/**
 * Gridfw
 */
export class Gridfw{
	/** Underlying http2 server  */
	readonly server: Http2.Http2Server | Http2.Http2SecureServer;
	/** If this is a secure connection */
	readonly secure:	boolean

	/** Listen options */
	private _listenOptions: Options['listen'];

	constructor(options?: Options){
		//* Listen options
		this._listenOptions= options?.listen;
		//* create server
		var serverOptions= options?.server;
		if (serverOptions==null){
			this.server = Http2.createServer();
			this.secure = false;
		} else if (serverOptions.cert){
			this.server= Http2.createSecureServer(serverOptions);
			this.secure= true;
		} else {
			this.server = Http2.createServer(serverOptions);
			this.secure = false;
		}
		//* Listen to streams
		this.server.on('stream', function (stream, headers) {
			console.log('--- received request');
			stream.respond({
				'content-type': 'text/html; charset=utf-8',
				':status': 200
			});
			stream.end('<b>It works!</b>');
		});
	}

	/**
	 * Start listening
	 */
	listen(){
		const server= this.server;
		server.listen(this._listenOptions)
	}
}