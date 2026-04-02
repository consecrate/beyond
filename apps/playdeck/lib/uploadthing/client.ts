import { genUploader } from "uploadthing/client"

import type { UploadRouter } from "@/lib/uploadthing/core"

export const { uploadFiles } = genUploader<UploadRouter>({
  package: "uploadthing",
})
