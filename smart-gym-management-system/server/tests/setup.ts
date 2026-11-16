import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { User, hashPassword } from '../src/models/User';
import { signAccessToken } from '../src/utils/tokens';

process.env.NODE_ENV = 'test';

let mongod: MongoMemoryServer;

export async function startTestServer() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  return createApp();
}

export async function stopTestServer() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

/** Create a user directly in the DB and return an Authorization header value. */
export async function authHeaderFor(role: string, email = `${role}-${Math.random().toString(36).slice(2, 8)}@test.com`) {
  const user = await User.create({
    name: `Test ${role}`, email, passwordHash: await hashPassword('Password@123'), role,
  });
  const token = signAccessToken({ sub: String(user._id), role: user.role, email: user.email });
  return { header: `Bearer ${token}`, user };
}

export { request };
