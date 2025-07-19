import { FastifyPluginCallback } from 'fastify';

/**
 * Register hello route.
 * @param fastify - Fastify instance.
 * @param _options - Options object (currently unused).
 * @param done - Callback function when route setup is complete.
 */
export const helloRoute: FastifyPluginCallback = (fastify, _options, done) => {
  fastify.get('/api/hello', async (_request, reply) => {
    reply.send({ message: 'Hello, World!' });
  });

  done();
};
