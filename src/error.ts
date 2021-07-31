export enum ErrorCodes{
	/** Unknown locale */
	UNKNOWN_LOCALE,
	/** View not found */
	VIEW_NOT_FOUND,
	/** View Error */
	VIEW_ERROR
}

/** ERROR */
export class GError extends Error{
	readonly code: ErrorCodes
	readonly causedBy: any
	constructor(code: ErrorCodes, message?: string, causedBy?: any){
		super(message ?? String(code));
		this.code= code;
		this.causedBy= causedBy;
	}
	
	toString(){ return this.stack; }

	get stack(){
		var causedBy= this.causedBy;
		if(causedBy instanceof Error)
			causedBy= "\n"+causedBy.stack;
		else if(causedBy!=null)
			causedBy= "\n"+causedBy;
		return `ERROR-CODE: ${ErrorCodes[this.code]}\n${super.stack}${causedBy}`;
	}
}