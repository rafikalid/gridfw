import {join, relative, dirname} from 'path'
import ts from 'typescript'
import Glob from 'glob';
const {sync: GlobSync}= Glob;

/**
 * Custom transformer for import (Support relative and glob paths)
 */

type CompilerOptionsType= { baseUrl: string, paths: Record<string, string[]>};

/** Select files regex */
const tsPattern= /^(.+)\.(?:ts|tsx|js|jsm|jsx)$/i;
/** Load js and ts files using pattern */
function _getImportNodesWithPattern(factory: ts.NodeFactory, node: ts.ImportDeclaration, varname:string, pattern: string, cwd: string, currentFile: string): ts.Node[]{
	var tsFiles: ts.Node[]= [], fileName: string, i: number, len: number, r: RegExpExecArray|null;
	// find files
	var files= GlobSync(pattern, {cwd: cwd, nodir: true});
	var varNames= [], uniqueVar:ts.Identifier; // store unique import variable's names
	// Current file relative path
	currentFile= './'+relative(cwd, currentFile);
	// filter ts and js files only
	for(i=0, len= files.length; i<len; ++i){
		fileName= files[i];
		if(fileName !== currentFile && (r= tsPattern.exec(fileName))){
			uniqueVar= factory.createUniqueName(varname);
			varNames.push(uniqueVar);
			tsFiles.push(factory.createImportDeclaration(
				node.decorators,
				node.modifiers,
				// factory.createImportClause(false, uniqueVar, factory.createNamedImports([factory.createImportSpecifier(factory.createIdentifier('*'), uniqueVar)])),
				// ,
				factory.createImportClause(false, undefined, factory.createNamespaceImport(uniqueVar)),
				factory.createStringLiteral(r[1])
			));
			// console.log('--- ', ts.parseIsolatedEntityName('import * as ccc from "hello"', ts.ScriptTarget.ES2020));
		}
	}
	// create list
	tsFiles.push(
		factory.createVariableStatement(
			undefined,
			[
				factory.createVariableDeclaration(
					factory.createIdentifier(varname),
					undefined,
					undefined,
					factory.createArrayLiteralExpression(varNames)
				)
			]
		)
	)
	// return
	return tsFiles;
}

/** Replacer regex */
const replacerRegex= /^(@[^\/\\'"`]+)/;
/**
 * @private "import" node visitor
 */
function _importVisitor(ctx:ts.TransformationContext, sf:ts.SourceFile, pathMap: Map<string, string>): ts.Visitor{
	var it= pathMap.keys();
	while(true){
		var a= it.next();
		if(a.done) break;
	}
	// replacer
	function _replaceCb(txt: string, k: string){
		var v= pathMap.get(k); // Node < 15 do not support "??" operator
		if(v==null)
			v= txt;
		else{
			v= relative(dirname(sf.fileName), v)||'.';
		}
		return v;
	}
	// return
	function visitorCb(node: ts.Node): ts.Node | ts.Node[]{
		if(ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly){
			var importPath = node.moduleSpecifier.getText(sf);
			importPath= importPath.substr(1, importPath.length - 2); // remove quotes
			var newImportPath= importPath.replace(replacerRegex, _replaceCb);
			var factory= ctx.factory;
			var importCloseTxt: string|undefined;
			if(newImportPath.includes('*') && (importCloseTxt= node.importClause?.getText(sf))){
				return _getImportNodesWithPattern(factory, node, importCloseTxt, newImportPath, dirname(sf.fileName), sf.fileName);
			} else if(newImportPath !== importPath) {
				node= factory.updateImportDeclaration(
					node,
					node.decorators,
					node.modifiers,
					node.importClause,
					factory.createStringLiteral(newImportPath)
				);
			}
		}
		return ts.visitEachChild(node, visitorCb, ctx);
	}
	return visitorCb;
}

/**
 * Rewrite and resolve "import" statments
 */
export default function importTransformer(compilerOptions: CompilerOptionsType){
	//Checks 
	if(typeof compilerOptions.baseUrl !== 'string')
		throw new Error('Expected options.baseUrl as string!');
	if(compilerOptions.paths==null)
		throw new Error('Expected options.paths as Record<string, string[]>')
	// Base dir
	const paths=	compilerOptions.paths;
	const baseDir=	join(process.cwd(), compilerOptions.baseUrl);
	// Prepare map
	var pathMap= new Map();
	var k: string;
	for(k in paths){
		var v= paths[k];
		if(v.length != 1)
			throw new Error(`Expected path to have only one entry, found ${v.length} at ${k}`);
		// remove trailing slash
		k= k.replace(/\/\*?$/, '');
		pathMap.set(k, join(baseDir, v[0].replace(/\/\*?$/, '')));
	}
	// return transformer
	return function(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile>{
		return function(sf: ts.SourceFile){ return ts.visitNode(sf, _importVisitor(ctx, sf, pathMap)); }
	}
}