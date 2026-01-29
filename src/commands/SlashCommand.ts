import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from "reciple";

export class MyModule extends SlashCommandModule {
    data = new SlashCommandBuilder()
        .setName('my-command')
        .setDescription('My command')
        .toJSON();

    async execute({ interaction }: SlashCommand.ExecuteData) {
        // Write your code here
    }
}

export default new MyModule();
