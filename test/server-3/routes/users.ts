import { get, post, route } from "@src";
import { Resp } from "..";
import { OperationDone } from "../models/response";
import { User } from "../models/user";

/** Users */
@route('/api/users')
export class Users{

	@get()
	getUsers(resp: Resp){
		resp.json({test: 'Test JSON'});
	}

	@post()
	setUser(user: User): OperationDone{
		console.log('--- Uploaded user: ', user);
		return {
			done: true,
			message: 'User added successfully'
		}
	}
}

/** User interface */