/** The HTTP methods Mechane sends and answers. */
export const HttpMethod = { Get: 'GET', Head: 'HEAD', Put: 'PUT', Post: 'POST', Delete: 'DELETE' } as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];
