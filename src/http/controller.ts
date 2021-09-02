import { I18N } from '@src/helpers/i18n';
import type { Request } from './request';
import type { Response } from './response';
/** Controller */
export type Controller<TSession, TI18n extends I18N>= (req: Request<TSession, TI18n>, res: Response<TSession, TI18n>)=> any;