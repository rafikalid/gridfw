import { ErrorCodes, GError } from "@src/error";
import {Request} from '../http/request';

/** Uploader options */
export interface UploaderOptions{
	limits?: 
}

/**
 * Make upload
 */
export async function upload(req: Request<any, any>, options: UploaderOptions= {}): Promise<any>{
	//* Prepare
	const app= req.app;
	const contentType = req.contentType?.type;
	if(contentType==null) throw new GError(ErrorCodes.UPLOAD_ERROR, "Missing data content type!");
	//* Limits
	const limits= options.limits ? app.uploadLimits
}

