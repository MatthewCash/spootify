import Discord from 'discord.js';
import { promises as fs } from 'fs';
import os from 'os';

const bot = new Discord.Client();
export const commandList = new Map<string, Command['execute']>();

export const commandPrefix = '>';

interface Status {
    type: Discord.ActivityOptions['type'];
    content: string;
}

const status: Status = {
    type: 'LISTENING',
    content: 'spootify'
};

export const setStatus = (type: string, content: string) => {
    if (type) status.type = type as Discord.ActivityOptions['type'];
    if (content) status.content = content;

    bot.user.setActivity(status.content, {
        type: status.type
    });
};

//--------------------------------------------
//----Load-Commands---------------------------
//--------------------------------------------

export interface Command {
    execute: (
        bot: Discord.Client,
        message: Discord.Message,
        args: string[],
        command: string
    ) => void | Promise<void>;
    responds: string[];
}

fs.readdir('./commands/').then(data => {
    const files = data.filter(file => file.split('.').pop() === 'ts');

    if (files.length <= 0) {
        return console.warn('No commands in ./commands/');
    }
    files.forEach(async file => {
        const command: Command = await import(`./commands/${file}`);
        if (
            typeof command?.execute !== 'function' ||
            !(command?.responds instanceof Array)
        ) {
            return console.error(`Command ${file} is invalid!`);
        }
        command.responds.forEach(respond =>
            commandList.set(respond, command.execute)
        );

        console.log(`[+] ${file} loaded`);
    });
});

const logChannelId = '712033733829591051';

const sendStartupLog = () => {
    const logChannel = bot.channels.resolve(
        logChannelId
    ) as Discord.TextChannel;

    const logEmbed = new Discord.MessageEmbed({
        title: `👋 ${bot.user.username} Started!`,
        description: `Loaded ${commandList.size} command listeners, watching ${bot.users.cache.size} users`,
        color: 0x00dd00,
        thumbnail: {
            url: bot.user.displayAvatarURL()
        },
        fields: [
            {
                name: 'Software',
                value: `${os.type()} ${os.release()}`
            },
            {
                name: 'NodeJS',
                value: process.version,
                inline: true
            },
            {
                name: 'Memory',
                value: `${(os.totalmem() / 1000000000).toFixed(2)} GB`,
                inline: true
            },
            {
                name: 'CPUs',
                value: os.cpus().length,
                inline: true
            }
        ],
        footer: {
            iconURL: bot.users.resolve('707005983955877969').displayAvatarURL(),
            text: `REV() Automated Intelligence`
        }
    });

    logChannel.send(logEmbed);
};

bot.on('ready', async () => {
    console.log('[Ready] Logged in to ' + bot.user.username);

    setInterval(() => {
        bot.user.setActivity(status.content, {
            type: status.type
        });
    }, 15000);

    sendStartupLog();
});

//--------------------------------------------
//----Command-Executer------------------------
//--------------------------------------------

bot.on('message', async message => {
    if (message.content.indexOf(commandPrefix) !== 0) return;
    const command = message.content
        .toLowerCase()
        .substr(commandPrefix.length)
        .split(' ')[0];
    const args = message.content.split(' ').slice(1);

    const execute = commandList.get(command);
    if (!execute) return;

    console.log([message.author.tag, command, args]);
    execute(bot, message, args, command);
});

bot.on('error', console.error);

console.log('Logging in with provided environmental token...');
bot.login(process.env.TOKEN);
