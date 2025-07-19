import { FastifyPluginCallback } from 'fastify';
import { Type } from '@fastify/type-provider-typebox';
import { normalizeChallenges } from '../../utils/normalize';

/**
 * Fastify plugin for classroom-related protected routes.
 * Provides endpoints for listing users and retrieving user data for classrooms.
 * @param fastify - The Fastify instance.
 * @param _options - Plugin options (unused).
 * @param done - Callback to signal plugin registration is complete.
 */
export const classroomRoutes: FastifyPluginCallback = (
  fastify,
  _options,
  done
) => {
  // Add this endpoint to see all users in your database
  fastify.get(
    '/api/protected/classroom/list-users',
    {
      schema: {
        querystring: Type.Object({
          limit: Type.Optional(
            Type.Number({ default: 20, minimum: 1, maximum: 100 })
          ),
          skip: Type.Optional(Type.Number({ default: 0, minimum: 0 }))
        }),
        response: {
          200: Type.Object({
            users: Type.Array(
              Type.Object({
                username: Type.String(),
                email: Type.String(),
                completedChallenges: Type.Array(
                  Type.Object({
                    id: Type.String(),
                    completedDate: Type.Number(),
                    challengeName: Type.Optional(Type.String()),
                    files: Type.Optional(Type.Array(Type.Object({}))),
                    githubLink: Type.Optional(Type.String()),
                    solution: Type.Optional(Type.String())
                  })
                )
              })
            ),
            count: Type.Number()
          })
        }
      }
    },
    async (request, reply) => {
      const { limit = 20, skip = 0 } = request.query as {
        limit?: number;
        skip?: number;
      };

      try {
        // Get all users with pagination
        const users = await fastify.prisma.user.findMany({
          skip,
          take: limit,
          select: {
            username: true,
            email: true,
            completedChallenges: true
          },
          orderBy: {
            username: 'asc'
          }
        });

        const count = await fastify.prisma.user.count();

        // Format the response - using normalizeChallenges for better data structure
        const formattedUsers = users.map(user => ({
          username: user.username,
          email: user.email,
          completedChallenges: normalizeChallenges(
            user.completedChallenges || []
          )
        }));

        return reply.send({
          users: formattedUsers,
          count
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to retrieve users' });
      }
    }
  );
  fastify.get(
    '/api/protected/classroom/get-user-data',
    {
      schema: {
        querystring: Type.Object({
          emails: Type.String() // Comma-separated emails
        }),
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                email: Type.String(),
                certifications: Type.Array(
                  Type.Record(
                    Type.String(), // Certification name
                    Type.Object({
                      blocks: Type.Array(
                        Type.Record(
                          Type.String(),
                          Type.Object({
                            completedChallenges: Type.Array(
                              Type.Object({
                                id: Type.String(),
                                challengeName: Type.String(),
                                completedDate: Type.Number(),
                                files: Type.Optional(
                                  Type.Array(Type.Object({}))
                                )
                              })
                            )
                          })
                        )
                      )
                    })
                  )
                )
              })
            )
          })
        }
      }
    },
    async (request, reply) => {
      const { emails = '' } = request.query as { emails: string };

      // Split the comma-separated string into an array
      const emailArray = emails.split(',').filter(Boolean);

      console.log('emails to query:', emailArray);

      // Limit number of users per request for performance
      if (emailArray.length > 50) {
        return reply.code(400).send({
          error: 'Too many users requested. Maximum 50 allowed.'
        });
      }

      try {
        // Find all the requested users by email instead of username
        const users = await fastify.prisma.user.findMany({
          where: {
            email: { in: emailArray }
          },
          select: {
            email: true,
            username: true,
            completedChallenges: true
          }
        });

        // Map to transform user data into the required format
        const userData = users.map(user => {
          // Normalize challenges
          const normalizedChallenges = normalizeChallenges(
            user.completedChallenges
          );
          console.log(
            'normalizedChallenges for user',
            user.email,
            normalizedChallenges.length
          );

          // Group by certification and block
          const certifications = groupChallengesByCertAndBlock(
            normalizedChallenges.map(challenge => ({
              ...challenge,
              completedDate: challenge.completedDate.toString()
            }))
          );

          return {
            email: user.email,
            username: user.username,
            completedChallenges: normalizedChallenges.map(challenge => ({
              ...challenge,
              completedDate: challenge.completedDate.toString()
            })),
            certifications
          };
        });

        return reply.send({
          data: userData
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to retrieve user data' });
      }
    }
  );

  done();
};

/**
 * Groups challenges by certification and block.
 * @param challenges - Array of challenge objects to group.
 * @returns An array of grouped certifications with their blocks and completed challenges.
 */
import challengeIdMapJson from '../../../../challenge-id-map.json';

function groupChallengesByCertAndBlock(
  challenges: Array<{
    id: string;
    completedDate: string;
    files?: Array<object>;
  }>
) {
  // This is where you implement the data transformation similar to your hello.ts example
  // Map of challenge IDs to metadata (could be loaded from your database)
  const challengeIdMap: Record<
    string,
    { certification: string; block: string; name: string }
  > = challengeIdMapJson;
  // Organize into the nested structure
  const certifications: Record<
    string,
    {
      blocks: Array<
        Record<
          string,
          {
            completedChallenges: Array<{
              id: string;
              challengeName: string;
              completedDate: string;
              files: Array<object>;
            }>;
          }
        >
      >;
    }
  > = {};
  for (const challenge of challenges) {
    const metadata = challengeIdMap[challenge.id];
    if (!metadata) continue;

    const { certification, block, name } = metadata;

    // Initialize certification if it doesn't exist
    if (!certifications[certification]) {
      certifications[certification] = { blocks: [] };
    }

    // Find or create the block
    let blockObj = certifications[certification].blocks.find(
      b => Object.keys(b)[0] === block
    );

    if (!blockObj) {
      blockObj = { [block]: { completedChallenges: [] } };
      certifications[certification].blocks.push(blockObj);
    }

    // Add the challenge to the block
    if (blockObj[block]) {
      blockObj[block].completedChallenges.push({
        id: challenge.id,
        challengeName: name,
        completedDate: challenge.completedDate,
        files: challenge.files || []
      });
    }
  }
  // Transform to array format as needed by your client
  return Object.entries(certifications).map(([key, value]) => ({
    [key]: value
  }));
}
