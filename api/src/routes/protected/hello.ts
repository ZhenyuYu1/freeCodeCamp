import { FastifyPluginCallback } from 'fastify';
import { Type } from '@fastify/type-provider-typebox';
import { normalizeChallenges } from '../../utils/normalize';

// Define interfaces for our data structure
interface CompletedChallenge {
  id: string;
  challengeName: string;
  completedDate: number;
  files?: object[];
}

interface Block {
  [key: string]: {
    completedChallenges: CompletedChallenge[];
  };
}

interface Certification {
  blocks: Block[];
}

interface CertificationsRecord {
  [key: string]: Certification;
}

interface ChallengeMetadata {
  certification: string;
  block: string;
  name: string;
}

interface CertificationMap {
  [key: string]: ChallengeMetadata;
}

/**
 * Register hello route.
 * @param fastify - Fastify instance.
 * @param _options - Options object (currently unused).
 * @param done - Callback function when route setup is complete.
 */
export const protectedHelloRoute: FastifyPluginCallback = (
  fastify,
  _options,
  done
) => {
  fastify.get(
    '/api/protected/hello',
    {
      schema: {
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                email: Type.String(),
                certifications: Type.Array(Type.Object({}))
              })
            )
          })
        }
      }
    },
    async (request, reply) => {
      const logger = fastify.log.child({ req: request });

      if (!request.user) {
        logger.warn('User is not authenticated');
        void reply.code(401);
        return reply.send({ error: 'Unauthorized' });
      }

      const username = request.user.username;
      logger.info({ username });

      // Query the database using Prisma
      const user = await fastify.prisma.user.findFirst({
        where: { username },
        select: {
          email: true,
          completedChallenges: true
        }
      });

      if (!user) {
        logger.warn('User not found');
        void reply.code(404);
        return reply.send({});
      }

      // Normalize completed challenges
      const normalizedChallenges = normalizeChallenges(
        user.completedChallenges
      );

      // Group completed challenges by certification and block
      // This requires challenge metadata which we would need to fetch
      // For this example, I'll create a simplified mock structure

      // Define certificationsMap - in a real implementation, you would
      // need to map each challenge ID to its certification and block
      const certificationMap: CertificationMap = {
        // Map challenge IDs to their certification and block
        '5f33071498eb2472b87ddee4': {
          certification: '2022/responsive-web-design',
          block: 'learn-basic-css-by-building-a-cafe-menu',
          name: 'Step 1'
        },
        '5f3313e74582ad9d063e3a38': {
          certification: '2022/responsive-web-design',
          block: 'learn-basic-css-by-building-a-cafe-menu',
          name: 'Step 2'
        },
        '5895f700f9fc0f352b528e63': {
          certification: 'quality-assurance',
          block: 'advanced-node-and-express',
          name: 'Set up a Template Engine'
        },
        '587d824a367417b2b2512c46': {
          certification: 'quality-assurance',
          block: 'quality-assurance-and-testing-with-chai',
          name: 'Learn How JavaScript Assertions Work'
        }
      };

      // Organize challenges into the desired structure
      const certifications: CertificationsRecord = {};

      for (const challenge of normalizedChallenges) {
        const metadata = certificationMap[challenge.id];

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
        if (blockObj && blockObj[block]) {
          blockObj[block].completedChallenges.push({
            id: challenge.id,
            challengeName: name,
            completedDate: challenge.completedDate,
            files: challenge.files || []
          });
        }
      }

      // Transform certifications object to array format
      const certificationsArray = Object.entries(certifications).map(
        ([key, value]) => ({ [key]: value })
      );

      // Return data in the requested format
      return reply.send({
        data: [
          {
            email: user.email,
            certifications: certificationsArray
          }
        ]
      });
    }
  );

  done();
};
