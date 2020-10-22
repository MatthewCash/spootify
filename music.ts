import Discord from 'discord.js';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import ytSearch from 'yt-search';
import ytdl from 'ytdl-core';

interface Song {
    type: 'youtube' | 'soundcloud';
    url: string;
    admin: boolean;
    duration: number;
    stream?: Readable;
    raw: ytSearch.VideoSearchResult | ytSearch.VideoMetadataResult;
}

type Queue = Song[];

// Events
export declare interface Player {
    on(event: 'added', listener: (song: Song) => void);
    on(event: 'done', listener: (song: Song) => void);
    on(event: 'processing', listener: (song: Song) => void);
    on(
        event: 'playing',
        listener: (dispatcher: Discord.StreamDispatcher) => void
    );
    on(event: 'goodbye', listener: () => void);
}

export class Player extends EventEmitter {
    queue: Queue;
    playing: boolean;
    connection: Discord.VoiceConnection;
    currentItem?: Song;
    dispatcher?: Discord.StreamDispatcher;
    loop: boolean;
    constructor(connection: Discord.VoiceConnection) {
        super();

        this.connection = connection;
        this.queue = [];
        this.playing = false;
        this.loop = false;

        this.startProcessingQueue();

        this.connection.once('disconnect', this.shutdown);
    }
    // get playing() {
    //     return !this.dispatcher?.paused
    // }
    async startProcessingQueue() {
        while (this.connection?.status === 0) {
            let loopSong: Song;
            if (!this.currentItem) {
                const song = await Promise.race([
                    new Promise(r => this.on('added', r)), // Wait for new item in queue
                    new Promise(r => setTimeout(r, 60000)) // 1 min timeout
                ]);

                if (!song) {
                    this.shutdown();
                    break;
                }
            } else {
                loopSong = await new Promise<Song>(r => this.on('done', r));
            }
            if (this.connection.channel.members.size === 0) {
                this.shutdown();
                break;
            }
            if (loopSong && this.loop) {
                this.playSong(loopSong);
            } else {
                this.playNextSong();
            }
        }
        this.shutdown();
    }
    playNextSong() {
        if (this.connection?.status !== 0) return;

        const nextSong = this.queue.shift();

        if (!nextSong) {
            if (this.playing) this.pause();
            return;
        }

        this.playSong(nextSong);
    }
    playSong(song: Song) {
        if (this.connection?.status !== 0) return;

        this.currentItem = song;

        this.emit('processing', this.currentItem);

        this.currentItem.stream = ytdl(this.currentItem.url, {
            filter: 'audioonly'
        });

        this.dispatcher = this.connection.play(this.currentItem.stream);

        this.playing = true;
        this.emit('playing', this.dispatcher);

        this.dispatcher.on('finish', () => this.emit('done', song));
    }
    pause() {
        this.playing = false;
        this.dispatcher.pause();
    }
    resume() {
        if (!this.currentItem) throw new Error('No item to play!');
        this.dispatcher.resume();
        this.playing = true;
    }
    static async search(query: string, admin = false): Promise<Song> {
        let result: ytSearch.VideoSearchResult | ytSearch.VideoMetadataResult;

        try {
            const videoId = ytdl.getURLVideoID(query);
            result = await ytSearch({ videoId });
        } catch {
            const searchResults = await ytSearch(query);
            result = searchResults?.videos?.[0];
        }

        if (!result) return;

        const song: Song = {
            type: 'youtube',
            url: result.url,
            admin,
            duration: result.duration.seconds,
            raw: result
        };

        return song;
    }
    addToQueue(song: Song) {
        this.queue.push(song);
        this.emit('added', song);
    }
    shutdown() {
        this.emit('goodbye');
        this.connection.disconnect();
        players.delete(this.connection.channel.guild);
    }
    duration() {
        return this.dispatcher.streamTime;
    }
    // playing() {
    //     return this.dispatcher && !this.dispatcher.paused
    // }
}

export const players = new WeakMap<Discord.Guild, Player>();
