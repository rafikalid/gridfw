import type { Context } from "@src/context";
import { ErrorCodes, GError } from "@src/error";

/** Uploader options */
export interface UploaderOptions{

}

/**
 * Make upload
 */
export async function upload(ctx: Context<any, any>, options: UploaderOptions= {}): Promise<any>{
	//* Prepare
	const req = ctx.req;
	const app= ctx.app;
	const contentType = ctx.reqContentType?.type;
	if(contentType==null) throw new GError(ErrorCodes.UPLOAD_ERROR, "Missing data content type!");
	//* Limits
	const limits= options.limits==null ? app.uploadLimits
}

