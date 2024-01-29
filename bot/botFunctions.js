const fetch = require('node-fetch'); 
const OpenAI = require('openai');
require('dotenv').config();
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  demuxProbe, 
} = require('@discordjs/voice');

const ffmpeg = require('ffmpeg-static');

const token = process.env.DISCORD_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const ytdl = require('ytdl-core');

const openai = new OpenAI({ apiKey: openaiApiKey });
const { EmbedBuilder } = require('discord.js');

async function handlePoll(message) {
  const args = message.content.slice('!poll'.length).trim().split(';');
  const pollQuestion = args[0];
  const pollTime = parseInt(args[1]) || 30;

  if (!pollQuestion) {
    return message.reply('Please provide a question for the poll.');
  }

  const pollMessage = await message.channel.send(`Poll: ${pollQuestion}`);
  await pollMessage.react('👍');
  await pollMessage.react('👎');

  const filter = (reaction, user) => {
    return ['👍', '👎'].includes(reaction.emoji.name) && !user.bot;
  };

  const results = await pollMessage.awaitReactions({
    filter,
    time: pollTime * 1000
  });

  const thumbsUpCount = (results.get('👍')?.count ?? 1) - 1;
  const thumbsDownCount = (results.get('👎')?.count ?? 1) - 1;

  await message.channel.send(`Poll Results for: ${pollQuestion}\n👍: ${thumbsUpCount} votes\n👎: ${thumbsDownCount} votes`);
}


async function getRandomAnimeWithRatingThreshold(threshold, genre,message) {
  for (let attempts = 0; attempts < 100; attempts++) {
    try {
      const url =
        `https://api.jikan.moe/v4/random/anime?genre=${encodeURIComponent(genre)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      const anime = data.data;
      if (!data.data) {
        console.error('No anime data found');
        continue; 
      }

      if (
         anime.score !== null &&
         anime.score !== undefined && 
         anime.score >= threshold
         ) {
        const animeEmbed = new EmbedBuilder()
          .setColor('#0099ff') 
          .setTitle(anime.title) 
          .setURL(`https://myanimelist.net/anime/${anime.mal_id}`) 
          .setImage(anime.images.jpg.large_image_url)
          .addFields(
            { name: 'Type', value: anime.type, inline: true }, 
            { name: 'Episodes', value: anime.episodes ? anime.episodes.toString() : 'N/A', inline: true }, 
            { name: 'Status', value: anime.status, inline: true },
            { name: 'Aired', value: anime.aired.string, inline: true },
            { name: 'Duration', value: anime.duration, inline: true }, 
            { name: 'Rating', value: anime.rating, inline: true }, 
            { name: 'Score', value: anime.score ? anime.score.toString() : 'N/A', inline: true }, 
            { name: 'Genres', value: anime.genres.map(genre => genre.name).join(', '), inline: false } 
          )
          .setFooter({ text: 'Data provided by Jikan API' }); 
        
          message.channel.send({ embeds: [animeEmbed] });
          break;
      }
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  }
  return null;
}



async function getRandomMangaWithRatingThreshold(threshold, genreName,message) {
  try {
   
    const response = await fetch('https://api.jikan.moe/v4/manga');
    const data = await response.json();
    const allManga = data.data;
    
    allManga.forEach(manga => {
      console.log(manga.title, manga.genres.map(g => g.name));
    });
    
    
    const filteredManga = allManga.filter(manga =>
      (manga.genres.some(genre => genre.name.toLowerCase() === genreName.toLowerCase()) ||
       manga.demographics.some(demo => demo.name.toLowerCase() === genreName.toLowerCase())) &&
      manga.score >= threshold
    );
      
 
    if (filteredManga.length === 0) {
      return null;
    }

  
    const randomIndex = Math.floor(Math.random() * filteredManga.length);
    return filteredManga[randomIndex];

  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}


async function handleChat(message) {
  try {
    const response = await openai.chat.completions.create({
      messages: [{ role: "system", content: "You are a helpful assistant." }],
      model: "gpt-3.5-turbo",
    });

    message.reply(response.choices[0].message.content);
  } catch (error) {
    console.error("Error calling OpenAI: ", error);
    message.reply("Sorry, I couldn't process your request.");
  }
}


async function showUserInfo(message) {
  let user = message.mentions.users.first() || message.author;
  let member = message.guild.members.cache.get(user.id);

  const userInfoEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`${user.username}'s Information`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Username', value: user.username, inline: true },
      { name: 'Discriminator', value: `#${user.discriminator}`, inline: true },
      { name: 'ID', value: user.id },
      { name: 'Avatar URL', value: `[Click Here](${user.displayAvatarURL({ dynamic: true, size: 1024 })})` },
      { name: 'Joined Server At', value: member.joinedAt.toDateString() },
      { name: 'Account Created At', value: user.createdAt.toDateString() }
    )
    .setFooter({ text: 'User Information' })
    .setTimestamp();

  message.channel.send({ embeds: [userInfoEmbed] });
}
async function playMusic(message) {
  // Check if the user is in a voice channel
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.channel.send("You need to be in a voice channel to play music!");
  }

  // Check for permissions
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
    return message.channel.send("I need the permissions to join and speak in your voice channel!");
  }

  // Split the message content to get the YouTube URL
  const args = message.content.split(' ');
  const youtubeURL = args[1];

  // Validate YouTube URL
  if (!ytdl.validateURL(youtubeURL)) {
    return message.channel.send("Please provide a valid YouTube URL.");
  }

  // Join the voice channel and play the audio
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  });

  // Create an audio player
  const player = createAudioPlayer();

  try {
    // Use ytdl-core to get a stream of the video
    const stream = ytdl(youtubeURL, { filter: 'audioonly' });
    const { stream: input, type } = await demuxProbe(stream);

    // Create an audio resource
    const resource = createAudioResource(input, { inputType: type, inlineVolume: true });
    resource.volume.setVolume(0.5); // You can adjust the volume here

    // Subscribe the connection to the audio player and play the audio
    connection.subscribe(player);
    player.play(resource);

    // Listen to the audio player's state to leave the channel when finished
    player.on(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    player.on('error', error => {
      console.error(`Error: ${error.message} with resource ${error.resource.metadata.title}`);
      player.stop();
    });
  } catch (error) {
    console.error(error);
    message.channel.send('Failed to play the audio.');
  }
  
}

async function getTop50Anime(message) {
  try {
    const url = 'https://api.jikan.moe/v4/top/anime?limit=25';
    const response = await fetch(url);
    const data = await response.json();

    if (!data.data) {
      console.error('No anime data found');
      message.channel.send('No anime data found.');
      return;
    }

    
    const topAnimeEmbed = new EmbedBuilder()
      .setColor('#0099ff') // Set the color of the embed
      .setTitle('Top 25 Anime') // Set the title of the embed
      .setURL('https://myanimelist.net/topanime.php') // Set the URL the title will link to
      .setDescription('Here are the top 25 anime based on popularity:')
      .setTimestamp() // You can set the timestamp to the current time
      .setFooter({ text: 'Data provided by Jikan API' }); // Set the footer of the embed

    
    data.data.forEach((anime, index) => {
      topAnimeEmbed.addFields({ name: `${index + 1}. ${anime.title} \nScore: ${anime.score} `, value: `[MyAnimeList link](https://myanimelist.net/anime/${anime.mal_id})` });
    });

    
    message.channel.send({ embeds: [topAnimeEmbed] });
  } catch (error) {
    console.error('Fetch error:', error);
    message.channel.send('Failed to fetch top anime.');
  }
}



module.exports = {
  getTop50Anime,
  playMusic,
  handlePoll,
  getRandomAnimeWithRatingThreshold,
  getRandomMangaWithRatingThreshold,
  handleChat,
  showUserInfo
};
