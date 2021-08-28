import { Gridfw, Request, Response } from "@src";

/** Request */
export type Req= Request<any, any>;
export type Resp= Response<any, any>;

/** App */
const app= new Gridfw();
app.scan('routes/**/*.ts');