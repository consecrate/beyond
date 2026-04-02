import { createRouteHandler } from "uploadthing/next"

import { uploadRouter } from "@/lib/uploadthing/core"

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
})
