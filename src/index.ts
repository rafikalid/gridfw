import Http from 'http';
import Https from 'https';
import Http2 from 'http2';
import type Net from 'net';
import {readFileSync} from 'fs';
import { handleRequest } from './handle-request';
import { Https_Options, Options, Protocols } from './options';
import { IncomingMessage } from './http/incoming-message';
import { ServerResponse } from './http/server-response';
// import GridfwRouter from 'gridfw-tree-router';
/**
 * Gridfw
 */
export class Gridfw{
	/** Framework version */
	static version= JSON.parse(readFileSync('package.json', 'utf-8')).version
	/** Underlying http2 server  */
	readonly server: Http2.Http2SecureServer|Http.Server;
	/** If this is a secure connection */
	readonly secure:	boolean
	/** Check used protocol */
	readonly protocol:	Protocols

	/** Server IP */
	ip?:		string
	/** Server Ip Type */
	ipType?: 	string
	/** Server port */
	port?:		number

	/** Listen options */
	private _listenOptions: Options['listen'];

	constructor(options?: Options){
		options= {...options} as Options;
		//* Listen options
		this._listenOptions= options.listen;
		this.protocol= options.protocol ?? Protocols.http;
		//* Options
		//* create server
		switch(this.protocol){
			case Protocols.http:
				// HTTP 1.1
				this.secure= false;
				this.server= Http.createServer({
					IncomingMessage: IncomingMessage,
					ServerResponse: ServerResponse
				});
				break;
			case Protocols.https:
				// HTTPs 1.1
				this.secure= true;
				let httpsOptions= (options as Https_Options).server;
				if(httpsOptions==null || httpsOptions.cert==null)
					throw new Error('Expected SSL/TLS certificat for HTTP2');
				if(httpsOptions.IncomingMessage!=null)
					throw new Error('Enexpected server options: IncomingMessage');
				if(httpsOptions.ServerResponse!=null)
					throw new Error('Enexpected server options: ServerResponse');
				this.server= Https.createServer();
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
		// Listener
		this.server.on('request', handleRequest.bind(this));
	}

	/**
	 * Start listening
	 */
	listen(){
		const server= this.server;
		server.listen(this._listenOptions);
		// server.on('error', function(err: any){
		// 	console.log('error>> ', err);
		// });
		// console.log('--- listen: ', this.secure);
		//* Data
		var a= server.address() as Net.AddressInfo;
		this.port= a.port;
		this.ip= a.address;
		this.ipType= a.family;
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
		console.log('Gridfw 3.0');
	}
}