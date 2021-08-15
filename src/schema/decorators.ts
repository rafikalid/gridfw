/** Create route on class */
export function route(route: string|string[]){
	return function(target: new ()=> void){
		throw new Error('You forgot to run the compiler!');
	}
}

/** Get method */
export function get(route?: string|string[]){
	return function(target: any, propertyKey: string, descriptor?: PropertyDescriptor){
		throw new Error('You forgot to run the compiler!');
	}
}
/** Post method */
export function post(route?: string|string[]){
	return function(target: any, propertyKey: string, descriptor?: PropertyDescriptor){
		throw new Error('You forgot to run the compiler!');
	}
}
/** Custom method */
export function method(methodName: string|string[], route?: string|string[]){
	return function(target: any, propertyKey: string, descriptor?: PropertyDescriptor){
		throw new Error('You forgot to run the compiler!');
	}
}

