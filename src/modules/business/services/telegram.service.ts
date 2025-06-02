import { Injectable, Inject, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject('TELEGRAM_BOT_TOKEN') private readonly token: string,
    @Inject('TELEGRAM_CHAT_ID') private readonly chatIdParam: string,
  ) {
    this.chatId = chatIdParam;
    
    if (this.token) {
      try {
        this.bot = new TelegramBot.default(this.token, { polling: false });
        this.logger.log('Telegram bot initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Telegram bot', error);
      }
    } else {
      this.logger.warn('No Telegram bot token provided');
    }
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.bot || !this.chatId) {
      this.logger.warn(`Telegram not configured. Message: ${message}`);
      return false;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      this.logger.log('Message sent successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to send Telegram message: ${error.message}`, error.stack);
      return false;
    }
  }
}
