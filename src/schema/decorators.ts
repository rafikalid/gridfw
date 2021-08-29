/** Create route on class */
export function route(...route: (string|string[])[]){
	return function(target: new ()=> void){
		throw new Error('You forgot to run the compiler!');
	}
}
/** Create route on class, alias */
export function controller(...route: (string|string[])[]){
	return function(target: new ()=> void){
		throw new Error('You forgot to run the compiler!');
	}
}

/** Get method */
export function get(...route: (string|string[])[]){
	return _runCompilerPlaceHolder
}
/** Head method */
export function head(...route: (string|string[])[]){
	return _runCompilerPlaceHolder
}
/** Post method */
export function post(...route: (string|string[])[]){
	return _runCompilerPlaceHolder
}
/** Custom method */
export function method(methodName: string|string[], ...route: (string|string[])[]){
	return _runCompilerPlaceHolder
}

/** Link to websocket event */
export function ws(eventName: (string|string[])[]){
	return _runCompilerPlaceHolder
}

/** @private run compiler */
function _runCompilerPlaceHolder(target: any, propertyKey: string, descriptor?: PropertyDescriptor){
	throw new Error('You forgot to run the compiler!');
}