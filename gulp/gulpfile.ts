import Gulp from 'gulp';

import {typescriptCompile} from './typescript.js'

const {watch, series}= Gulp;

const argv= process.argv;
const doWatch= !argv.includes('--nowatch');

/** Watch modified files */
function watchCb(cb: Function){
	if(doWatch){
		watch('src/**/*.ts', typescriptCompile);
		// watch('src/app/graphql/schema/**/*.gql', graphQlCompile)
	}
	cb();
}

export default series([
	typescriptCompile,
	// parallel([
	// 	typescriptCompile,
	// 	graphQlCompile
	// ]),
	watchCb
]);
