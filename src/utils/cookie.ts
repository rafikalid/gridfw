import { ErrorCodes, GError } from "@src/error";
import { RequestParams, Request } from "@src/http/request";
import {AES as AESCrypto} from 'crypto-js';
//@ts-ignore
import FastDecode from 'fast-decode-uri-component';
import { paramType, RouterParams } from "gridfw-tree-router/dist/params";

/** Cookie params */
export class CookieParams extends Map<string, string> implements RequestParams<string>{
	private _appParams?: RouterParams;
	private _req:Request<any, any>;
	constructor(req: Request<any, any>){
		super();
		this._req= req;
		//* Parse cookies
		var cookieHeader= req.headers.cookie;
		if(cookieHeader!=null){
			var options= req.app.options;
			if(cookieHeader.length > options.cookieMaxLength)
				throw new GError(ErrorCodes.COOKIE_MAX_LENGTH, `Enexpected cookie size: ${cookieHeader.length}. May be this is an attack!`);
			var parts= cookieHeader.split(';');
			var secret= options.cookieSecret;
			this._appParams= req.app.params;
			for(let i=0, len= parts.length; i<len; ++i){
				try {
					let part= parts[i];
					let c= part.indexOf('=');
					if(c=== -1) this.set(part, '');
					else{
						this.set(
							part.substr(0, c).trim(),
							AESCrypto.decrypt(FastDecode(part.substr(c+1).trim()), secret).toString(CryptoJS.enc.Utf8)
						);
					}
				} catch (error) {
					req.error('COOKIE_PARSER', error);
				}
			}
		}
	}
	/** Get parsed and resolved value */
	async resolve(key: string){
		var v= this.get(key);
		var p;
		if(v!=null && (p= this._appParams!.get(key)) && p.isStatic===false){
			v= await p.resolve(v, paramType.COOKIE_PARAM, this._req);
		}
		return v;
	}
}