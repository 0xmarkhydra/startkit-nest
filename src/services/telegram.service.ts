import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';

interface SurveyConfig {
    url: string;
    title: string;
    description: string;
}

class TelegramService {
    private bot: Telegraf;
    private static instance: TelegramService;
    private surveyConfig: SurveyConfig;

    private constructor() {
        // Initialize bot with your token
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
        }
        this.bot = new Telegraf(token);
        
        // Initialize survey configuration
        this.surveyConfig = {
            url: process.env.SURVEY_URL || 'https://your-survey-url.com',
            title: 'Employee Satisfaction Survey',
            description: 'Help us improve your work experience'
        };

        this.initializeCommands();
        this.initializeErrorHandling();
    }

    public static getInstance(): TelegramService {
        if (!TelegramService.instance) {
            TelegramService.instance = new TelegramService();
        }
        return TelegramService.instance;
    }

    private initializeCommands(): void {
        // Handle /start command
        this.bot.command('start', async (ctx: Context) => {
            console.log('🔵 TelegramService initializeCommands /start command received');
            await this.handleStart(ctx);
        });

        // Handle /survey command
        this.bot.command('survey', async (ctx: Context) => {
            console.log('🔵 TelegramService initializeCommands /survey command received');
            await this.handleSurvey(ctx);
        });

        // Handle /help command
        this.bot.command('help', async (ctx: Context) => {
            console.log('🔵 TelegramService initializeCommands /help command received');
            await this.handleHelp(ctx);
        });
    }

    private initializeErrorHandling(): void {
        this.bot.catch((err: Error) => {
            console.error('🔴 TelegramService Error:', err);
        });
    }

    private async handleStart(ctx: Context): Promise<void> {
        try {
            console.log('🔵 TelegramService handleStart :', { ctx });
            
            const welcomeMessage = `👋 Welcome to HR Bot!

I'm your dedicated HR assistant, here to help you with:
• Employee surveys
• HR-related information
• Company policies

Use /help to see all available commands.`;

            await ctx.reply(welcomeMessage);
        } catch (error) {
            console.error('🔴 TelegramService handleStart Error:', error);
            await ctx.reply('Sorry, something went wrong. Please try again later.');
        }
    }

    private async handleSurvey(ctx: Context): Promise<void> {
        try {
            console.log('🔵 TelegramService handleSurvey :', { ctx });
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.url('📝 Take Survey', this.surveyConfig.url)]
            ]);

            const message = `📊 ${this.surveyConfig.title}\n\n${this.surveyConfig.description}\n\nPlease click the button below to participate:`;

            await ctx.reply(message, keyboard);
        } catch (error) {
            console.error('🔴 TelegramService handleSurvey Error:', error);
            await ctx.reply('Sorry, the survey is currently unavailable. Please try again later.');
        }
    }

    private async handleHelp(ctx: Context): Promise<void> {
        try {
            console.log('🔵 TelegramService handleHelp :', { ctx });
            
            const helpMessage = `🤖 Available Commands:

/start - Start the bot and get welcome message
/survey - Access the employee satisfaction survey
/help - Show this help message

Need more assistance? Contact HR department.`;

            await ctx.reply(helpMessage);
        } catch (error) {
            console.error('🔴 TelegramService handleHelp Error:', error);
            await ctx.reply('Sorry, something went wrong. Please try again later.');
        }
    }

    public start(): void {
        try {
            console.log('🔵 TelegramService start : Starting bot');
            this.bot.launch();
            
            // Enable graceful stop
            process.once('SIGINT', () => this.bot.stop('SIGINT'));
            process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
        } catch (error) {
            console.error('🔴 TelegramService start Error:', error);
            throw error;
        }
    }
}

export default TelegramService; 