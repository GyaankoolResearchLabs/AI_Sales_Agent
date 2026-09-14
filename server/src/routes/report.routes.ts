import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { list, create, update, remove, run, preview, exportCSV, exportPDF } from '../controllers/report.controller';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/', create);
router.post('/preview', preview);
router.patch('/:id', update);
router.delete('/:id', remove);
router.get('/:id/run', run);
router.get('/:id/export.csv', exportCSV);
router.get('/:id/export.pdf', exportPDF);

export default router;
