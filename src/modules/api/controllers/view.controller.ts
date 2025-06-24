import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class ViewController {
  @Get('staking-dashboard')
  @ApiExcludeEndpoint()
  getStakingDashboard(@Res() res: Response) {
    return res.sendFile(join(process.cwd(), 'public/staking.html'));
  }
} 