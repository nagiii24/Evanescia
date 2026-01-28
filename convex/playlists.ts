import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./songs";

// Create a new playlist for the current user
export const createPlaylist = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const createdAt = Date.now();

    return await ctx.db.insert("playlists", {
      userId,
      name: args.name,
      description: args.description || "",
      createdAt,
    });
  },
});

// Add a song to a playlist (no duplicate song entries)
export const addSongToPlaylist = mutation({
  args: {
    playlistId: v.id("playlists"),
    songId: v.string(),
    title: v.string(),
    artist: v.string(),
    thumbnailUrl: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify playlist ownership
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist) throw new Error("Playlist not found");
    if (String(playlist.userId) !== String(userId)) {
      throw new Error("Not authorized to modify this playlist");
    }

    // Check for existing song in playlist
    const existing = await ctx.db
      .query("playlistItems")
      .withIndex("by_playlist_song", (q: any) =>
        q.eq("playlistId", args.playlistId).eq("songId", args.songId)
      )
      .first();

    if (existing) return existing._id; // already present

    return await ctx.db.insert("playlistItems", {
      playlistId: args.playlistId,
      songId: args.songId,
      title: args.title,
      artist: args.artist,
      thumbnailUrl: args.thumbnailUrl,
      duration: args.duration,
      addedAt: Date.now(),
    });
  },
});

// Remove a song from a playlist
export const removeSongFromPlaylist = mutation({
  args: {
    playlistId: v.id("playlists"),
    songId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist) throw new Error("Playlist not found");
    if (String(playlist.userId) !== String(userId)) {
      throw new Error("Not authorized to modify this playlist");
    }

    const item = await ctx.db
      .query("playlistItems")
      .withIndex("by_playlist_song", (q: any) =>
        q.eq("playlistId", args.playlistId).eq("songId", args.songId)
      )
      .first();

    if (item) {
      await ctx.db.delete(item._id);
    }
  },
});

// Get songs for a playlist
export const getPlaylistSongs = query({
  args: {
    playlistId: v.id("playlists"),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("playlistItems")
      .withIndex("by_playlistId", (q: any) => q.eq("playlistId", args.playlistId))
      .order("asc")
      .collect();

    return items.map((it) => ({
      id: it.songId,
      title: it.title,
      artist: it.artist,
      thumbnailUrl: it.thumbnailUrl,
      duration: it.duration,
      addedAt: it.addedAt,
    }));
  },
});

// Get playlists for current user
export const getUserPlaylists = query({
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const lists = await ctx.db
      .query("playlists")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .collect();

    return lists.map((p) => ({ id: p._id, name: p.name, description: p.description, createdAt: p.createdAt }));
  },
});
