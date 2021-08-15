import {IncomingMessage} from 'http';
import Accepts from 'accepts';
import {Socket} from 'net';
import ProxyAddr from 'proxy-addr';
import {parse as ContentTypeParse, ParsedMediaType} from 'content-type';
import RangeParser from 'range-parser';
import { Gridfw } from '..';
import { getBody, upload, UploadResult } from '../utils/uploader';
import { Options, UploadLimits, uploadOptions } from '@src/options';
import { ErrorCodes, GError } from '@src/error';
import { LogLevels, setLogLevel, voidLog } from '@src/utils/log';
import { QueryMap } from '@src/utils/query-params';

/**
 * HTTP1.1 request
 */
export class Request<TSession, TI18n extends I18nInterface> extends IncomingMessage{
	readonly app!: Gridfw<TSession, TI18n>;
	/** Uploading promsie */
	_uploading?: Promise<UploadResult>= undefined;
	_uploadBuffer?: Promise<Buffer|string>= undefined;
	/** Accepts */
	private _accepts: Accepts.Accepts|undefined= undefined;
	/** Current app */
	//@ts-ignore
	readonly app: Gridfw<TSession, TI18n>

	/** Current timestamp */
	readonly now: number
	/** I18n map */
	i18n?: TI18n

	/** Resolved Cookies Params */
	cookies!:	RequestParams<string>;
	/** Resolved Path Params  */
	params!:	RequestParams<string>;
	/** Path name */
	pathname!:	string
	/** Raw query */
	rawQuery!:	string

	/** Session */
	session?: TSession
	
	/** Selected route node: will be injected later */
	routeNode:	any //TODO set routeNode type

	constructor(socket: Socket){
		super(socket);
		this.now= Date.now();
	}

	/** Resolved Query Params */
	private _query?: RequestParams<string>= undefined;
	get query(): RequestParams<string>{
		return this._query ??= new QueryMap(this, this.rawQuery);
	}

	//* Log
	/** Log: Debug */
	debug:	(tag: string, message: any)=> this	=	voidLog;
	info:	(tag: string, message: any)=> this	=	voidLog;
	warn:	(tag: string, message: any)=> this	=	voidLog;
	error:	(tag: string, message: any)=> this	=	voidLog;
	fatalError:	(tag: string, message: any)=> this= voidLog;
	private _logLevel:	LogLevels= LogLevels.debug;
	getLogLevel(){ return this._logLevel; }
	setLogLevel: (level: LogLevels)=> this		= setLogLevel;

	/** Get full URL */
	get URL(){
		return new URL(this.url!, this.app.baseURL);
	}

	/** Used protocol */
	get protocol():'http'|'https'|'http2'{
		//TODO get protocol from Proxy
		// if(this.app.trustProxy(this, 0) && (h = req.headers['X-Forwarded-Proto'])){}
		throw new Error('Unimplemented!');
	}
	/** If connection is secure */
	get secure(){
		var p= this.protocol;
		return p==='https' || p==='http2'
	}
	/** Client IP */
	get ip(){ return ProxyAddr(this, this.app.options.trustProxy) }
	
	/** Host: Maybe no need for this */
	// get hostname(){
	// 	var req= this.req;
	// 	if(this.app.trustProxy(req.socket.remoteAddress!, 0))
	// 		return req.headers['x-forwarded-host'] ?? req.headers['host'];
	// 	else return req.headers['host'];
	// 	//TODO test it works
	// }

	/** Check if request is made using Ajax */
	get xhr(): boolean{
		var h= this.headers['x-requested-with'];
		if(h==null) return false;
		else if(typeof h=== 'string')
			return h.toLocaleLowerCase() === 'xmlhttprequest'
		else if(Array.isArray(h)){
			for(let i=0, len= h.length; i<len; ++i)
				return h[i].toLocaleLowerCase() === 'xmlhttprequest'
			return false;
		} else return false;
	}
	/** Content type */
	get contentType(): ParsedMediaType | undefined{
		var h= this.headers['content-type'];
		if(h) return ContentTypeParse(h);
	}

	/**
	 * Return the first accepted type (and it is returned as the same text as what appears in the `types` array). If nothing in `types` is accepted, then `false` is returned.
	 * If no types are supplied, return the entire set of acceptable types.
	 *
	 * The `types` array can contain full MIME types or file extensions. Any value that is not a full MIME types is passed to `require('mime-types').lookup`.
	 */
	 accepts(types: string[]){
		var a= this._accepts ??= Accepts(this);
		return a.types(types);
	}
	/**
	 * Return the first accepted charset. If nothing in `charsets` is accepted, then `false` is returned.
	 * If no charsets are supplied, all accepted charsets are returned, in the order of the client's preference
	 * (most preferred first).
	 */
	acceptsCharset(charsets?: string[]){
		var a= this._accepts ??= Accepts(this);
		return charsets==null? a.charset() : a.charset(charsets);
	}
	/**
	 * Return the first accepted encoding. If nothing in `encodings` is accepted, then `false` is returned.
	 * If no encodings are supplied, all accepted encodings are returned, in the order of the client's preference
	 * (most preferred first).
	 */
	acceptsEncoding(encodings?: string[]){
		var a= this._accepts ??= Accepts(this);
		return encodings==null? a.encodings() : a.encodings(encodings);
	}
	/**
	 * Return the first accepted language. If nothing in `languages` is accepted, then `false` is returned.
	 * If no languaes are supplied, all accepted languages are returned, in the order of the client's preference
	 * (most preferred first).
	 */
	acceptsLanguages(languages?: string[]){
		var a= this._accepts ??= Accepts(this);
		return languages==null? a.language() : a.language(languages);
	}
	/** Check if client supports image/webp */
	acceptsWebp(): boolean{
		var a= this._accepts ??= Accepts(this);
		return !!a.type(ContentTypes.webp);
	}
	
	//* I18N
	/**
	 * Set context locale
	 * If no argument, use userAgent preferred locale or default locale.
	 */
	 async setLocale(locale?: string){
		var app= this.app;
		if(locale==null){
			locale= (this.acceptsLanguages(Array.from(app.locales)) || app.defaultLocale) as string;
		}
		this.i18n= await app.getLocale(locale);
		return this;
	}

	/**
	 * Parse Range header field, capping to the given `size`.
	 * Unspecified ranges such as "0-" require knowledge of your resource length. In
	 * the case of a byte range this is of course the total number of bytes. If the
	 * Range header field is not given `undefined` is returned, `-1` when unsatisfiable,
	 * and `-2` when syntactically invalid.
	 *
	 * When ranges are returned, the array has a "type" property which is the type of
	 * range that is required (most commonly, "bytes"). Each array element is an object
	 * with a "start" and "end" property for the portion of the range.
	 *
	 * The "combine" option can be set to `true` and overlapping & adjacent ranges
	 * will be combined into a single range.
	 *
	 * NOTE: remember that ranges are inclusive, so for example "Range: users=0-3"
	 * should respond with 4 users when available, not 3.
	 *
	 * @param {number} size
	 * @param {object} [options]
	 * @param {boolean} [options.combine=false]
	 * @return {number|array}
	 * @public
	 */
	range(size: number, options?: RangeParser.Options){
		var range:string|undefined;
		if(range = this.headers.range){
			return RangeParser(size, range, options);
		}
	}
	
	/**
	 * Upload and parse post data
	 * @optional @param {Object} options.limits - @see busboy limits
	 * @optional @param {[type]} options.type - mimetype or list of mimetypes of uploaded data @default: undefined: all types are accepted
	 * @optional @param {function} options.progress - Callback(chunkBytes, receivedBytes, totalBytes) for upload progress
	 *
	 * @optional @param {function} options.onFile - Callback(filename, fileStream, fieldname, encoding, mimetype) add custom file upload behaviour and returns the path to that file (or any string)
	 * @optional @param {Array<String>} options.extensions - List of accepted file extensions
	 * @optional @param {Boolean} options.keepExtension - do not change file extension to ".tmp"
	 * @optional @param {Array<String>} options.fileFields - list of accepted fields to contain files
	 *
	 * @optional @param {Boolean} parse - do parse JSON and XML. Save as file otherwise
	 */
	upload(options?: uploadOptions): Promise<any>{
		if(this._uploading==null){
			if(this._uploadBuffer!=null) throw new GError(ErrorCodes.UPLOAD_ERROR, 'Could not call "upload" and "uploadBuffer" with the same request!');
			return this._uploading= upload(this, options);
		}
		return this._uploading;
	}

	/** Upload as buffer or string (depending on sent charset) */
	uploadBuffered(maxSize?: number|string): Promise<Buffer|string>{
		if(this._uploadBuffer==null){
			if(this._uploading!=null) throw new GError(ErrorCodes.UPLOAD_ERROR, 'Could not call "upload" and "uploadBuffer" with the same request!');
			return this._uploadBuffer= getBody(this, maxSize);
		}
		return this._uploadBuffer;
	}
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

/** I18N format */
export interface I18nInterface{
	/** Current locale code */
	locale: string
	// Other fields
	[k: string]: any
}

/** Request params (params, query & cookie) */
export interface RequestParams<T> {
	/** Get RAW value of param */
	get(key: string): T|undefined
	/** Get parsed & resolved value or param */
	resolve(key: string): Promise<any>
	/** Iterate over the map */
	forEach(callbackfn: (value: T, key: string, map: Map<string, T>) => void, thisArg?: any): void;
	/** Check has entry */
    has(key: string): boolean;
	/** Size */
	readonly size: number;
}