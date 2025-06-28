import { Controller, Get, Render } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Frontend')
@Controller()
export class FrontendController {
  @Get()
  @ApiOperation({ 
    summary: 'Serve main application',
    description: 'Serve the main investment application frontend' 
  })
  @ApiResponse({
    status: 200,
    description: 'Main application page'
  })
  @Render('index')
  async getIndex() {
    return {
      title: 'Investment App',
      description: 'Secure investment platform with 30% annual returns'
    };
  }

  @Get('dashboard')
  @ApiOperation({ 
    summary: 'Serve dashboard page',
    description: 'Serve the user dashboard page' 
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard page'
  })
  @Render('dashboard')
  async getDashboard() {
    return {
      title: 'Dashboard - Investment App',
      description: 'View your investments and earnings'
    };
  }

  @Get('login')
  @ApiOperation({ 
    summary: 'Serve login page',
    description: 'Serve the login page for email/password authentication' 
  })
  @ApiResponse({
    status: 200,
    description: 'Login page'
  })
  @Render('login')
  async getLogin() {
    return {
      title: 'Login - Investment App',
      description: 'Log in to access your investment dashboard'
    };
  }

  @Get('register')
  @ApiOperation({ 
    summary: 'Serve register page',
    description: 'Serve the registration page for new users' 
  })
  @ApiResponse({
    status: 200,
    description: 'Registration page'
  })
  @Render('register')
  async getRegister() {
    return {
      title: 'Register - Investment App',
      description: 'Create an account to start investing'
    };
  }
} 