import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { createBookingSchema } from '../validators/bookings.validator';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendEmail } from '../config/email';
import { bookingConfirmationEmail, bookingCancellationEmail } from '../templates/emails';

export const getAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        guest: { select: { name: true } },
        listing: { select: { title: true } }
      }
    });
    res.json(bookings);
  } catch (error) { next(error); }
};

export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: {
        guest: { select: { name: true, email: true } },
        listing: { include: { host: { select: { name: true } } } }
      }
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  } catch (error) { next(error); }
};

export const createBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = createBookingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.issues });

    const { listingId, checkIn, checkOut } = result.data;
    const guestId = req.userId as number;

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);

    // 💅 PART 5: THE TRANSACTION GLOW-UP
    // We wrap the check and the create in a transaction to prevent race conditions.
    const newBooking = await prisma.$transaction(async (tx) => {
      // 1. Check if listing exists (using the transaction client 'tx')
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (!listing) throw new Error("NOT_FOUND");

      // 2. Check for overlapping CONFIRMED bookings
      const conflict = await tx.booking.findFirst({
        where: {
          listingId,
          status: "CONFIRMED",
          checkIn: { lt: outDate },
          checkOut: { gt: inDate }
        }
      });

      if (conflict) {
        // This stops the transaction and jumps to our catch block
        throw new Error("BOOKING_CONFLICT");
      }

      // 3. Calculate the damage (totalPrice)
      const days = Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalPrice = days * listing.pricePerNight;

      // 4. Create the booking as PENDING
      return tx.booking.create({
        data: {
          listingId,
          guestId,
          checkIn: inDate,
          checkOut: outDate,
          totalPrice,
          status: "PENDING"
        },
        include: { listing: true, guest: true } // Include data needed for email
      });
    });

    // If we reached here, the transaction was a success! 
    res.status(201).json(newBooking);

    // 📧 Best-effort email (doesn't need to block the response)
    try {
      await sendEmail(
        newBooking.guest.email,
        "Your Booking is Confirmed!",
        bookingConfirmationEmail(
          newBooking.guest.name,
          newBooking.listing.title,
          newBooking.listing.location,
          inDate.toDateString(),
          outDate.toDateString(),
          newBooking.totalPrice
        )
      );
    } catch (emailError) {
      console.error("[EMAIL ERROR] Confirmation email failed:", emailError);
    }

  } catch (error: any) {
    // 💅 Catching our custom transaction errors
    if (error.message === "BOOKING_CONFLICT") {
      return res.status(409).json({ error: "These dates are already snatched! Try a different time, bestie." });
    }
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "That listing doesn't exist." });
    }
    next(error);
  }
};

export const deleteBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bookingId = parseInt(req.params.id as string);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        listing: true
      }
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.guestId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You can only cancel your own bookings" });
    }

    if (booking.status === "CANCELLED") {
      return res.status(400).json({ error: "Booking is already cancelled" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" }
    });

    res.json(updatedBooking);

    try {
      await sendEmail(
        booking.guest.email,
        "Your Booking Has Been Cancelled",
        bookingCancellationEmail(
          booking.guest.name,
          booking.listing.title,
          booking.checkIn.toDateString(),
          booking.checkOut.toDateString()
        )
      );
    } catch (emailError) {
      console.error("[EMAIL ERROR] Cancellation email failed:", emailError);
    }
  } catch (error) { next(error); }
};