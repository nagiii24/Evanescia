// Temporary stub - will be replaced when you run 'npx convex dev' with Node.js v20+
// This allows the app to compile, but Convex features won't work until real files are generated

export const api: {
  songs: {
    getLikes: (args?: any) => any;
    addLike: (args?: any) => any;
    removeLike: (args?: any) => any;
    isLiked: (args?: any) => any;
    getHistory: (args?: any) => any;
    addHistory: (args?: any) => any;
    clearHistory: (args?: any) => any;
  };
} = {
  songs: {
    getLikes: () => {},
    addLike: () => {},
    removeLike: () => {},
    isLiked: () => {},
    getHistory: () => {},
    addHistory: () => {},
    clearHistory: () => {},
  },
} as any;
