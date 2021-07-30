import {Gridfw} from '../dist/index.js';
import {readFileSync} from 'fs';

const app= new Gridfw({
	server: {
		key: readFileSync('test/localhost-privkey.pem'),
		cert: readFileSync('test/localhost-cert.pem')
	},
	listen: {port: 3000}
});

app.listen();
console.log('--- listening on port : 3000')
