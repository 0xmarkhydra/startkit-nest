import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from '@/business/services/user.service';
import { UserFilterDto } from '../dtos/user-filter.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Users')
@Controller('users')
export class UserController {
  @Inject(UserService)
  private readonly userService: UserService;

  @Get()
  @ApiOperation({ summary: 'Get users with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Return paginated users' })
  async getUsers(@Query() query: UserFilterDto) {
    const { page, take, department, role } = query;
    return this.userService.getUsers(page, take, department, role);
  }
}
