import { ErrorCodes, GError } from "@src/error";
import { Writable as WritableStream, Readable } from 'stream';
import { Options, ParsedOptions, UploadLimits, UploadLimitsParsed, uploadOptions, uploadOptionsParsed } from "@src/options";
import {Request} from '../http/request';
import Bytes from 'bytes';
import {lookup as mimeTypeLookup} from 'mime-types';
import zlib, {createInflate, createGunzip} from 'zlib';
import {createWriteStream, promises as fPromises} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';
import Busboy from 'busboy';
// import {encodingExists} from 'iconv-lite';
import RawBody from 'raw-body';
import {xml2js} from 'xml-js';

const {open: fOpen , unlink: fUnlink} = fPromises;

/** Upload options */
export interface FileUploadOptions extends uploadOptions{
	/**
	 * Upload progress listener
	 * @param {number} chunkLen	- Current chunk length
	 * @param {number} uploaded	- Uploaded bytes
	 * @param {number|undefined} total	- Total size sent by the client
	 */
	progress?: (this: Request<any, any>, chunkLen: number, uplaoded: number, total: number)=> void
	/**
	 * Assert upload type: multipart, urlencoded, ...
	 */
	contentType?: string | string[]
	/** Parse JSON and XML data */
	parse?: boolean
}

/**
 * Make upload
 */
export function upload(req: Request<any, any>, options: FileUploadOptions= {}): Promise<UploadResult>{
	return new Promise((resolve: (data: UploadResult)=> void, reject)=>{
		//* Prepare
		const appOptions= req.app.options;
		const contentType = req.contentType?.type;
		if(contentType==null) throw new GError(ErrorCodes.UPLOAD_ERROR, "Missing data content type!");
		//* Limits
		var limits: UploadLimitsParsed;
		limits= appOptions.upload.limits;
		if(options.limits!=null)
			limits= UploadLimits({...limits, ...options.limits});
		//* Limit body size
		var bodySize: string|number|undefined = req.headers['content-length'];
		if(bodySize){
			bodySize= Bytes(bodySize);
			if(bodySize > limits.size) throw new GError(ErrorCodes.UPLOAD_MAX_BODY_SIZE, `data size: ${Bytes(bodySize)}. Max size: ${Bytes(limits.size)}`);
		}
		//* Limit upload type
		if(options.contentType!=null){
			let type= options.contentType;
			if(Array.isArray(type)){
				let found= false;
				for(let i=0, len= type.length; i<len; ++i){
					let tp= type[i];
					if(!tp.includes('/')){
						let r= mimeTypeLookup(tp);
						if(r===false) throw new GError(ErrorCodes.UPLOAD_ERROR, `Unknown mimetype for: ${tp}`);
						else tp= r;
					}
					if(tp === contentType){ found= true; break; }
				}
				if(found===false) throw new GError(ErrorCodes.UPLOAD_CONTENT_TYPE, `Expected one of: [ ${type.join(', ')} ]. Received: ${contentType}`);
			} else {
				if(!type.includes('/')){
					let r= mimeTypeLookup(type);
					if(r===false) throw new GError(ErrorCodes.UPLOAD_ERROR, `Unknown mimetype for: ${type}`);
					else type= r;
				}
				if(type !== contentType) throw new GError(ErrorCodes.UPLOAD_CONTENT_TYPE, `Expected: ${type}. Received: ${contentType}`);
			}
		}
		//* Upload progress
		if(typeof options.progress === 'function'){
			let progressCb= options.progress;
			let uplaoded= 0;
			req.on('data', function(chunk){
				var len= chunk.length;
				uplaoded+= len;
				progressCb.call(req, len, uplaoded, bodySize as number);
			});
		}
		//* Upload data
		switch(contentType){
			case 'multipart/form-data':
			case 'application/x-www-form-urlencoded':
				uploadFormData(req, options, limits, resolve, reject);
				break;
			case 'application/json':
				uploadJsonXml(req, options, limits, appOptions, JSON.parse, resolve, reject);
				break;
			case 'application/xml':
				uploadJsonXml(req, options, limits, appOptions, xml2js, resolve, reject);
			default:
				uploadRawData(req, options, limits, resolve, reject);
		}
	});
}

/** Upload multipart and urlEncoded */
function uploadFormData(
	req: Request<any, any>,
	options: FileUploadOptions,
	limits: UploadLimitsParsed,
	resolve: (r: UploadResult)=> void,
	reject: (r: any)=> void
){
	//* Busboy
	const busboy= new Busboy({
		headers: req.headers,
		limits: limits
	});
	/** Error handler */
	function errorHandler(err: any){
		reject(err);
		req.unpipe(busboy);
	}
	const data: Map<string, any>= new Map();
	const tempPaths: string[]= [];
	const onFile= createFileUploadWrapper(req, options, tempPaths, errorHandler);
	busboy.on('finish', function(){
		resolve(new UploadResult(data, tempPaths));
	})
	.on('partsLimit', function(){ errorHandler(new GError(ErrorCodes.UPLOAD_ERROR, 'partsLimit')) })
	.on('filesLimit', function(){ errorHandler(new GError(ErrorCodes.UPLOAD_ERROR, 'filesLimit')) })
	.on('fieldsLimit', function(){ errorHandler(new GError(ErrorCodes.UPLOAD_ERROR, 'fieldsLimit')) })
	.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype){
		try {
			if(fieldnameTruncated) throw new GError(ErrorCodes.UPLOAD_ERROR, `Field name truncated: ${fieldname}`);
			else if(valTruncated) throw new GError(ErrorCodes.UPLOAD_ERROR, `field value truncated: ${fieldname}`);
			else _addField(data, fieldname, val);
		} catch (err) {
			errorHandler(err);
		}
	})
	.on('file', async function(fieldname, file, filename, encoding, mimetype){
		try {
			var r= await onFile(filename, file, fieldname, encoding as BufferEncoding, mimetype);
			if(r!=null) _addField(data, filename, r);
		} catch (err) {
			errorHandler(err);
		}
	});
	req.pipe(busboy);
}

/** Upload RAW */
function uploadRawData(
	req: Request<any, any>,
	options: FileUploadOptions,
	limits: UploadLimitsParsed,
	resolve: (r: UploadResult)=> void,
	reject: (r: any)=> void
){
	var stream: Readable;
	/** Error handler */
	function _errorhandler(err:any){
		reject(err);
		stream.unpipe();
	}
	try {
		stream= createStream(req);
		/** Temp file, used to remove theme when finish */
		var tempPaths: string[]= [];
		var data: any;
		var onFile= createFileUploadWrapper(req, options, tempPaths, _errorhandler);
		stream.on('end', function(){
			resolve(new UploadResult(data, tempPaths));
		}).on('error', _errorhandler);
		onFile('untitled.tmp', stream, undefined, undefined, undefined)
			.then(r=>{data= r;})
			.catch(_errorhandler);
	} catch (err) {
		_errorhandler(err);
	}
}

/** Create stream */
function createStream(req: Request<any, any>): Readable{
	var stream: zlib.Inflate|zlib.Gunzip|typeof req;
	var encoding= req.headers['content-encoding']?.toLowerCase() ?? 'identity';
	switch(encoding){
		case 'deflate':
			stream = createInflate();
			req.pipe(stream);
			break;
		case 'gzip':
			stream = createGunzip();
			req.pipe(stream);
			break;
		case 'identity':
			stream = req;
			break;
		default:
			throw new GError(ErrorCodes.UPLOAD_ENCODING, `Unsupported encoding: ${encoding}`);
	}
	return stream;
}

function createFileUploadWrapper(req: Request<any, any>, options: FileUploadOptions, tempPaths: string[], errorHandler: (err: any)=> void){
	var {onFile}= options;
	//* result
	return async function(filename: string, file: NodeJS.ReadableStream|Readable, fieldname: string|undefined, encoding: BufferEncoding|undefined, mimetype: string|undefined){
		try{
			//* CB
			var result= onFile?.call(req, filename, file, fieldname, encoding, mimetype, options);
			var fileStream: WritableStream;
			var filePath: string|undefined;
			//* Switch result
			if(result==null){
				filePath= await _createTempFile(options.tempDir, result, req.now);
				tempPaths.push(filePath);
				fileStream= createWriteStream(filePath);
			} else if(typeof result === 'string'){
				//* Set custom file path
				switch(result.charAt(0)){
					case '/':
						break;
					case '.':
						// Create temp file
						filePath= result= await _createTempFile(options.tempDir, result, req.now);
						tempPaths.push(filePath);
						break;
					default:
						throw new GError(ErrorCodes.UPLOAD_ERROR, `onFile>> Enexpected return value: ${result}`);
				}
				fileStream= createWriteStream(result);
			} else if(result instanceof WritableStream){
				fileStream= result;
			} else if(typeof result==='object'){
				return result;
			} else if(result===false){
				return;
			} else {
				throw new GError(ErrorCodes.UPLOAD_ERROR, `onFile>> Enexpected result`, result);
			}
			// Finale result
			var fileDescriptor= {
				name:		filename,
				encoding:	encoding,
				mimetype:	mimetype,
				size:		0,
				path:		filePath	
			}
			file.on('data', function(chunk: Buffer){
				fileDescriptor.size+= chunk.length;
			});
			file.pipe(fileStream);
			return fileDescriptor;
		} catch(err) {
			errorHandler(err);
			file.unpipe();
		}
	}
}

/** Create temp file */
async function _createTempFile(dirName: string= tmpdir(), extName: string= '.tmp', now: number): Promise<string>{
	var tmpFileName=  `${process.pid.toString(32)}-${now.toString(32)}`;
	var path: string;
	var i=0;
	while(true){
		try {
			path= join(dirName, `${tmpFileName}-${i.toString(32)}${extName}`);
			let fd= await fOpen(path, 'wx+', 0o600);
			await fd.close();
			break;
		} catch (err) {
			if(err?.code !== 'EEXIST') throw new GError(ErrorCodes.UPLOAD_ERROR, `Create temp file failed!`, err);
		}
	}
	return path;
}

/** Get request body (for parsing or as buffer) */
export async function getBody(req: Request<any, any>, maxSize?: number|string): Promise<Buffer|string>{
	var stream: Readable|undefined;
	try {
		// var charset: string|undefined;
		// if(charset= req.contentType?.parameters.charset){
		// 	if(!encodingExists(charset))
		// 		throw new GError(ErrorCodes.UPLOAD_ERROR, `Unsupported charset: ${charset}`);
		// }
		stream= createStream(req);
		var buffer= await RawBody(stream, {
			encoding:	req.contentType?.parameters.charset,
			limit:		maxSize,
			length:		req.headers['content-length']
		});
		return buffer;
	} catch (err) {
		stream?.destroy();
		throw new GError(ErrorCodes.UPLOAD_ERROR, 'Upload failed', err);
	}
}

/** Get request body (for parsing or as buffer) */
export async function getBodyCb(req: Request<any, any>, maxSize: number|string|undefined, cb: (err: any, buffer: Buffer|string) => void){
	var stream: Readable|undefined;
	stream= createStream(req);
	RawBody(stream, {
		encoding:	req.contentType?.parameters.charset,
		limit:		maxSize,
		length:		req.headers['content-length']
	}, function(err, data){
		if(err){
			stream?.destroy();
		}
		cb(err, data);
	});
}

/** Result data */
export class UploadResult{
	data: any
	private _tmpFiles: string[];
	constructor(data: any, tmpFiles: string[]){
		this.data= data;
		this._tmpFiles= tmpFiles;
	}

	/** Clear temp files */
	async clear(){
		var tmpFiles= this._tmpFiles;
		for(let i=0, len=tmpFiles.length; i<len; ++i){
			await fUnlink(tmpFiles[i]);
		}
		tmpFiles.length= 0;
	}
}

/** Upload JSON */
function uploadJsonXml(req: Request<any, any>, options: FileUploadOptions, limits: UploadLimitsParsed, appOptions: Omit<ParsedOptions, "baseURL">, parser: (data: string)=>Record<string, any>, resolve: (value: UploadResult) => void, reject: (reason?: any) => void) {
	if(options.parse===true){
		getBodyCb(req, limits.size, function(err, data){
			if(err) reject(new GError(ErrorCodes.UPLOAD_ERROR, 'Upload failed', err));
			else {
				if(typeof data!== 'string') data= data.toString(appOptions.encoding);
				resolve(new UploadResult(data.length===0 ? {} : parser(data), []));
			}
		});
	} else {
		uploadRawData(req, options, limits, resolve, reject);
	}
}
function _addField(data: Map<string, any>, fieldname: string, val: any) {
	var vl= data.get(fieldname);
	if(vl==null) data.set(fieldname, val);
	else if(Array.isArray(val)) vl.push(val)
	else data.set(fieldname, val);
}

