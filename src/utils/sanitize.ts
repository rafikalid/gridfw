import { ErrorCodes, GError } from "@src";
import { join, sep, resolve } from 'path';

/**
 * Regular expression to match a path with a directory up component.
 * @private
 */
var UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/
/** Sanitize file path */
export function sanitizePath(filePath: string, rootDir?: string) {
	try {
		// Decode URI
		filePath = decodeURIComponent(filePath);
		// Poison Null Bytes
		if (filePath.indexOf('\0') !== -1) throw 0;
		// Check path still inside target directory
		if (rootDir != null) {
			filePath = resolve(rootDir, filePath);
			if (filePath.startsWith(join(rootDir, sep)) === false) throw 1;
		} else {
			if (UP_PATH_REGEXP.test(filePath)) throw 1;
		}
	} catch (err) {
		throw new GError(ErrorCodes.PATH_TRAVERSAL_ATTACK, `Possible Path Traversal Attack blocked: ${filePath}`);
	}
	return filePath;
}