import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getExistingUserIdOrNull, getUserId } from "./songs";

const MAX_ROOM_NAME_LEN = 80;

function baseSlugFromName(name: string): string {
  const raw = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return raw.length > 0 ? raw : "room";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function uniqueSlug(ctx: any, name: string): Promise<string> {
  const base = baseSlugFromName(name);
  for (let attempt = 0; attempt < 24; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const existing = await ctx.db
      .query("listeningRooms")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();
    if (!existing) return slug;
  }
  throw new Error("Could not allocate a unique room URL");
}

async function leaveAllRoomsForUser(ctx: any, userId: any): Promise<void> {
  const memberships = await ctx.db
    .query("listeningRoomMembers")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  for (const m of memberships) {
    const room = await ctx.db.get(m.roomId);
    await ctx.db.delete(m._id);
    if (room) {
      const next = Math.max(0, (room.occupantCount ?? 0) - 1);
      await ctx.db.patch(room._id, { occupantCount: next });
    }
  }
}

function sortRoomsByCreatedAtDesc<T extends { createdAt: number }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => b.createdAt - a.createdAt);
}

export const listEmptyRooms = query({
  args: {},
  handler: async (ctx) => {
    // Full table scan + filter: room count stays small; avoids index/order edge cases on deploys.
    const rooms = await ctx.db.query("listeningRooms").collect();
    return sortRoomsByCreatedAtDesc(rooms.filter((r) => r.occupantCount === 0)).map(
      (r) => ({
        _id: r._id,
        name: r.name,
        slug: r.slug,
        createdAt: r.createdAt,
      }),
    );
  },
});

export const listRoomsDirectory = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("listeningRooms").collect();
    const empty = sortRoomsByCreatedAtDesc(all.filter((r) => r.occupantCount === 0));
    const occupied = sortRoomsByCreatedAtDesc(all.filter((r) => r.occupantCount > 0));

    const map = (r: (typeof all)[number]) => ({
      _id: r._id,
      name: r.name,
      slug: r.slug,
      createdAt: r.createdAt,
      occupantCount: r.occupantCount,
    });

    return {
      empty: empty.map(map),
      occupied: occupied.map(map),
    };
  },
});

/** Room details plus members (who is here + headcount from membership rows). */
export const getRoomWithMembersBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("listeningRooms")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!room) return null;

    const memberships = await ctx.db
      .query("listeningRoomMembers")
      .withIndex("by_roomId", (q: any) => q.eq("roomId", room._id))
      .collect();

    memberships.sort((a, b) => a.joinedAt - b.joinedAt);

    const members: { userId: (typeof memberships)[number]["userId"]; name: string; joinedAt: number }[] = [];
    for (const m of memberships) {
      const u = await ctx.db.get(m.userId);
      members.push({
        userId: m.userId,
        name: u?.name?.trim() || "Guest",
        joinedAt: m.joinedAt,
      });
    }

    const serverNowMs = Date.now();
    const playbackSongId = room.playbackSongId;
    const playback =
      playbackSongId &&
      room.playbackAnchorMs !== undefined &&
      room.playbackPositionSec !== undefined
        ? {
            song: {
              id: playbackSongId,
              title: room.playbackTitle ?? "",
              artist: room.playbackArtist ?? "",
              thumbnailUrl: room.playbackThumbnailUrl ?? "",
              duration: room.playbackDuration ?? 0,
            },
            anchorMs: room.playbackAnchorMs,
            positionSec: room.playbackPositionSec,
            isPlaying: room.playbackIsPlaying ?? false,
            updatedAt: room.playbackUpdatedAt ?? 0,
          }
        : null;

    return {
      _id: room._id,
      name: room.name,
      slug: room.slug,
      createdAt: room.createdAt,
      occupantCount: room.occupantCount,
      /** Mirrors table rows; prefer this for display if it ever disagrees with occupantCount. */
      memberCount: members.length,
      members,
      playback,
      serverNowMs,
    };
  },
});

const roomSongValidator = v.object({
  id: v.string(),
  title: v.string(),
  artist: v.string(),
  thumbnailUrl: v.string(),
  duration: v.number(),
});

export const syncRoomPlayback = mutation({
  args: {
    slug: v.string(),
    positionSec: v.number(),
    isPlaying: v.boolean(),
    song: v.optional(roomSongValidator),
    clear: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const room = await ctx.db
      .query("listeningRooms")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!room) throw new Error("Room not found");

    const membership = await ctx.db
      .query("listeningRoomMembers")
      .withIndex("by_room_user", (q: any) =>
        q.eq("roomId", room._id).eq("userId", userId),
      )
      .first();
    if (!membership) throw new Error("Not a member of this room");

    const now = Date.now();

    if (args.clear) {
      await ctx.db.patch(room._id, {
        playbackSongId: undefined,
        playbackTitle: undefined,
        playbackArtist: undefined,
        playbackThumbnailUrl: undefined,
        playbackDuration: undefined,
        playbackAnchorMs: undefined,
        playbackPositionSec: undefined,
        playbackIsPlaying: undefined,
        playbackUpdatedAt: undefined,
      });
      return;
    }

    if (!args.song) {
      throw new Error("song is required unless clear is true");
    }

    await ctx.db.patch(room._id, {
      playbackSongId: args.song.id,
      playbackTitle: args.song.title,
      playbackArtist: args.song.artist,
      playbackThumbnailUrl: args.song.thumbnailUrl,
      playbackDuration: args.song.duration,
      playbackAnchorMs: now,
      playbackPositionSec: args.positionSec,
      playbackIsPlaying: args.isPlaying,
      playbackUpdatedAt: now,
    });
  },
});

/** Current user’s Convex `users` id (for “you” in member lists). */
export const getMyConvexUserId = query({
  args: {},
  handler: async (ctx) => {
    return await getExistingUserIdOrNull(ctx);
  },
});

export const createRoom = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Room name is required");
    if (trimmed.length > MAX_ROOM_NAME_LEN) {
      throw new Error(`Room name must be at most ${MAX_ROOM_NAME_LEN} characters`);
    }

    const slug = await uniqueSlug(ctx, trimmed);
    const createdAt = Date.now();

    const roomId = await ctx.db.insert("listeningRooms", {
      name: trimmed,
      slug,
      createdByUserId: userId,
      createdAt,
      occupantCount: 0,
    });

    return { roomId, slug };
  },
});

export const joinRoom = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const room = await ctx.db
      .query("listeningRooms")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!room) throw new Error("Room not found");

    await leaveAllRoomsForUser(ctx, userId);

    const existing = await ctx.db
      .query("listeningRoomMembers")
      .withIndex("by_room_user", (q: any) =>
        q.eq("roomId", room._id).eq("userId", userId),
      )
      .first();

    if (existing) {
      return { slug: room.slug };
    }

    await ctx.db.insert("listeningRoomMembers", {
      roomId: room._id,
      userId,
      joinedAt: Date.now(),
    });

    await ctx.db.patch(room._id, {
      occupantCount: (room.occupantCount ?? 0) + 1,
    });

    return { slug: room.slug };
  },
});

export const leaveRoom = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const room = await ctx.db
      .query("listeningRooms")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!room) return;

    const membership = await ctx.db
      .query("listeningRoomMembers")
      .withIndex("by_room_user", (q: any) =>
        q.eq("roomId", room._id).eq("userId", userId),
      )
      .first();

    if (!membership) return;

    await ctx.db.delete(membership._id);
    const next = Math.max(0, (room.occupantCount ?? 0) - 1);
    await ctx.db.patch(room._id, { occupantCount: next });
  },
});
