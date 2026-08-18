import { Router, Request } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import prisma from '../database';
import { requireAuth, AuthenticatedRequest } from '../middleware';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs and Word documents are allowed'));
    }
  }
});

router.post('/', requireAuth, upload.single('file'), async (req: Request, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const projectId = req.body?.projectId || null;
    const document = await prisma.document.create({
      data: {
        name: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        type: req.file.mimetype,
        projectId: projectId || null,
        ownerId: user.id
      }
    });

    res.status(201).json(document);
  } catch (error: any) {
    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
