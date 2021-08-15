import { get, route } from "@src";
import { Req, Resp } from "..";

/** Main route */
@route('/')
export class Main{
	@get()
	main(req: Req, resp: Resp): string{
		return 'hello every body';
	}
}