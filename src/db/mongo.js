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

  client = new MongoClient(MONGODB_URI, {
    // ✅ chống treo vô hạn
    serverSelectionTimeoutMS: 5000, // tìm server tối đa 5s
    connectTimeoutMS: 5000, // connect tối đa 5s
    socketTimeoutMS: 10000, // request tối đa 10s
  });

  await client.connect();
  db = client.db("bot_discord");
  console.log("✅ MongoDB connected");
  return db;
}

function getDb() {
  return db;
}

module.exports = { connectMongo, getDb };
