const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'blog_polls';
const COLLECTION_NAME = 'polls';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not set');
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function getPollData(db, pollId) {
  const collection = db.collection(COLLECTION_NAME);
  const votes = await collection.find({ poll_id: pollId }).toArray();

  const result = { votes: {}, total: 0 };
  votes.forEach(vote => {
    result.votes[vote.option_id] = (result.votes[vote.option_id] || 0) + 1;
    result.total++;
  });

  return result;
}

async function submitVote(db, pollId, optionId) {
  const collection = db.collection(COLLECTION_NAME);
  await collection.insertOne({
    poll_id: pollId,
    option_id: optionId,
    created_at: new Date()
  });
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { db } = await connectToDatabase();
    const { pollId } = req.query;

    if (!pollId) {
      return res.status(400).json({ error: 'Missing pollId' });
    }

    if (req.method === 'GET') {
      const data = await getPollData(db, pollId);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { optionId } = req.body;

      if (!optionId) {
        return res.status(400).json({ error: 'Missing optionId' });
      }

      await submitVote(db, pollId, optionId);
      const data = await getPollData(db, pollId);
      return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
