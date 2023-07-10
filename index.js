const fs = require("node:fs");
const path = require("node:path");

const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ActivityType } = require("discord.js");
const mongoose = require("mongoose");
const Sentry = require("@sentry/node");
const keepAlive = require("./components/webserver.js");
const { ForwardMailGen } = require("./templates/forwardmail/gen.js");
const { EmailGithubGen } = require("./templates/forwardmail-github/gen.js");
const { ReplitGen } = require("./templates/replit/gen.js");
const { HashnodeGen } = require("./templates/hashnode/gen.js");
const { adminSendEmails } = require("./components/adminSendEmails.js");
const { DeleteDomain } = require("./components/delete.js");
const { EditModal } = require("./components/Edit/modal.js");

require("dotenv").config();


// Sentry
Sentry.init({
    dsn: "https://2854c55af6ab42ffb6f840091e3b235c@o575799.ingest.sentry.io/4505311662309376",
  
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });
  

const mongoDB = process.env.MONGO_DB;

const token = process.env.DISCORD_TOKEN;
// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    //if (!interaction.isChatInputCommand()) return;
    if (interaction.customId === "feedback") {
        // Get the values from the interaction
        const improve = interaction.fields.getTextInputValue("improve");
        const suggest = interaction.fields.getTextInputValue("suggest");
        const username = interaction.user.username;

        // Send the values to the channel #feedback
        const channel = interaction.guild.channels.cache.find((channel) => channel.name === "bot-feedback");
        const embed = new EmbedBuilder()
            .setTitle("Feedback")
            .setDescription(`Improvements: ${improve}\nSuggestions: ${suggest}`)
            .setColor("#00FF00")
            .setFooter({ text: `Feedback from ${username}` })
            .setTimestamp();
        channel.send({ embeds: [embed] });
        // Send a reply to the user
        await interaction.reply({ content: "Your submission was received successfully!" });
    }

    if (interaction.customId === "emailforward") {
        ForwardMailGen(interaction);
    }
    if (interaction.customId === "EmailGithub") {
        EmailGithubGen(interaction);
    }
    if (interaction.customId === "Replit") {
        ReplitGen(interaction);
    }
    if (interaction.customId === "hashnode") {
        HashnodeGen(interaction);
    }
    if (interaction.customId === "sendemail") {
        adminSendEmails(interaction);
    }
    if (interaction.customId === "delete") {
        DeleteDomain(interaction);
    }
    if (interaction.customId === "edit") {
        EditModal(interaction);
    }

    const command = interaction.client.commands.get(interaction.commandName);
    console.log(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });
        } else {
            await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
        }
    }
});

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, (c) => {
    client.user.setPresence({
        activities: [{ name: `Registering Subdomains`, type: ActivityType.Watching }],
        status: "online",
    });

    console.log(`Ready! Logged in as ${c.user.tag}`);
});

mongoose
    .connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true, dbName: "is-a-dev" })
    .then(() => {
        console.log("Connected to the database");
    })
    .catch((error) => {
        console.error("Error connecting to the database:", error);
    });

//SMTP(); off for now
keepAlive();

// Log in to Discord with your client's token
client.login(token);
