import { ErrorCodes, GError } from "@src/error";
import { Options, ParsedOptions, uploadLimits } from "@src/options";
import {Request} from '../http/request';


/**
 * Make upload
 */
export async function upload(req: Request<any, any>, options: Options['upload']= {}): Promise<any>{
	//* Prepare
	const app= req.app;
	const contentType = req.contentType?.type;
	if(contentType==null) throw new GError(ErrorCodes.UPLOAD_ERROR, "Missing data content type!");
	//* Limits
	var limits: ParsedOptions['upload']['limits'];
	limits= app.options.upload.limits;
	if(options.limits!=null){
		limits= uploadLimits({...limits, ...options.limits});
	}
}

