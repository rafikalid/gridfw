import {Gridfw} from '../dist/index.js';
// import {readFileSync} from 'fs';

const app= new Gridfw({
	listen: {port: 3000}
});

app.listen();
console.log('--- listening on port : 3000')
