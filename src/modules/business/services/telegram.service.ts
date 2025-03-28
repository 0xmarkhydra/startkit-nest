import { Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

const COMMANDS = {
    START: '/start',
    SURVEY: '/survey',
    HELP: '/help',
}

@Injectable()
export class TelegramService {
    private bot: Telegraf;
    private static instance: TelegramService;

    @Inject(AuthService)
    private authService: AuthService;

    constructor() {
        // Initialize bot with your token
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
        this.initializeCommands();
    }

    public static getInstance(): TelegramService {
        if (!TelegramService.instance) {
            TelegramService.instance = new TelegramService();
        }
        return TelegramService.instance;
    }

    private async handleStart(ctx: any): Promise<void> {
        console.log('🔵 TelegramService handleStart :', { ctx });
        const webUrl = process.env.WEB_URL;
        const accessToken = await this.getCode(ctx);
        const surveyUrl = webUrl + '?code=' + accessToken;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.url('Login', surveyUrl)]
        ]);

        // Send a more detailed welcome message with the login button
        await ctx.reply(
            'Welcome to HR Support Bot! 👋\n\n' +
            'I am here to assist you with HR-related inquiries and services. ' +
            'Please click the button below to log in and access all available features.',
            keyboard
        );
    }

    private initializeCommands(): void {
        // Handle /start command with survey parameter
        this.bot.command('start', async (ctx) => {
            console.log('ctx', ctx.message);
            console.log('payload', ctx.payload);
            console.log('🔵 TelegramService initializeCommands /start command received');
            if(ctx.payload === COMMANDS.SURVEY) {
                await this.handleSurveyStart(ctx);
            } else {
                await this.handleStart(ctx);
            }
        });

        this.bot.command('survey', async (ctx) => {
            console.log('🔵 TelegramService initializeCommands /survey command received');
            await this.handleSurveyStart(ctx);
        });

        // this.bot.command('help', async (ctx) => {
        //     console.log('🔵 TelegramService initializeCommands /help command received');
        //     await this.handleHelp(ctx);
        // });
    }

    // private async handleHelp(ctx: any): Promise<void> {
    //     console.log('🔵 TelegramService handleHelp :', { ctx });
    //     await ctx.reply('I am an HR Support Bot. How can I assist you today?');
    // }

    private async getCode(ctx: any): Promise<string> {
        const payloadJWT = {
            sub: ctx.from.id,
            username: ctx.from.username,
        }
        const accessToken = await this.authService.getAccessToken(payloadJWT);
        return accessToken;
    }

    private async handleSurveyStart(ctx: any): Promise<void> {
        console.log('🔵 TelegramService handleSurveyStart :', { ctx });
        
        const webUrl = process.env.WEB_URL;
        if (!webUrl) {
            console.error('❌ TelegramService handleSurveyStart WEB_URL is not configured');
            await ctx.reply('Sorry, the survey system is currently unavailable. Please try again later.');
            return;
        }

        if (!webUrl.startsWith('https://')) {
            console.error('❌ TelegramService handleSurveyStart WEB_URL must be HTTPS');
            await ctx.reply('Sorry, the survey system is currently unavailable. Please try again later.');
            return;
        }

        const accessToken = await this.getCode(ctx);
        const surveyUrl = webUrl + '/evaluation?code=' + accessToken;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.url('Take Survey', surveyUrl)]
        ]);

        await ctx.reply('📊 Please click the button below to take the survey ', keyboard);
    }

    public start(): void {
        console.log('🔵 TelegramService start : Starting bot');
        this.bot.launch();
    }

    async onApplicationBootstrap() {
        this.start();
    }
}

export default TelegramService; 