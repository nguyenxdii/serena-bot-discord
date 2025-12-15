// src/db/mongo.js
const { MongoClient } = require("mongodb");
const { MONGODB_URI } = require("../config/env");

let client;
let db;

async function connectMongo() {
  if (!MONGODB_URI) {
    console.warn(
      "⚠️ Không có MONGODB_URI → chạy wallet dạng memory (không khuyến nghị)."
    );
    return null;
  }
  if (db) return db;

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db("bot_discord");
  console.log("✅ MongoDB connected");
  return db;
}

function getDb() {
  return db;
}

module.exports = { connectMongo, getDb };
