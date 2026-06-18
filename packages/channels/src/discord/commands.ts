import { DiscordRest } from "./rest.js";

export interface SlashCommand {
  name: string;
  description: string;
  options?: unknown[];
}

export class DiscordCommandRegistrar {
  constructor(
    private readonly rest: DiscordRest,
    private readonly applicationId: string,
  ) {}

  async registerCommands(
    guildId: string,
    commands: SlashCommand[],
  ): Promise<Array<{ id: string }>> {
    return this.rest.registerCommands(this.applicationId, guildId, commands);
  }
}
