import { Gridfw } from "..";
import {resolve} from 'path';
import { ErrorCodes, GError } from "@src/error";
import { Options } from "@src/options";

/** Render fx */
export type RenderFx= (data: any)=> string

/** Generate view render method for dev mode */
export function renderForDev(cb: NonNullable<Options['viewsDev']>){
	return async function (this: Gridfw<any, any>, locale: string, path: string, data1?: Record<string, any>, data2?: Record<string, any>): Promise<string>{
		try {
			var data: Record<string, any>= {...this.data, ...data1, ...data2};
			var html= await cb(path, locale, data);
			return html;
		} catch (err) {
			if(err?.code==='ENOENT')
				throw new GError(ErrorCodes.VIEW_NOT_FOUND, `Missing view "${path}" for locale "${locale}" at: ${resolve(this.options.views, path)}.js `);
			else
				throw new GError(ErrorCodes.VIEW_ERROR, `Error at view "${resolve(this.options.views, path)}.js"`, err);
		}
	}
}