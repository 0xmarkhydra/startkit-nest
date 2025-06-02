import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { join } from 'path';

@ApiTags('Frontend')
@Controller()
export class FrontendController {
  @Get()
  @ApiOperation({ summary: 'Render frontend dashboard' })
  serveIndex(@Res() res: Response) {
    return res.sendFile(join(process.cwd(), 'public', 'index.html'));
  }

  @Get('simple')
  @ApiOperation({ summary: 'Render simple frontend view' })
  serveSimple(@Res() res: Response) {
    return res.sendFile(join(process.cwd(), 'public', 'simple.html'));
  }
}
