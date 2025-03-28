import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminConfigRepository, UserRepository } from '@/database/repositories';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TJWTPayload } from '@/shared/types';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { Department, UserRole } from '@/database/entities';
import { paginate } from '@/shared/pagination/pagination';

@Injectable()
export class UserService {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(AuthService)
  private readonly authService: AuthService;

  async verifyToken(token: string) {
    const payload: TJWTPayload = await this.authService.verifyAccessToken(token);
    let user = await this.userRepository.findOne({ where: { telegram_id: payload.sub } });
    if (!user) {
        user = await this.userRepository.save({
            telegram_id: payload.sub,
            username: payload.username,
        });
    }
    return user;
  }
  
  /**
   * Get users with pagination and filter by department and role
   */
  async getUsers(page: number, take: number, department?: Department, role?: UserRole) {
    // Create query builder
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    // Apply filters if provided
    if (department) {
      queryBuilder.andWhere('user.department = :department', { department });
    }
    
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }
    
    // Order by created_at descending
    queryBuilder.orderBy('user.created_at', 'DESC');
    
    // Return paginated result
    return paginate(queryBuilder, page, take);
  }
}
