/**
 * Singleton instances for invitation services
 *
 * Provides lazy-initialized instances of InvitationService, CapacityService,
 * and StudentRegistrationService for use in API routes.
 */

import { InvitationService } from './invitation-service';
import { CapacityService } from './capacity-service';
import { StudentRegistrationService } from './student-registration-service';
import { IInvitationRepository } from './interfaces';
import { SupabaseInvitationRepository } from '../persistence/supabase/invitation-repository';
import { getNamespaceRepository, getAuthProvider } from '../auth';
import { getStorage } from '../persistence';
import { getSupabaseClient } from '../supabase/client';

let invitationRepositoryInstance: IInvitationRepository | null = null;
let capacityServiceInstance: CapacityService | null = null;
let invitationServiceInstance: InvitationService | null = null;
let studentRegistrationServiceInstance: StudentRegistrationService | null = null;

/**
 * Get the invitation repository instance
 */
export async function getInvitationRepository(): Promise<IInvitationRepository> {
  if (!invitationRepositoryInstance) {
    invitationRepositoryInstance = new SupabaseInvitationRepository();
    await invitationRepositoryInstance.initialize?.();
  }
  return invitationRepositoryInstance;
}

/**
 * Get the capacity service instance
 */
export async function getCapacityService(): Promise<CapacityService> {
  if (!capacityServiceInstance) {
    const namespaceRepository = await getNamespaceRepository();
    const invitationRepository = await getInvitationRepository();
    capacityServiceInstance = new CapacityService(namespaceRepository, invitationRepository);
  }
  return capacityServiceInstance;
}

/**
 * Get the invitation service instance
 */
export async function getInvitationService(): Promise<InvitationService> {
  if (!invitationServiceInstance) {
    const invitationRepository = await getInvitationRepository();
    const capacityService = await getCapacityService();
    const supabaseAdmin = getSupabaseClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    invitationServiceInstance = new InvitationService(
      invitationRepository,
      capacityService,
      supabaseAdmin,
      appUrl
    );
  }
  return invitationServiceInstance;
}

/**
 * Get the student registration service instance
 */
export async function getStudentRegistrationService(): Promise<StudentRegistrationService> {
  if (!studentRegistrationServiceInstance) {
    const storage = await getStorage();
    const namespaceRepository = await getNamespaceRepository();
    const capacityService = await getCapacityService();
    const authProvider = await getAuthProvider();

    studentRegistrationServiceInstance = new StudentRegistrationService(
      storage.sections,
      namespaceRepository,
      capacityService,
      authProvider,
      storage.memberships
    );
  }
  return studentRegistrationServiceInstance;
}
