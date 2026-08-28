import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Use temporary storage on Vercel
const isVercel = process.env.VERCEL === '1'

const uploadPath = isVercel
  ? '/tmp/uploads'
  : path.join(
      __dirname,
      '..',
      process.env.UPLOAD_DIR || 'uploads'
    )

// Create upload directory
fs.mkdirSync(uploadPath, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath)
  },

  filename: (_req, file, cb) => {
    const uniqueName =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}` +
      path.extname(file.originalname)

    cb(null, uniqueName)
  },
})

function imageOnlyFilter(_req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Only image files are allowed'))
    return
  }

  cb(null, true)
}

export default multer({
  storage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})