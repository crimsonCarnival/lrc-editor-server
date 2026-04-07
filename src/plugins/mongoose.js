import fp from 'fastify-plugin';
import mongoose from 'mongoose';

async function mongoosePlugin(fastify) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI env var is required');

  await mongoose.connect(uri);
  fastify.log.info('MongoDB connected');

  fastify.addHook('onClose', async () => {
    await mongoose.connection.close();
  });
}

export default fp(mongoosePlugin, { name: 'mongoose' });
