import { assertLoaded, co, Group, z } from "jazz-tools"

/** Prerequisite edge between two lessons (IDs are Jazz coValue ids). */
export const SessionSkillEdge = co.map({
  from_lesson_id: z.string(),
  to_lesson_id: z.string(),
})

/** JSON string of {@link import("@/features/firstly/data-types").SessionGraphLayoutV1}. */
export const FirstlySessionGraph = co.map({
  graphMetadataJson: z.string(),
  edges: co.list(SessionSkillEdge),
})

export const FirstlyLesson = co.map({
  /** Account id of the lesson author; used for sharing and attribution. */
  owner_account_id: z.string(),
  title: z.string(),
  goal_text: z.string(),
  lesson_markdown: z.string(),
  entry_mode: z.string(),
  subject_domain: z.string(),
  future_graph_mode: z.string(),
  status: z.string(),
  skill_tree_completed: z.optional(z.boolean()),
  created_at: z.string(),
  updated_at: z.string(),
})

export const FirstlySession = co.map({
  title: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  lessons: co.list(FirstlyLesson),
  skill_graph: FirstlySessionGraph,
})

export const FirstlyRoot = co.map({
  sessions: co.list(FirstlySession),
})

const FirstlyProfile = co.profile({
  name: z.string(),
})

export const FirstlyAccount = co
  .account({
    profile: FirstlyProfile,
    root: FirstlyRoot,
  })
  .withMigration(async (account, creationProps) => {
    if (!account.$jazz.has("root")) {
      account.$jazz.set(
        "root",
        FirstlyRoot.create(
          {
            sessions: co.list(FirstlySession).create([], account),
          },
          account,
        ),
      )
    } else {
      const loaded = await account.$jazz.ensureLoaded({
        resolve: { root: true },
      })
      assertLoaded(loaded.root)
      if (!loaded.root.$jazz.has("sessions")) {
        loaded.root.$jazz.set(
          "sessions",
          co.list(FirstlySession).create([], account),
        )
      }
    }

    if (!account.$jazz.has("profile")) {
      const profileGroup = Group.create()
      profileGroup.addMember("everyone", "reader")
      account.$jazz.set(
        "profile",
        FirstlyProfile.create(
          { name: creationProps?.name?.trim() || "Learner" },
          profileGroup,
        ),
      )
    }

    const loadedForLessons = await account.$jazz.ensureLoaded({
      resolve: {
        root: {
          sessions: {
            $each: {
              lessons: { $each: true },
            },
          },
        },
      },
    })
    assertLoaded(loadedForLessons.root)
    const sessions = loadedForLessons.root.sessions
    assertLoaded(sessions)
    for (const sess of [...sessions]) {
      assertLoaded(sess)
      const lessons = sess.lessons
      assertLoaded(lessons)
      for (const lesson of [...lessons]) {
        assertLoaded(lesson)
        if (!lesson.$jazz.has("owner_account_id")) {
          lesson.$jazz.set("owner_account_id", account.$jazz.id)
        }
      }
    }
  })
