import type {IncomingMessage, ServerResponse} from 'http';
import type { Gridfw } from '.';
import ProxyAddr from 'proxy-addr';
import {parse as ContentTypeParse, ParsedMediaType} from 'content-type';
import {AES as AESCrypto} from 'crypto-js';
import CookieLib, { CookieSerializeOptions } from 'cookie';
import Accepts from 'accepts';
import EncodeURL from 'encodeurl';
import { render } from './utils/render';
import XMLConverter from 'xml-js';
import Send from 'send';
import ContentDisposition from 'content-disposition';
import {basename} from 'path';
import { ErrorCodes, GError } from './error';
import OnFinishedLib from 'on-finished';
import ParseMilliseconds from 'ms';
import {lookup as mimeTypeLookup} from 'mime-types';
import CheckFresh from 'fresh';
const {create}= Object

/** Context object */
export class Context<TSession, TI18n>{
	readonly app: Gridfw<TSession, TI18n>
	readonly req: IncomingMessage
	readonly res: ServerResponse
	/** Current timestamp */
	readonly now: number

	/** I18n map */
	i18n?: TI18n
	/** Current used locale */
	private _locale: string

	//* Route metadata
	routeNode:	any //TODO set routeNode type

	//* Response metadata
	/** Response content length */
	contentLength: number=	0
	/** Response content type */
	contentType?:	string=	undefined
	/** Response encoding */
	encoding:		BufferEncoding= 'utf-8'
	/** Response Status code */
	statusCode: number= 200
	/** Response status message */
	statusMessage: string= 'OK';

	//* Request metadata
	/** Resolved Cookies Params */
	cookies:	Map<string, any>= new Map();
	/** Resolved Query Params */
	query:		Map<string, any>= new Map();
	/** Resolved Path Params  */
	params:		Map<string, any>= new Map();

	/** Common views data */
	data: Record<string, any>

	/** Session */
	session: TSession

	/** Uploading promsie */
	private _uploading?: Promise<any>= undefined;

	//TODO set type to routeNode
	constructor(app: Gridfw<TSession, TI18n>, routeNode: any, session: TSession, req: IncomingMessage, res: ServerResponse){
		this.app= app;
		this.req= req;
		this.res= res;
		this.now= Date.now();
		this.data= create(app.data);
		//TODO parse cookies
		//* Route metadata
		this.routeNode= routeNode;
		this.session= session;
		//* I18n
		this._locale= app.defaultLocale;
	}

	/** Current URL */
	get url(): URL{
		return new URL(this.req.url!, this.app.baseURL);
	}

	/** Method */
	get method(){ return this.req.method }
	get aborted(){ return this.req.aborted }
	get httpVersion(){ return this.req.httpVersion }
	get protocol():'http'|'https'|'http2'{
		// const req= this.req;
		// var h: string;
		// if(this.app.trustProxy(this, 0) && (h = req.headers['X-Forwarded-Proto'])){
		// } else {
		// }
		//TODO
		throw new Error('Unimplemented!');
	}

	/** If connection is secure */
	get secure(){
		var p= this.protocol;
		return p==='https' || p==='http2'
	}

	/** Client IP */
	get ip(){ return ProxyAddr(this.req, this.app.trustProxy) }
	/** Host */
	get hostname(){
		var req= this.req;
		if(this.app.trustProxy(req.socket.remoteAddress!, 0))
			return req.headers['x-forwarded-host'] ?? req.headers['host'];
		else return req.headers['host'];
		//TODO test it works
	}

	/** Check if request is made using Ajax */
	get xhr(): boolean{
		var h= this.req.headers['x-requested-with'];
		if(h==null) return false;
		else if(typeof h=== 'string')
			return h.toLocaleLowerCase() === 'xmlhttprequest'
		else if(Array.isArray(h)){
			for(let i=0, len= h.length; i<len; ++i)
				return h[i].toLocaleLowerCase() === 'xmlhttprequest'
			return false;
		} else return false;
	}

	/** Requested data type */
	get reqContentType(): ParsedMediaType | undefined{
		var h= this.req.headers['content-type'];
		if(h) return ContentTypeParse(h);
	}
	/** Request headers */
	get reqHeaders(){
		return this.req.headers;
	}

	/** Set cookie */
	setCookie(name:string, value: string, options?: CookieSerializeOptions){
		if(options) options.path ??= '/';
		else options= {path: '/'};
		// Serialize value
		if(typeof value === 'string')	value= '.' + value;
		else if(value == null)			value= '.';
		else							value = 'j'+ JSON.stringify(value);
		// Crypt value
		value = AESCrypto.encrypt(value, this.app._cookieSecret).toString();
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
		this.cookies.forEach((v, name)=>{
			cookies.push(CookieLib.serialize(name, '.', options));
		});
		this.addHeader('Set-Cookie', cookies);
		return this;
	}

	//* RESPONSE HEADERS
	/** Add header */
	addHeader(name: string, value: string|readonly string[]){
		var res= this.res;
		// Previous headers
		var headers= res.getHeader(name);
		if(headers==null) headers= []
		else if(!Array.isArray(headers)) headers= [];
		// Push new headers
		if(Array.isArray(value)) headers.push(...value);
		else headers.push(value as string);
		return this;
	}
	/** Set response header */
	setHeader(name: string, value: number | string | readonly string[]){
		this.res.setHeader(name, value);
		return this;
	}
	/** Get response header by name */
	getHeader(name: string){ return this.res.getHeader(name) }
	/** Response headers */
	get headers(){ return this.res.getHeaders() }
	/** has response header */
	hasHeader(name: string){ return this.res.hasHeader(name); }
	/** If headers are sent */
	get headersSent(){ return this.res.headersSent; }
	/** Accepts */
	private _accepts: Accepts.Accepts|undefined= undefined;
	/**
	 * Return the first accepted charset. If nothing in `charsets` is accepted, then `false` is returned.
	 * If no charsets are supplied, all accepted charsets are returned, in the order of the client's preference
	 * (most preferred first).
	 */
	reqCharset(charsets?: string[]){
		var a= this._accepts ??= Accepts(this.req);
		return charsets==null? a.charset() : a.charset(charsets);
	}
	/**
	 * Return the first accepted type (and it is returned as the same text as what appears in the `types` array). If nothing in `types` is accepted, then `false` is returned.
	 * If no types are supplied, return the entire set of acceptable types.
	 *
	 * The `types` array can contain full MIME types or file extensions. Any value that is not a full MIME types is passed to `require('mime-types').lookup`.
	 */
	accepts(types: string[]){
		var a= this._accepts ??= Accepts(this.req);
		return a.types(types);
	}
	/**
	 * Return the first accepted encoding. If nothing in `encodings` is accepted, then `false` is returned.
	 * If no encodings are supplied, all accepted encodings are returned, in the order of the client's preference
	 * (most preferred first).
	 */
	reqEncoding(encodings?: string[]){
		var a= this._accepts ??= Accepts(this.req);
		return encodings==null? a.encodings() : a.encodings(encodings);
	}
	/**
	 * Return the first accepted language. If nothing in `languages` is accepted, then `false` is returned.
	 * If no languaes are supplied, all accepted languages are returned, in the order of the client's preference
	 * (most preferred first).
	 */
	reqLanguage(languages?: string[]){
		var a= this._accepts ??= Accepts(this.req);
		return languages==null? a.language() : a.language(languages);
	}
	/** Check if client supports image/webp */
	acceptsWebp(): boolean{
		var a= this._accepts ??= Accepts(this.req);
		return !!a.type(ContentTypes.webp);
	}

	//* I18N
	/** Get current locale */
	get locale(){ return this._locale; }
	/**
	 * Set context locale
	 * If no argument, use userAgent preferred locale or default locale.
	 */
	async setLocale(locale?: string){
		var app= this.app;
		if(locale==null){
			locale= (this.reqLanguage(Array.from(app.locales)) || app.defaultLocale) as string;
		}
		var map= await app.getLocale(locale);
		this._locale= locale;
		this.i18n= map;
		return locale;
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
		var url= this.req.headers.referer;
		if(url && (url !== this.url.href) && url.startsWith(baseUrl)){}
		else url= baseUrl;
		return this.goto(url);
	}

	/** Render and send view */
	async render(path: string, data?: Record<string, any>){
		var app= this.app;
		data= data==null? this.data : {...this.data, ...data};
		var html= await render(app._viewCache, app._viewsPath, this.locale, path, data);
		return this.send(html, ContentTypes.html);
	}

	/** Send JSON */
	json(data: any){
		// Serialize
		data= this.app.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
		// Send
		return this.send(data, ContentTypes.json);
	}
	/** JSON-P */
	jsonp(data:any){
		// Serialize
		var app= this.app;
		data= app.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
		data= `${this.query.get(app.jsonpParam)??'cb'}(${data})`;
		// Send
		return this.send(data, ContentTypes.js);
	}

	/** Send XML */
	xml(data: any){
		data= XMLConverter.js2xml(data, {spaces: this.app.pretty ? "\t" : 0});
		return this.send(data, ContentTypes.xml);
	}

	/**
	 * Check if the request is fresh, aka
	 * Last-Modified and/or the ETag
	 * still match.
	 * @return {boolean}
	 */
	get fresh(){
		var statusCode= this.statusCode;
		var method= this.method;
		if(
			(method==='GET' || method==='HEAD')
			&& (
				(statusCode >= 200 && statusCode < 300)
				|| statusCode === 304
			)
		){
			return CheckFresh(this.req.headers, this.res.getHeaders());
		}
		return false;
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
				OnFinishedLib(this.res, function(err){
					if(err) rej(err);
					else if(streaming) rej(new GError(ErrorCodes.SEND_FILE_ABORTED, `File sending aborted: ${filePath}`));
					else res(true);
				});
				//TODO check if add headers or not
				//* Pipe file
				file.pipe(this.res);
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
			var statusCode= this.statusCode;
			var app= this.app;
			const res= this.res;
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
						data= app.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
						data= `${this.query.get(app.jsonpParam)??'cb'}(${data})`;
						break;
					case ContentTypes.xml:
						data= XMLConverter.js2xml(data, {spaces: this.app.pretty ? "\t" : 0});
						break;
					case undefined:
						contentType= ContentTypes.json;
					case ContentTypes.json:
						data= app.pretty ? JSON.stringify(data, null, "\t") : JSON.stringify(data);
						break;
					default:
						throw new GError(ErrorCodes.InternalError, `Enexpected content type: ${contentType}`);
				}
				data= Buffer.from(data, encoding);
			}
			//* Calc Etag
			if(!this.hasHeader('ETag')) this.setHeader('ETag', app.etag(data as Buffer));
			//* freshness
			if(this.fresh) statusCode = 304;
			//* Status code
			res.statusCode= statusCode;
			res.statusMessage= this.statusMessage;
			//* send
			if(statusCode===304 || statusCode === 204){
				//* Not Modified, No Content
				res.removeHeader('Content-Type');
				res.removeHeader('Content-Length');
				res.removeHeader('Transfer-Encoding');
				res.end(resolve);
			} else {
				// populate Content-Length
				res.setHeader('Content-Length', data.length);
				// Content type
				res.setHeader('Content-Type', encoding==null? contentType : `${contentType}; charset=${encoding}`);
				if(this.method === 'HEAD')
					res.end(resolve);
				else {
					//@ts-ignore
					res.end(data, encoding, resolve);
				}
			}
		});
	}

	end(){
		return new Promise((resolve, rej)=>{
			var res= this.res;
			res.statusCode= this.statusCode;
			res.statusMessage= this.statusMessage;
			res.end(resolve);
		});
	}
}

export interface SendFileOptions extends Send.SendOptions {
	/**
	 * File name
	 */
	name?: string
	/** If send file as INLINE or ATTACHEMENT @default true */
	inline?: boolean
}

/** Content types */
export enum ContentTypes{
	binary=			'application/octet-stream',
	text=			'text/plain',
	html=			'text/html',
	js=				'application/javascript',
	css=			'text/css',
	xml=			'application/xml',
	json=			'application/json',
	jpeg=			'image/jpeg',
	png=			'image/png',
	webp=			'image/webp',
	multipart=		'multipart/form-data',
	formUrlEncoded=	'application/x-www-form-urlencoded'
}