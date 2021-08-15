import { RequestParams, Request } from "@src/http/request";
import { PathResolverSuccess } from "gridfw-tree-router/dist/node";
import { ParamInterface, paramType, RouterParams } from "gridfw-tree-router/dist/params";
//@ts-ignore
import FastDecode from 'fast-decode-uri-component';

/** Params Map */
export class ParamMap extends Map implements RequestParams<string>{
	private _resolvers: Map<string, ParamInterface>= new Map();
	private _req:Request<any, any>;
	constructor(req: Request<any, any>, node: PathResolverSuccess<unknown>){
		super();
		this._req= req;
		//-
		var paramValues= node.params!;
		var paramResolvers= node.paramResolvers!;
		var resolversMap= this._resolvers;
		for(let i=0, len= paramValues.length; i<len; ++i){
			let v= FastDecode(paramValues[i]);
			let paramNode= paramResolvers[i];
			let pname= paramNode.name;
			this.set(pname, v);
			resolversMap.set(pname, v);
		}
	}

	/** resolve value */
	async resolve(key: string){
		var v= this.get(key);
		if(v!=null){
			var node= this._resolvers.get(key)!;
			if(node.isStatic===false)
				v= await node.resolve(v, paramType.PATH_PARAM, this._req);
		}
		return v;
	}
}