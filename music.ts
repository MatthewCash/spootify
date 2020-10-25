import Discord, { ShardClientUtil } from 'discord.js';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import ytSearch from 'yt-search';
import ytdl from 'ytdl-core';
import scdl from 'soundcloud-downloader';

enum SongType {
    YOUTUBE,
    SOUNDCLOUD
}
interface Song {
    type: SongType;
    url: string;
    title: string;
    author: string;
    views: number;
    admin: boolean;
    duration: number;
    stream?: Readable;
    image: string;
}

class Queue<T> extends Array<T> {
    constructor(items?: T[]) {
        super(...items);
    }
    static create<T>(): Queue<T> {
        return Object.create(Queue.prototype);
    }
    get() {
        return this.shift();
    }
    peek() {
        return this[0];
    }
    add(item: T) {
        return this.push(item);
    }
}

// Events
export declare interface Player {
    on(event: 'added', listener: (song: Song) => void);
    on(event: 'done', listener: (song?: Song) => void);
    on(event: 'processing', listener: (song: Song) => void);
    on(
        event: 'playing',
        listener: (dispatcher: Discord.StreamDispatcher) => void
    );
    on(event: 'goodbye', listener: () => void);
}

export class Player extends EventEmitter {
    queue: Queue<Song>;
    playing: boolean;
    connection: Discord.VoiceConnection;
    currentItem?: Song;
    dispatcher?: Discord.StreamDispatcher;
    loop: boolean;
    constructor(connection: Discord.VoiceConnection) {
        super();

        this.connection = connection;
        this.queue = Queue.create<Song>();
        this.playing = false;
        this.loop = false;

        this.startProcessingQueue();

        this.connection.once('disconnect', this.shutdown);
    }
    async startProcessingQueue() {
        while (this.connection?.status === 0) {
            let lastSong: Song;
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
                lastSong = await new Promise<Song>(r => this.on('done', r));
            }

            this.currentItem = null;
            this.playing = false;

            // Shutdown player if there are no members in channel
            if (this.connection.channel.members.size === 0) {
                this.shutdown();
                break;
            }

            if (this.loop && lastSong) {
                this.playSong(lastSong);
            } else {
                this.playNextSong();
            }
        }
        this.shutdown();
    }
    playNextSong() {
        const nextSong = this.queue.get();

        if (!nextSong) {
            if (this.playing) {
                this.dispatcher?.end();
                this.emit('done');
            }
            return;
        }

        this.playSong(nextSong);
    }
    async playSong(song: Song) {
        if (this.connection?.status !== 0) return;

        this.currentItem = song;

        this.emit('processing', this.currentItem);

        if (song.type === SongType.YOUTUBE) {
            song.stream = ytdl(song.url, {
                filter: 'audioonly'
            });
        } else if (song.type === SongType.SOUNDCLOUD) {
            song.stream = await scdl.downloadFormat(
                song.url,
                scdl.FORMATS.OPUS
            );
        }

        this.dispatcher = this.connection.play(song.stream);

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

        let song: Song;

        // SoundCloud

        if (scdl.isValidUrl(query)) {
            const result = await scdl.getInfo(query);
            song = {
                type: SongType.SOUNDCLOUD,
                url: result.permalink_url,
                title: result.title,
                author: result.user.username,
                views: result.playback_count,
                admin,
                duration: result.duration,
                image: result.artwork_url
            };
            return song;
        }

        // YouTube

        try {
            const videoId = ytdl.getURLVideoID(query);
            result = await ytSearch({ videoId });
        } catch {
            const searchResults = await ytSearch(query);
            result = searchResults?.videos?.[0];
        }

        if (!result) return;

        song = {
            type: SongType.YOUTUBE,
            url: result.url,
            title: result.title,
            author: result.author.name,
            views: result.views,
            admin,
            duration: result.duration.seconds,
            image: result.image
        };

        return song;
    }
    addToQueue(song: Song) {
        this.queue.add(song);
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
}

export const players = new WeakMap<Discord.Guild, Player>();
