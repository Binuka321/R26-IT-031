const fs = require('fs')
const path = require('path')
const multer = require('multer')

const uploadDir = process.env.UPLOAD_DIR || 'uploads'
const uploadPath = path.join(__dirname, '..', uploadDir)

fs.mkdirSync(uploadPath, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath)
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
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

module.exports = multer({
  storage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})
