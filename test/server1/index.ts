import {Gridfw} from '../../dist/index';
import type { I18nMap } from './i18n/en';
import { TSession } from './session';
// import {readFileSync} from 'fs';

const app= new Gridfw<TSession, I18nMap>({
	listen: {port: 3000}
});

app.params.set('var');

app.get('/hello/world', function(req, resp){
	console.log('Hello');
	return 'Hello world';
})
.get('/test/:var', function(req, resp){
	console.log('hello: ', req.params.get('var'));
	return 'got var: '+req.params.get('var');
});

// app.listen();
app.listen()
console.log('--- listening on port : ', app.port);
