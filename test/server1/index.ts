import {Gridfw} from '../../dist/index';
import type { I18nMap } from './i18n/en';
import { TSession } from './session';
// import {readFileSync} from 'fs';

const app= new Gridfw<TSession, I18nMap>({
	listen: {port: 3000}
});

// app.listen();
app.listen()
console.log('--- listening on port : 3000');
