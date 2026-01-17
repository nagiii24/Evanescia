import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
  })
    .index("by_clerkId", ["clerkId"]),

  likedSongs: defineTable({
    userId: v.id("users"),
    songId: v.string(),
    title: v.string(),
    artist: v.string(),
    thumbnailUrl: v.string(),
    duration: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_songId", ["userId", "songId"]),

  history: defineTable({
    userId: v.id("users"),
    songId: v.string(),
    title: v.string(),
    artist: v.string(),
    thumbnailUrl: v.string(),
    duration: v.number(),
    timestamp: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_timestamp", ["userId", "timestamp"]),
});
