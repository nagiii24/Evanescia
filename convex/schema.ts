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

  // User-created playlists
  playlists: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Items inside playlists (one row per song in a playlist)
  playlistItems: defineTable({
    playlistId: v.id("playlists"),
    songId: v.string(),
    title: v.string(),
    artist: v.string(),
    thumbnailUrl: v.string(),
    duration: v.number(),
    addedAt: v.number(),
  })
    .index("by_playlistId", ["playlistId"])
    .index("by_playlist_song", ["playlistId", "songId"]),

  listeningRooms: defineTable({
    name: v.string(),
    slug: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    occupantCount: v.number(),
  }).index("by_slug", ["slug"]),

  listeningRoomMembers: defineTable({
    roomId: v.id("listeningRooms"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_userId", ["userId"])
    .index("by_room_user", ["roomId", "userId"]),
});
