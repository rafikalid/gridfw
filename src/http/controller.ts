import type { I18nInterface, Request } from './request';
import type { Response } from './response';
/** Controller */
export type Controller<TSession, TI18n extends I18nInterface>= (req: Request<TSession, TI18n>, res: Response<TSession, TI18n>)=> any;