import Discord from 'discord.js';
import { Command } from '../main';
import { Player, players } from '../music';

export const execute: Command['execute'] = async (bot, message, args) => {
    const voice = message.member.voice;

    if (!voice?.channel || voice.mute || voice.serverMute) {
        return void message.channel.send(
            '🎵 You cant stop the player right now, make sure you are in a channel with permission to speak!'
        );
    }

    const player = players.get(message.guild);
    if (!player) {
        return void message.channel.send('❌ There is no player connected!');
    }
    player.shutdown();
    message.channel.send('🛑 Player has disconnected!');
};

export const responds = ['stop', 'leave', 'disconnect', 'shutdown'];
