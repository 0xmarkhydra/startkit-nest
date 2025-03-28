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

    console.log('payload', payload);

    let user = await this.userRepository.findOne({ where: { telegram_id: payload.sub?.toString() } });
    console.log('user', user);
    if (!user) {
        user = await this.userRepository.save({
            username: payload.username,
            telegram_id: payload.sub,
        });
    }
    return user;
  }
  
  /**
   * Get users with pagination and filter by department and role
   */
  async getUsers(page: number, take: number, department?: Department, role?: UserRole) {
    console.log('department', department);
    console.log('role', role);
    console.log('page', page);
    console.log('take', take);
    
    // Create query builder
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    // Apply filters if provided
    // if (department) {
    //   queryBuilder.andWhere('user.department = :department', { department });
    // }
    
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }
    
    // Order by created_at descending
    queryBuilder.orderBy('user.created_at', 'DESC');
    
    // Return paginated result
    return paginate(queryBuilder, page, take);
  }
}
