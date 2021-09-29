import { ErrorCodes, GError } from '@src/error';
import { Request, CookieMap } from '@src/http/request';
//@ts-ignore
import FastDecode from 'fast-decode-uri-component';
import { HashAlgorithm, verify } from 'web-token';

/** Cookie params */
export class CookieParams extends Map<string, string> implements CookieMap {
	/** Cookie signature secret */
	#secret: Buffer;
	#hashAlgo?: HashAlgorithm;

	constructor(req: Request<any, any>) {
		super();
		const options = req.app.options;
		this.#secret = options.cookieSecret;
		this.#hashAlgo = options.cookieHashAlgo;
		//* Parse cookies
		var cookieHeader = req.headers.cookie;
		if (cookieHeader != null) {
			if (cookieHeader.length > options.cookieMaxLength)
				throw new GError(
					ErrorCodes.COOKIE_MAX_LENGTH,
					`Enexpected cookie size: ${cookieHeader.length}. May be this is an attack!`
				);
			var parts = cookieHeader.split(';');
			for (let i = 0, len = parts.length; i < len; ++i) {
				try {
					let part = parts[i];
					let c = part.indexOf('=');
					if (c === -1) this.set(part, '');
					else {
						this.set(
							part.substr(0, c).trim(),
							FastDecode(part.substr(c + 1).trim())
						);
					}
				} catch (error) {
					req.error('COOKIE_PARSER', error);
				}
			}
		}
	}
	/** Get parsed and resolved value */
	getSigned(key: string) {
		var v = this.get(key);
		if (v != null) {
			v = verify(
				Buffer.from(v, 'base64url'),
				this.#secret,
				this.#hashAlgo
			).data.toString('utf-8');
		}
		return v;
	}
}
