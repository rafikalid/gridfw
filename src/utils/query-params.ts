import { RequestParams, Request } from "@src/http/request";
import { paramType } from "gridfw-tree-router";
//@ts-ignore
import FastDecode from 'fast-decode-uri-component';
import { ErrorCodes, GError } from "@src/error";

const _isArray = Array.isArray;

/**
 * URL Query params
 */
export class QueryMap extends Map implements RequestParams<string>{
	private _req: Request<any, any>;
	constructor(req: Request<any, any>, rawQuery?: string) {
		super();
		this._req = req;
		//* Parse query
		if (rawQuery != null) {
			var options = req.app.options;
			if (rawQuery.length > options.queryMaxLength)
				throw new GError(ErrorCodes.QUERY_MAX_LENGTH, `Unexpected cookie size: ${rawQuery.length}. May be this is an attack!`);
			// TODO add better algorithm for parsing
			var parts = rawQuery.split('&');
			for (let i = 0, len = parts.length; i < len; ++i) {
				try {
					let part = parts[i];
					let c = part.indexOf('=');
					let v: string;
					if (c === -1) v = '';
					else {
						v = FastDecode(part.substr(c + 1));
						part = part.substr(0, c);
					}
					// add
					let prev = this.get(part);
					if (prev == null) this.set(part, v);
					else if (_isArray(prev)) prev.push(v);
					else this.set(part, [prev, v]);
				} catch (error) {
					req.error('QUERY_PARSER', error);
				}
			}
		}
	}
	/** Resolve param */
	async resolve(key: string) {
		var v = this.get(key);
		if (v != null) {
			var node = this._req.app.params.get(key)!;
			if (node.isStatic === false)
				v = await node.resolve(v, paramType.PATH_PARAM, this._req);
		}
		return v;
	}
}