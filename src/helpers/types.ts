/** Load data from path params */
export type Path<T> = T

/** Load data from query params */
export type Query<T> = T

/** Return xml data */
export interface XML<T> { }

/** Render html view */
export interface View<T extends string> { }