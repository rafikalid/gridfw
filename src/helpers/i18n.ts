import { ErrorCodes, GError } from "@src/error";

/** Compile pug expressions for i18n */
export function i18nPug(exp: string|TemplateStringsArray){
	throw new GError(ErrorCodes.NEEDS_COMPILE, "You forgot to compile i18n!");
}

/** Main i18n interface */
export interface I18N{
	locale: string
	// Other fields
	[k: string]: any
}