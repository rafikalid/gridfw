/**
 * Handle http request
 */
export function handleRequest(req:any, resp: any){
	console.log('it works');
	resp.end('hello, it works');
}