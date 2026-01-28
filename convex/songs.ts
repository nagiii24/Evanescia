import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user ID from Clerk
export async function getUserId(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  // Find user by clerkId (subject from Clerk JWT)
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .first();

  if (existingUser) {
    return existingUser._id;
  }

  // Create new user
  return await ctx.db.insert("users", {
    clerkId: identity.subject,
    name: identity.name || "User",
    email: identity.email || "",
  });
}

// Add a liked song
export const addLike = mutation({
  args: {
    songId: v.string(),
    title: v.string(),
    artist: v.string(),
    thumbnailUrl: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Check if already liked
    const existing = await ctx.db
      .query("likedSongs")
      .withIndex("by_userId_songId", (q: any) =>
        q.eq("userId", userId).eq("songId", args.songId)
      )
      .first();

    if (existing) {
      return existing._id; // Already liked
    }

    // Add to liked songs
    return await ctx.db.insert("likedSongs", {
      userId,
      songId: args.songId,
      title: args.title,
      artist: args.artist,
      thumbnailUrl: args.thumbnailUrl,
      duration: args.duration,
    });
  },
});

// Remove a liked song
export const removeLike = mutation({
  args: {
    songId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const liked = await ctx.db
      .query("likedSongs")
      .withIndex("by_userId_songId", (q: any) =>
        q.eq("userId", userId).eq("songId", args.songId)
      )
      .first();

    if (liked) {
      await ctx.db.delete(liked._id);
    }
  },
});

// Get all liked songs for current user
export const getLikes = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = await getUserId(ctx);
    const likedSongs = await ctx.db
      .query("likedSongs")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .collect();

    return likedSongs.map((song) => ({
      id: song.songId,
      title: song.title,
      artist: song.artist,
      thumbnailUrl: song.thumbnailUrl,
      duration: song.duration,
    }));
  },
});

// Check if a song is liked
export const isLiked = query({
  args: {
    songId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const userId = await getUserId(ctx);
    const liked = await ctx.db
      .query("likedSongs")
      .withIndex("by_userId_songId", (q: any) =>
        q.eq("userId", userId).eq("songId", args.songId)
      )
      .first();

    return !!liked;
  },
});

// Add a song to history
export const addHistory = mutation({
  args: {
    songId: v.string(),
    title: v.string(),
    artist: v.string(),
    thumbnailUrl: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const timestamp = Date.now();

    // Remove any existing entry for this song to avoid duplicates
    const existing = await ctx.db
      .query("history")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.eq(q.field("songId"), args.songId))
      .first();

    if (existing) {
      // Update timestamp if already exists
      await ctx.db.patch(existing._id, { timestamp });
      return existing._id;
    }

    // Add new history entry
    return await ctx.db.insert("history", {
      userId,
      songId: args.songId,
      title: args.title,
      artist: args.artist,
      thumbnailUrl: args.thumbnailUrl,
      duration: args.duration,
      timestamp,
    });
  },
});

// Get history for current user (most recent first)
export const getHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = await getUserId(ctx);
    const limit = args.limit || 100; // Default to 100 most recent

    const history = await ctx.db
      .query("history")
      .withIndex("by_userId_timestamp", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return history.map((item) => ({
      id: item.songId,
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      duration: item.duration,
      timestamp: item.timestamp,
    }));
  },
});

// Clear history
export const clearHistory = mutation({
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const historyItems = await ctx.db
      .query("history")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .collect();

    // Delete all history items
    await Promise.all(historyItems.map((item) => ctx.db.delete(item._id)));
  },
});
