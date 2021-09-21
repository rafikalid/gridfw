/** Load data from path */
export type PathParams<T>= T

/** Load data from query params */
export type QueryParams<T>= T

/** Return JSON data */
export interface JSON<T>{}

/** Return xml data */
export interface XML<T>{}

/** Render html view */
export interface HTML<T extends string>{}