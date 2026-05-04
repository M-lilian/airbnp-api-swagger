import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { createListingSchema, updateListingSchema } from '../validators/listings.validator';
import { AuthRequest } from '../middlewares/auth.middleware'; 
import { getOptimizedUrl } from '../config/cloudinary';

/**
 * 💅 PART 6: RAW QUERY STATS
 * This uses $queryRaw to get grouped statistics directly from the database.
 * We use template literals because Prisma automatically parameterizes them to prevent SQL Injection.
 */
export const getListingStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        location, 
        COUNT(*)::int AS total, 
        ROUND(AVG("pricePerNight")::numeric, 2) AS avg_price,
        MIN("pricePerNight") AS min_price,
        MAX("pricePerNight") AS max_price
      FROM "Listing"
      GROUP BY location
      ORDER BY total DESC
    `;
    res.json(stats);
  } catch (error) { next(error); }
};

export const getAllListings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const listings = await prisma.listing.findMany({
      skip,
      take: limit,
      include: {
        host: { select: { name: true, avatar: true } },
        _count: { select: { bookings: true } },
        photos: true 
      }
    });

    // 💅 Optimize all photos for the feed!
    const formattedListings = listings.map(listing => ({
      ...listing,
      photos: listing.photos.map(photo => ({
        ...photo,
        url: getOptimizedUrl(photo.url, 500, 500)
      }))
    }));

    res.json(formattedListings);
  } catch (error) { next(error); }
};

export const getListingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: {
        host: true,
        bookings: {
          include: {
            guest: { select: { name: true, avatar: true } }
          }
        },
        photos: true 
      }
    });
    
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // 🛑 SECURITY PATCH! Scrub the host's password
    if (listing.host) {
      const { password, resetToken, resetTokenExpiry, ...safeHost } = listing.host as any;
      listing.host = safeHost;
    }

    // 💅 Optimize the URLs before sending them to the user
    const formattedListing = {
      ...listing,
      photos: listing.photos.map(photo => ({
        ...photo,
        url: getOptimizedUrl(photo.url, 500, 500)
      }))
    };

    res.json(formattedListing);
  } catch (error) { next(error); }
};

export const createListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = createListingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.issues });

    const listing = await prisma.listing.create({ 
      data: { 
        ...result.data, 
        hostId: req.userId as number 
      } 
    });
    res.status(201).json(listing);
  } catch (error) { next(error); }
};

export const updateListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listingId = parseInt(req.params.id as string);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.hostId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only edit your own listings" });
    }

    const result = updateListingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.issues });

    const updatedListing = await prisma.listing.update({
      where: { id: listingId },
      data: result.data
    });
    res.json(updatedListing);
  } catch (error) { next(error); }
};

export const deleteListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listingId = parseInt(req.params.id as string);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.hostId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only delete your own listings" });
    }

    await prisma.listing.delete({ where: { id: listingId } });
    res.status(204).send();
  } catch (error) { next(error); }
};