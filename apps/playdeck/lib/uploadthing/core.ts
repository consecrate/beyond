import { createUploadthing, type FileRouter } from "uploadthing/next"

const f = createUploadthing()

/**
 * Single-image uploads for deck inline images and imported-slide blobs.
 * Matches prior client limits: one image, up to 5 MB after optimization.
 */
export const uploadRouter = {
  slideImage: f({
    image: {
      // Route config uses UploadThing’s file-size literals (no "5MB"); client still enforces 5 MB after optimization.
      maxFileSize: "8MB",
      maxFileCount: 1,
      minFileCount: 1,
    },
  })
    .middleware(() => ({}))
    .onUploadComplete(async ({ file }) => {
      void file.ufsUrl
      return {}
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
