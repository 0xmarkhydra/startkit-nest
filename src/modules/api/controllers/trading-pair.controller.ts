import { Controller, Get, Post, Body, Param, Put, Delete, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { TradingPairService } from '../../business/services/trading-pair.service';
import { TradingPair } from '../../database/entities/trading-pair.entity';
import { CreateTradingPairDto, UpdateTradingPairDto, ToggleActiveDto } from '../dtos/trading-pair';

@ApiTags('Trading Pairs')
@Controller('trading-pairs')
export class TradingPairController {
  constructor(private readonly tradingPairService: TradingPairService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các cặp tiền tệ' })
  @ApiResponse({ 
    status: 200, 
    description: 'Danh sách các cặp tiền tệ',
    type: [TradingPair]
  })
  async findAll(): Promise<TradingPair[]> {
    return this.tradingPairService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Lấy danh sách các cặp tiền tệ đang hoạt động' })
  @ApiResponse({ 
    status: 200, 
    description: 'Danh sách các cặp tiền tệ đang hoạt động',
    type: [TradingPair]
  })
  async findActive(): Promise<TradingPair[]> {
    return this.tradingPairService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một cặp tiền tệ' })
  @ApiParam({ 
    name: 'id', 
    description: 'ID của cặp tiền tệ',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Thông tin chi tiết cặp tiền tệ',
    type: TradingPair
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Không tìm thấy cặp tiền tệ với ID đã cung cấp'
  })
  async findOne(@Param('id') id: string): Promise<TradingPair> {
    const tradingPair = await this.tradingPairService.findOne(id);
    if (!tradingPair) {
      throw new HttpException('Không tìm thấy cặp tiền tệ', HttpStatus.NOT_FOUND);
    }
    return tradingPair;
  }

  @Post()
  @ApiOperation({ 
    summary: 'Tạo mới một cặp tiền tệ',
    description: 'Tạo mới một cặp tiền tệ'
  })
  @ApiBody({
    description: 'Thông tin cặp tiền tệ mới',
    schema: {
      example: {
        symbol: 'BTC/USDT',
        is_active: true
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Tạo cặp tiền tệ thành công',
    type: TradingPair
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Dữ liệu không hợp lệ' 
  })
  async create(@Body() createTradingPairDto: CreateTradingPairDto): Promise<TradingPair> {
    return this.tradingPairService.create(createTradingPairDto);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Cập nhật thông tin cặp tiền tệ',
    description: 'Cập nhật trạng thái hoạt động của cặp tiền tệ'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID của cặp tiền tệ cần cập nhật',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiBody({
    description: 'Thông tin cập nhật',
    schema: {
      example: {
        is_active: false
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cập nhật cặp tiền tệ thành công',
    type: TradingPair
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Không tìm thấy cặp tiền tệ với ID đã cung cấp' 
  })
  async update(
    @Param('id') id: string, 
    @Body() updateTradingPairDto: UpdateTradingPairDto
  ): Promise<TradingPair> {
    const updated = await this.tradingPairService.update(id, updateTradingPairDto);
    if (!updated) {
      throw new HttpException('Không tìm thấy cặp tiền tệ', HttpStatus.NOT_FOUND);
    }
    return updated;
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Xóa một cặp tiền tệ',
    description: 'Xóa vĩnh viễn một cặp tiền tệ khỏi hệ thống'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID của cặp tiền tệ cần xóa',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Xóa cặp tiền tệ thành công',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Không tìm thấy cặp tiền tệ với ID đã cung cấp' 
  })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const tradingPair = await this.tradingPairService.findOne(id);
    if (!tradingPair) {
      throw new HttpException('Không tìm thấy cặp tiền tệ', HttpStatus.NOT_FOUND);
    }
    await this.tradingPairService.delete(id);
    return { success: true };
  }

  @Put(':id/toggle-active')
  @ApiOperation({ 
    summary: 'Bật/tắt trạng thái hoạt động',
    description: 'Kích hoạt hoặc vô hiệu hóa một cặp tiền tệ'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID của cặp tiền tệ cần thay đổi trạng thái',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiBody({
    description: 'Trạng thái hoạt động mới',
    schema: {
      example: {
        is_active: true
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cập nhật trạng thái thành công',
    type: TradingPair
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Không tìm thấy cặp tiền tệ với ID đã cung cấp' 
  })
  async toggleActive(
    @Param('id') id: string, 
    @Body() toggleActiveDto: ToggleActiveDto
  ): Promise<TradingPair> {
    const updated = await this.tradingPairService.toggleActive(id, toggleActiveDto.is_active);
    if (!updated) {
      throw new HttpException('Không tìm thấy cặp tiền tệ', HttpStatus.NOT_FOUND);
    }
    return updated;
  }

  @Post('seed')
  @ApiOperation({ 
    summary: 'Tạo các cặp tiền tệ mặc định',
    description: 'Tạo các cặp tiền tệ mặc định nếu chưa tồn tại'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Đã tạo các cặp tiền tệ mặc định',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true }
      }
    }
  })
  async seedDefaultPairs(): Promise<{ success: boolean }> {
    await this.tradingPairService.seedDefaultPairs();
    return { success: true };
  }
}