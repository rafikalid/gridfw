import CookieLib, { CookieSerializeOptions } from 'cookie';
import {ServerResponse, IncomingMessage} from 'http';
import {AES as AESCrypto} from 'crypto-js';
import Send from 'send';
import EncodeURL from 'encodeurl';
import XMLConverter from 'xml-js';
import CheckFresh from 'fresh';
import {basename} from 'path';
import ContentDisposition from 'content-disposition';
import OnFinishedLib from 'on-finished';
import ParseMilliseconds from 'ms';
import {lookup as mimeTypeLookup} from 'mime-types';
import { Gridfw } from '..';
import { ContentTypes, I18nInterface, Request } from './request';
import { ErrorCodes, GError } from '@src/error';

/**
 * HTTP1.1 server response
 */
export class Response<TSession, TI18n extends I18nInterface> extends ServerResponse{
	/** Current app */
	readonly app!: Gridfw<TSession, TI18n>;
	readonly req: Request<TSession, TI18n>;
	
	/** I18n map */
	i18n?: TI18n

	/** Common views data */
	data: ResponseData<TSession, TI18n>

	/** Response content type */
	contentType?:	string=	undefined
	/** Response encoding */
	encoding:		BufferEncoding= 'utf-8'

	constructor(req: Request<TSession, TI18n>){
		super(req as IncomingMessage);
		this.req= req;
		// Data, "app" will be injected later
		this.data= {
			app:	undefined,
			i18n:	undefined,
			req:	req,
			res:	this,
			now:	req.now
		} as any as ResponseData<TSession, TI18n>
	}
	
	/**
	 * Check if the request is fresh, aka
	 * Last-Modified and/or the ETag
	 * still match.
	 * @return {boolean}
	 */
	 get fresh(){
		var statusCode= this.statusCode;
		var method= this.req.method;
		if(
			(method==='GET' || method==='HEAD')
			&& (
				(statusCode >= 200 && statusCode < 300)
				|| statusCode === 304
			)
		){
			return CheckFresh(this.req.headers, this.getHeaders());
		}
		return false;
	}
	
	//* COOKIES
	/** Set cookie */
	setCookie(name:string, value: string, options?: CookieSerializeOptions){
		if(options) options.path ??= '/';
		else options= {path: '/'};
		// Serialize value
		if(typeof value === 'string')	value= '.' + value;
		else if(value == null)			value= '.';
		else							value = 'j'+ JSON.stringify(value);
		// Crypt value
		value = AESCrypto.encrypt(value, this.app.options.cookieSecret).toString();
		this.addHeader('Set-Cookie', CookieLib.serialize(name, value, options));
		return this;
	}
	/** Request Cookie remove from client */
	clearCookie(name: string, options?: CookieSerializeOptions){
		if(options) options.expires= new Date(1);
		else options= {expires: new Date(1)};
		this.addHeader('Set-Cookie', CookieLib.serialize(name, '.', options));
		return this;
	}
	/** Remove all cookies */
	clearCookies(options?: CookieSerializeOptions){
		if(options) options.expires= new Date(1);
		else options= {expires: new Date(1)};
		var cookies: string[]= [];
		this.req.cookies.forEach((v, name)=>{
			cookies.push(CookieLib.serialize(name, '.', options));
		});
		this.addHeader('Set-Cookie', cookies);
		return this;
	}

	//* RESPONSE HEADERS
	/** Add header */
	addHeader(name: string, value: string|readonly string[]){
		// Previous headers
		var headers= this.getHeader(name);
		if(headers==null) headers= []
		else if(!Array.isArray(headers)) headers= [];
		// Push new headers
		if(Array.isArray(value)) headers.push(...value);
		else headers.push(value as string);
		return this;
	}

	
	//* REDIRECTS
	/**  Send redirect URL */
	goto(url: string|URL){
		if(typeof url!= 'string') url= url.href;
		this.setHeader('location', EncodeURL(url));
		this.statusCode= 302;
		return this.end();
	}
	/** Informe the user agent to always go to this URL and never ask again */
	goPermanentTo(url: string|URL){
		if(typeof url!= 'string') url= url.href;
		this.setHeader('location', EncodeURL(url));
		this.statusCode= 301;
		return this.end();
	}
	/** Redirect back (go back to referer) */
	goBack(){
		var baseUrl= this.app.baseURL.href;
		var req= this.req;
		var url= req.headers.referer;
		if(url && (url !== req.URL.href) && url.startsWith(baseUrl)){}
		else url= baseUrl;
		return this.goto(url);
	}

	/** Render and send view */
	async render(path: string, data?: Record<string, any>){
		if(this.i18n==null)
			throw new GError(ErrorCodes.MISSING_I18N, 'res.render>> Expected i18n');
		var html= await this.app._render(this.i18n.locale, path, this.data, data);
		return this.send(html, ContentTypes.html);
	}
	
	/** Send JSON */
	json(data: any){
		// Serialize
		data= this.app.options.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
		// Send
		return this.send(data, ContentTypes.json);
	}
	/** JSON-P */
	jsonp(data:any, callbackName?: string){
		// Serialize
		var options= this.app.options;
		data= options.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
		data= `${callbackName ?? this.req.query.get(options.jsonpParam) ?? 'cb'}(${data})`;
		// Send
		return this.send(data, ContentTypes.js);
	}

	/** Send XML */
	xml(data: any){
		data= XMLConverter.js2xml(data, {spaces: this.app.options.pretty ? "\t" : 0});
		return this.send(data, ContentTypes.xml);
	}
	
	/**
	 * Send file
	 * @param {string} path - file path
	 * @param {Boolean} options.inline - Inline or attachement
	 * @param {String} options.name - override file name
	 * @param {Object} options - npm send options @see https://www.npmjs.com/package/send
	 */
	 sendFile(filePath: string|Buffer, options: SendFileOptions){
		if(typeof filePath === 'string')
			return new Promise((res, rej)=>{
				// File name
				const fileName= options.name ?? basename(filePath);
				// Content disposition
				this.setHeader('content-disposition', ContentDisposition(fileName, {type: options.inline===false ? 'attachment' : 'inline'}));
				// send
				var streaming = false;
				const file= Send(this.req, filePath, options);
				file.on('directory', function(){ rej(new GError(ErrorCodes.EXPECTED_FILE_GOT_DIRECTORY, `Expected file not directory at: ${filePath}`, filePath)) });
				file.on('stream', function(){ streaming= true; });
				file.on('file', function(){ streaming= false; });
				file.on('end', function(){ streaming= false; });
				file.on('error', function(err){
					if(err==null)
						err= new GError(ErrorCodes.UNKOWN_ERROR, 'Unknown error at ::sendFile');
					else if(err.status===404)
						err= new GError(ErrorCodes.FILE_NOT_FOUND, `Missing file: ${filePath}`, err);
					else
						err= new GError(ErrorCodes.SEND_FILE_ERR, `Error when sending file: ${filePath}`, err);
					rej(err);
				});
				OnFinishedLib(this, function(err){
					if(err) rej(err);
					else if(streaming) rej(new GError(ErrorCodes.SEND_FILE_ABORTED, `File sending aborted: ${filePath}`));
					else res(true);
				});
				//TODO check if add headers or not
				//* Pipe file
				file.pipe(this);
			});
		else {
			// File name
			var fileName= options.name;
			// Content type
			this.contentType??= fileName && mimeTypeLookup(fileName) || undefined;
			// Content disposition
			this.setHeader('Content-Disposition', ContentDisposition(fileName ?? 'untitled', {type: options.inline===false? 'attachment' :'inline'}));
			// Max age
			var maxAge= options?.maxAge;
			if(maxAge==null){}
			else{
				if(typeof maxAge === 'string') maxAge= (ParseMilliseconds(maxAge)/1000)>>0;
				this.setHeader('Cache-Control', `public, max-age: ${maxAge}`);
			}
			return this.send(filePath);
		}
	}
	/** Send file as attachement */
	download(filePath: string|Buffer, options: SendFileOptions){
		if(options==null) options= { inline: false };
		else options.inline??= false;
		return this.sendFile(filePath, options);
	}

	/** Send  */
	send(data: string|Buffer|Record<string, any>, contentType?: string){
		return new Promise((resolve, reject)=>{
			var encoding = this.encoding;
			contentType??= this.contentType;
			var options= this.app.options;
			var req= this.req;
			// Convert to Buffer
			if(typeof data==='string'){
				//* String
				contentType ??= ContentTypes.html;
				data= Buffer.from(data, encoding);
			} else if(Buffer.isBuffer(data)){
				contentType ??= ContentTypes.binary;
			} else {
				switch(contentType){
					case ContentTypes.js:
						data= options.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
						data= `${req.query.get(options.jsonpParam)??'cb'}(${data})`;
						break;
					case ContentTypes.xml:
						data= XMLConverter.js2xml(data, {spaces: options.pretty ? "\t" : 0});
						break;
					case undefined:
						contentType= ContentTypes.json;
					case ContentTypes.json:
						data= options.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
						break;
					default:
						throw new GError(ErrorCodes.InternalError, `Enexpected content type: ${contentType}`);
				}
				data= Buffer.from(data, encoding);
			}
			//* Calc Etag
			if(!this.hasHeader('etag'))
				this.setHeader('etag', (options.etag as Function)(data as Buffer));
			//* freshness
			if(this.fresh) this.statusCode = 304;
			//* Status code
			var statusCode= this.statusCode;
			//* send
			if(statusCode===304 || statusCode === 204){
				//* Not Modified, No Content
				this.removeHeader('Content-Type');
				this.removeHeader('Content-Length');
				this.removeHeader('Transfer-Encoding');
				// @ts-ignore
				super.end(resolve);
			} else {
				// populate Content-Length
				this.setHeader('Content-Length', data.length);
				// Content type
				this.setHeader('Content-Type', encoding==null? contentType : `${contentType}; charset=${encoding}`);
				if(req.method === 'HEAD')
					return super.end(resolve);
				else {
					//@ts-ignore
					return super.end(data, encoding, resolve);
				}
			}
		});
	}

	end(){
		return new Promise((resolve)=>{
			super.end(resolve);
		});
	}
	
}

export interface ResponseData<TSession, TI18n extends I18nInterface>{
	app:	Gridfw<TSession, TI18n>,
	i18n?:	TI18n
	req:	Request<TSession, TI18n>
	res:	Response<TSession, TI18n>
	now:	number
	[k:string]: any
}

export interface SendFileOptions extends Send.SendOptions {
	/**
	 * File name
	 */
	name?: string
	/** If send file as INLINE or ATTACHEMENT @default true */
	inline?: boolean
}
