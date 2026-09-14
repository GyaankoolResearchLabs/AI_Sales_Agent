import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { previewCSV, commit } from '../controllers/import.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);

router.post('/csv/preview', upload.single('file'), previewCSV);
router.post('/csv/commit', commit);

export default router;
