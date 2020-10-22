import Discord from 'discord.js';
import { Command } from '../main';
import { Player, players } from '../music';

export const execute: Command['execute'] = async (bot, message, args) => {
    const voice = message.member.voice;

    if (!voice?.channel || voice.mute || voice.serverMute) {
        return void message.channel.send(
            "🎵 You can't repeat a song right now, make sure you are in a channel with permission to speak!"
        );
    }

    const player = players.get(message.guild);

    if (!player) {
        return void message.channel.send('❌ There is no player connected!');
    }
    if (!player.currentItem) {
        return void message.channel.send('❌ The player has no song!');
    }
    if (player.connection?.channel.id !== voice.channel?.id) {
        return void message.channel.send(
            '❌ You must be in the same channel as the player!'
        );
    }

    player.loop = !player.loop;
    if (player.loop) {
        message.channel.send('🔁 Player is now looping!');
    } else {
        message.channel.send('⏯ Player is no longer looping!');
    }
};

export const responds = ['loop', 'repeat'];
