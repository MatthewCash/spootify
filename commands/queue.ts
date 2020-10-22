import Discord from 'discord.js';
import { Command } from '../main';
import { Player, players } from '../music';

// 123 -> 2:03
export const getFormattedTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds - minutes * 60;
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${minutes}:${paddedSeconds}`;
};

export const execute: Command['execute'] = async (bot, message, args) => {
    const player = players.get(message.guild);
    if (!player?.queue?.length) {
        return void message.channel.send('❌ There are no items in queue!');
    }

    const formattedQueue = player.queue.map(song => ({
        title: song.raw.title,
        duration: getFormattedTime(song.duration)
    }));

    const oneItem = player.queue.length === 1;

    const queueEmbed = new Discord.MessageEmbed({
        title: 'Current Queue',
        color: 0x009900,
        description: `There ${oneItem ? 'is' : 'are'} **${
            player.queue.length
        }** song${oneItem ? '' : 's'} in queue!`,
        thumbnail: {
            url: bot.user.displayAvatarURL()
        },
        fields: formattedQueue.map((song, index) => ({
            name: `**${index + 1}** ${song.title}`,
            value: `Duration: **${song.duration}**`
        }))
    });

    message.channel.send(queueEmbed);
};

export const responds = ['queue', 'songs'];
