import Discord from 'discord.js';
import { Command } from '../main';
import { Player, players } from '../music';
import { getFormattedTime } from './queue';

export const execute: Command['execute'] = async (bot, message, args) => {
    const voice = message.member.voice;

    if (!voice?.channel || voice.mute || voice.serverMute) {
        return void message.channel.send(
            '🎵 You cant play a song right now, make sure you are in a channel with permission to speak!'
        );
    }

    const admin = message.member.permissions.has('ADMINISTRATOR');
    const query = args.join(' ');

    let player = players.get(message.guild);

    if (!query && player?.playing === false) {
        if (player.connection?.channel.id !== voice.channel?.id) {
            return void message.channel.send(
                '❌ You must be in the same channel as the player!'
            );
        }
        player.resume();
        return void message.channel.send('▶ Player is now resumed!');
    }

    if (!query) {
        return void message.channel.send(
            '❌ Please send a song to search in your title!'
        );
    }

    if (query.includes('drift away')) {
        return void message.channel.send('⚠ NO');
    }

    message.channel.send(`🔍 Searching for \`${query}\``);

    const song = await Player.search(query, admin);

    if (!song) {
        return void message.channel.send('❌ No song could be found!');
    }

    if (!player) {
        const connection = await message.member.voice.channel.join();
        player = new Player(connection);
        players.set(message.guild, player);
    }

    player.addToQueue(song);

    const addedEmbed = new Discord.MessageEmbed({
        title: song.raw.title,
        description: 'New song added to Queue',
        color: 0x009900,
        thumbnail: {
            url: song.raw.image
        },
        fields: [
            {
                name: 'Views',
                value: song.raw.views.toLocaleString('en'),
                inline: true
            },
            {
                name: 'Duration',
                value: getFormattedTime(song.duration),
                inline: true
            },
            {
                name: 'Artist',
                value: song.raw.author.name,
                inline: true
            }
        ]
    });

    message.channel.send(addedEmbed);
};

export const responds = ['play', 'resume'];
