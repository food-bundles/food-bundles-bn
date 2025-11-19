import { Router } from 'express';
import {
  createContactSubmission,
  getContactSubmissions,
  getContactSubmission,
  updateContactSubmission,
  deleteContactSubmission,
  respondToSubmission
} from '../controllers/contact.controller';

const router = Router();

router.post('/contact-submissions', createContactSubmission);
router.get('/contact-submissions', getContactSubmissions);
router.get('/contact-submissions/:id', getContactSubmission);
router.put('/contact-submissions/:id', updateContactSubmission);
router.delete('/contact-submissions/:id', deleteContactSubmission);
router.post('/contact-submissions/:id/respond', respondToSubmission);

export default router;