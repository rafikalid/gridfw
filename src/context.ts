import type {IncomingMessage, ServerResponse} from 'http';
import type { Gridfw } from '.';
import ProxyAddr from 'proxy-addr';
import {parse as ContentTypeParse, ParsedMediaType} from 'content-type';
const {create}= Object

/** Context object */
export class Context<TSession>{
	readonly app: Gridfw<TSession>
	readonly req: IncomingMessage
	readonly res: ServerResponse
	/** Current timestamp */
	readonly now: number

	//* Route metadata
	routeNode:	any //TODO set routeNode type

	//* Response metadata
	/** Response content length */
	contentLength: number=	0
	contentType?:	string=	undefined
	encoding?:		string= 'utf-8'

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
	private _uploading?: Promise<any>;

	//TODO set type to routeNode
	constructor(app: Gridfw<TSession>, routeNode: any, session: TSession, req: IncomingMessage, res: ServerResponse){
		this.app= app;
		this.req= req;
		this.res= res;
		this.now= Date.now();
		this.data= create(app.data);
		//TODO parse cookies
		//* Route metadata
		this.routeNode= routeNode;
		this.session= session;
	}

	/** Current URL */
	get url(): URL|undefined{
		var url= this.req.url;
		return url==null? url : new URL(url, this.app.baseURL);
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
	get requestedContentType(): ParsedMediaType | undefined{
		var h= this.req.headers['content-type'];
		if(h) return ContentTypeParse(h);
	}

}