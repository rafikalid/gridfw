import { Gridfw } from "..";
import {resolve} from 'path';
import { ErrorCodes, GError } from "@src/error";

/** Render View */
export async function render(viewCache: any, viewPath: string, locale: string, path: string, data: Record<string, any>): Promise<string>{
	try {
		viewPath= resolve(viewPath, locale, path)+'.js';
		var renderFx= viewCache.upsert(viewPath) as (data:any)=> string;
		return renderFx(data);
	} catch (err) {
		if(err?.code==='ENOENT')
			throw new GError(ErrorCodes.VIEW_NOT_FOUND, `Missing view "${path}" for locale "${locale}" at: ${viewPath} `);
		else
			throw new GError(ErrorCodes.VIEW_ERROR, `Error at view "${path}"`, err);
	}
}