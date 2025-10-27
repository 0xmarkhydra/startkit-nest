import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from '@/database/repositories';
import { AuditLogEntity } from '@/database/entities';

@Injectable()
export class AuditLogService {
  constructor(private auditLogRepository: AuditLogRepository) {}

  /**
   * Log an action to audit log
   */
  async logAction(
    action: string,
    userId?: string,
    address?: string,
    metadata?: any,
  ): Promise<AuditLogEntity> {
    console.log(`🔍 [AuditLogService] [logAction] Creating audit log for action: ${action}`);
    
    const auditLog = this.auditLogRepository.create({
      action,
      userId,
      address,
      metadata,
    });
    
    const saved = await this.auditLogRepository.save(auditLog);
    
    console.log(`✅ [AuditLogService] [logAction] Audit log saved with id: ${saved.id}`);
    
    return saved;
  }

  /**
   * Get audit logs by user ID
   */
  async getAuditLogsByUserId(userId: string): Promise<AuditLogEntity[]> {
    console.log(`🔍 [AuditLogService] [getAuditLogsByUserId] Getting audit logs for user: ${userId}`);
    
    const auditLogs = await this.auditLogRepository.find({
      where: { userId },
      order: { created_at: 'DESC' },
    });
    
    console.log(`✅ [AuditLogService] [getAuditLogsByUserId] Found ${auditLogs.length} audit logs`);
    
    return auditLogs;
  }
}

