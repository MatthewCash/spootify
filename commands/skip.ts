import Discord from 'discord.js';
import { Command } from '../main';
import { Player, players } from '../music';

export const execute: Command['execute'] = async (bot, message, args) => {
    const voice = message.member.voice;

    if (!voice?.channel || voice.mute || voice.serverMute) {
        return void message.channel.send(
            '🎵 You cant skip a song right now, make sure you are in a channel with permission to speak!'
        );
    }

    const admin = message.member.permissions.has('ADMINISTRATOR');

    const player = players.get(message.guild);

    const currentItem = player?.currentItem;

    if (!currentItem) {
        return void message.channel.send('❌ There is nothing to skip!');
    }

    if (currentItem.admin && !admin) {
        return void message.channel.send(
            '💎 You must be an administrator to skip this song!'
        );
    }

    message.channel.send(`⏩ Skipping \`${currentItem.title}\``);

    player.playNextSong();
};

export const responds = ['skip', 'next'];
