/** Shared `useAccount` resolve shape for Firstly data. */
export const firstlyAccountResolve = {
  profile: true,
  root: {
    sessions: {
      $each: {
        lessons: { $each: true },
        skill_graph: { edges: { $each: true } },
      },
    },
  },
} as const
