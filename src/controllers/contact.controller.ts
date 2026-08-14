import { Request, Response } from 'express';
import prisma from '../prisma';
import nodemailer from 'nodemailer';

export const createContactSubmission = async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body;

    // Save to database
    const submission = await prisma.contactSubmission.create({
      data: { name, email, message }
    });

    // Send email notification
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GOOGLE_EMAIL,
        pass: process.env.GOOGLE_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.GOOGLE_EMAIL,
      to: process.env.GOOGLE_EMAIL,
      subject: `Contact Form Message from ${name}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
        <p><strong>Submission ID:</strong> ${submission.id}</p>
      `,
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
};

export const getContactSubmissions = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    const submissions = await prisma.contactSubmission.findMany({
      where: search ? {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { message: { contains: search as string, mode: 'insensitive' } }
        ]
      } : {},
      orderBy: { createdAt: 'desc' }
    });

    res.json(submissions);
  } catch (error) {
    console.error('Fetch submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

export const getContactSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const submission = await prisma.contactSubmission.findUnique({
      where: { id }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    console.error('Fetch submission error:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
};

export const updateContactSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, message, status, response } = req.body;
    
    const submission = await prisma.contactSubmission.update({
      where: { id },
      data: { name, email, message, status, response }
    });

    res.json(submission);
  } catch (error) {
    console.error('Update submission error:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
};

export const deleteContactSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.contactSubmission.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete submission error:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
};

export const respondToSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    
    const submission = await prisma.contactSubmission.findUnique({
      where: { id }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Update submission with response
    await prisma.contactSubmission.update({
      where: { id },
      data: { response, status: 'responded' }
    });

    // Send email response
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GOOGLE_EMAIL,
        pass: process.env.GOOGLE_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.GOOGLE_EMAIL,
      to: submission.email,
      subject: `Re: Your message to Food Bundles`,
      html: `
        <h3>Response to Your Contact Form Submission</h3>
        <p>Dear ${submission.name},</p>
        <p>Thank you for contacting us. Here's our response to your message:</p>
        <blockquote style="border-left: 3px solid #ccc; padding-left: 10px; margin: 10px 0;">
          ${submission.message}
        </blockquote>
        <p><strong>Our Response:</strong></p>
        <p>${response}</p>
        <p>Best regards,<br>Food Bundles Team</p>
      `,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Respond to submission error:', error);
    res.status(500).json({ error: 'Failed to send response' });
  }
};