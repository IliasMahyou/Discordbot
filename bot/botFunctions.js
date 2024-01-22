const fetch = require('node-fetch'); 
const OpenAI = require('openai');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

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


async function getRandomAnimeWithRatingThreshold(threshold, genre) {
  for (let attempts = 0; attempts < 100; attempts++) {
    try {
     
      const url =
        `https://api.jikan.moe/v4/random/anime?genre=${encodeURIComponent(genre)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      const anime = data.data;

      if (anime.score >= threshold) {
        return anime;
      }
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  }
  return null;
}



async function getRandomMangaWithRatingThreshold(threshold, genreName) {
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

module.exports = {
  handlePoll,
  getRandomAnimeWithRatingThreshold,
  getRandomMangaWithRatingThreshold,
  handleChat,
  showUserInfo
};
