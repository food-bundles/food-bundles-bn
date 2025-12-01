import { Router } from "express";
import {
  createContactSubmission,
  getContactSubmissions,
  getContactSubmission,
  updateContactSubmission,
  deleteContactSubmission,
  respondToSubmission,
} from "../controllers/contact.controller";

const contactRoutes = Router();

contactRoutes.post('/', createContactSubmission);
contactRoutes.get('/', getContactSubmissions);
contactRoutes.get('/:id', getContactSubmission);
contactRoutes.put('/:id', updateContactSubmission);
contactRoutes.delete('/:id', deleteContactSubmission);
contactRoutes.post('/:id/respond', respondToSubmission);

export default contactRoutes;
