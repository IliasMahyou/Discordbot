const { Client, Events, GatewayIntentBits,EmbedBuilder } = require('discord.js');
const OpenAI = require('openai');
const { handlePoll,getRandomAnimeWithRatingThreshold,getRandomMangaWithRatingThreshold,handleChat,showUserInfo } = require('./botFunctions');
let { token,openaiApiKey } = require('./config.json');
const openai = new OpenAI({ apiKey: openaiApiKey });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  
  if (message.author.bot) return;


//!poll command
 if(message.content.startsWith('!poll')){
  try{
    await handlePoll(message);
  }catch(error)
  {
    console.error("Error handling poll:",error)
  }
    
}
// !info command
else if (message.content.startsWith('!info')) {
  
  const infoMessage = 
 `Meow! I'm your meow meow bot.

  Use !poll to create polls.
  Use !userinfo to see your or another user's info. 
  Use !chat to talk to ChatGPT (currently unavailable) 
  Use !randomAnime to get a anime with a rating of 7 or above 
  Use !randomManga to get a random manga with a rating of 7 or above`;
  return message.reply(infoMessage);
}

// !ranomdAnime command
if (message.content.startsWith('!randomAnime')) {
  getRandomAnimeWithRatingThreshold(7) 
    .then(anime => {
      if (anime) {
        message.reply(`Found an Anime: ${anime.title} - Rating: ${anime.score} - More info: ${anime.url}`);
      } else {
        message.reply('Could not find an Anime with the desired rating after several attempts.');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      message.reply('Sorry, there was an error.');
    });
}




//!ranomdManga command
if (message.content.startsWith('!randomManga')) {
  getRandomMangaWithRatingThreshold(7) 
      .then(manga => {
          if (manga) {
              message.reply(`Found a Manga: ${manga.title} - Rating: ${manga.score} - More info: ${manga.url}`);
          } else {
              message.reply('Could not find a manga with the desired rating after several attempts.');
          }
      })
      .catch(error => {
          console.error('Error:', error);
          message.reply('Sorry, there was an error.');
      });
}


//!chat command to talk to gpt
if (message.content.startsWith('!chat')) {
  try {
    const response = await getOpenAIResponse();
    message.reply(response.choices[0].message.content);
  } catch (error) {
    console.error("Error calling OpenAI: ", error);
    message.reply("Sorry, I couldn't process your request.");
  }
}
//!userinfo command, fetch a users info
if (message.content.startsWith('!userinfo')) {
  try {
   await  showUserInfo(message);
  } catch (error) {
    console.error("Userinfo Error: ", error)
  }
   
}

});

client.login(token);


