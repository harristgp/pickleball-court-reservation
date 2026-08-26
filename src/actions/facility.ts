'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { requireOwner } from '@/lib/session';
import { facilityFormSchema, courtFormSchema } from '@/lib/validators';
import { logger, sanitizeError } from '@/lib/logger';
import type { ActionState } from '@/lib/types';

export async function createFacilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/facilities');

  const parsed = facilityFormSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    address: formData.get('address'),
    city: formData.get('city'),
    latitude: formData.get('latitude') || null,
    longitude: formData.get('longitude') || null,
    openHour: formData.get('openHour'),
    closeHour: formData.get('closeHour'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the errors below.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.facility.create({
      data: {
        ownerId: userId,
        ...parsed.data,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        description: parsed.data.description || null,
      },
    });
  } catch (error) {
    logger.error('createFacilityAction failed', { userId, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to create facility. Please try again.' };
  }

  revalidatePath('/owner/facilities');
  redirect('/owner/facilities');
}

export async function updateFacilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/facilities');
  const facilityId = String(formData.get('facilityId') ?? '');

  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { ownerId: true } });
  if (!facility || facility.ownerId !== userId) return { ok: false, message: 'Facility not found.' };

  const parsed = facilityFormSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    address: formData.get('address'),
    city: formData.get('city'),
    latitude: formData.get('latitude') || null,
    longitude: formData.get('longitude') || null,
    openHour: formData.get('openHour'),
    closeHour: formData.get('closeHour'),
    isActive: formData.get('isActive'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the errors below.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.facility.update({
      where: { id: facilityId },
      data: {
        ...parsed.data,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        description: parsed.data.description || null,
      },
    });
  } catch (error) {
    logger.error('updateFacilityAction failed', { userId, facilityId, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to update facility.' };
  }

  revalidatePath('/owner/facilities');
  revalidatePath(`/owner/facilities/${facilityId}/edit`);
  return { ok: true, message: 'Facility updated.' };
}

export async function addCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/facilities');
  const facilityId = String(formData.get('facilityId') ?? '');

  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { ownerId: true } });
  if (!facility || facility.ownerId !== userId) return { ok: false, message: 'Facility not found.' };

  const parsed = courtFormSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    hourlyRate: formData.get('hourlyRate'),
    openHour: formData.get('openHour'),
    closeHour: formData.get('closeHour'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the errors below.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.court.create({
      data: { facilityId, ...parsed.data },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, message: 'A court with that name already exists at this facility.' };
    }
    logger.error('addCourtAction failed', { userId, facilityId, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to add court.' };
  }

  revalidatePath(`/owner/facilities/${facilityId}/edit`);
  return { ok: true, message: 'Court added.' };
}

export async function updateCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/facilities');
  const courtId = String(formData.get('courtId') ?? '');

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { facility: { select: { ownerId: true } } },
  });
  if (!court || court.facility.ownerId !== userId) return { ok: false, message: 'Court not found.' };

  const parsed = courtFormSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    hourlyRate: formData.get('hourlyRate'),
    openHour: formData.get('openHour'),
    closeHour: formData.get('closeHour'),
    isActive: formData.get('isActive'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the errors below.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.court.update({
      where: { id: courtId },
      data: parsed.data,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, message: 'A court with that name already exists at this facility.' };
    }
    logger.error('updateCourtAction failed', { userId, courtId, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to update court.' };
  }

  revalidatePath(`/owner/facilities/${court.facilityId}/edit`);
  return { ok: true, message: 'Court updated.' };
}

export async function uploadFacilityPhotosAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/facilities');
  const facilityId = String(formData.get('facilityId') ?? '');

  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { ownerId: true, photos: true } });
  if (!facility || facility.ownerId !== userId) return { ok: false, message: 'Facility not found.' };

  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, message: 'Select at least one photo.' };
  if (facility.photos.length + files.length > 20) {
    return { ok: false, message: 'Maximum 20 photos per facility.' };
  }

  try {
    const uploaded = await Promise.all(files.map((file) => storage.put(file, 'receipts')));
    await prisma.facility.update({
      where: { id: facilityId },
      data: { photos: { push: uploaded.map((u) => u.url) } },
    });
  } catch (error) {
    logger.error('uploadFacilityPhotosAction failed', { userId, facilityId, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to upload photos.' };
  }

  revalidatePath(`/owner/facilities/${facilityId}/edit`);
  return { ok: true, message: `${files.length} photo(s) uploaded.` };
}

export async function deleteFacilityPhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/facilities');
  const facilityId = String(formData.get('facilityId') ?? '');
  const photoUrl = String(formData.get('photoUrl') ?? '');

  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { ownerId: true, photos: true } });
  if (!facility || facility.ownerId !== userId) return { ok: false, message: 'Facility not found.' };

  const updated = facility.photos.filter((url) => url !== photoUrl);

  try {
    await prisma.facility.update({
      where: { id: facilityId },
      data: { photos: updated },
    });
    void storage.delete(photoUrl).catch(() => undefined);
  } catch (error) {
    logger.error('deleteFacilityPhotoAction failed', { userId, facilityId, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to delete photo.' };
  }

  revalidatePath(`/owner/facilities/${facilityId}/edit`);
  return { ok: true, message: 'Photo removed.' };
}
