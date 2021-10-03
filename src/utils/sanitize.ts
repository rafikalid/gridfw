import { ErrorCodes, GError } from "@src";

/** Sanitize file path */
export function sanitizePath(filePath: string) {
	if (
		// Poison Null Bytes
		filePath.indexOf('\0') !== -1
	)
		throw new GError(ErrorCodes.PATH_TRAVERSAL_ATTACK, `Possible Path Traversal Attack blocked: ${filePath}`);
	return filePath;
}