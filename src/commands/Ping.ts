import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';

export class Ping extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!')
        .toJSON();

    public async execute({ interaction }: SlashCommand.ExecuteData) {
        await interaction.reply('Pong!');
    }
}

export default new Ping();